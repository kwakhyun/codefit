import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  run: vi.fn(),
  write: vi.fn(),
  read: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: mocks.create } }));
import {
  publicGitTarget,
  looksLikeRepository,
  readPublicGitRepository,
  gitReaderScript,
} from "./public-git-repository";
import { repositoryCitation, repositorySnapshotSchema } from "../project-check/repository";
const commit = "a".repeat(40);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({
    runCommand: mocks.run,
    writeFiles: mocks.write,
    readFileToBuffer: mocks.read,
    stop: mocks.stop,
  });
  mocks.run.mockResolvedValue({ exitCode: 0 });
  mocks.stop.mockResolvedValue(undefined);
  mocks.read.mockResolvedValue(
    Buffer.from(
      JSON.stringify({
        commit,
        total: 2,
        files: [
          { path: "src/main.py", text: 'print("hello")' },
          { path: ".env", text: "TOKEN=private" },
        ],
      }),
    ),
  );
});
it("accepts forge hosts and nested self-hosted public repositories", () => {
  for (const url of [
    "https://gitlab.com/team/subgroup/project.git",
    "https://bitbucket.org/team/project",
    "https://codeberg.org/team/project",
    "https://forge.example.com/team/project",
  ])
    expect(publicGitTarget(url).url).toBe(url);
  expect(looksLikeRepository("https://gitlab.com/team/project")).toBe(true);
  expect(looksLikeRepository("https://forge.example.com/team/project.git")).toBe(true);
  expect(looksLikeRepository("https://service.example.com/")).toBe(false);
});
it("rejects credentials, local hosts, unsafe protocols, queries and non-root links", () => {
  for (const url of [
    "http://gitlab.com/team/repo",
    "https://token@gitlab.com/team/repo",
    "https://127.0.0.1/repo",
    "https://host.internal/team/repo",
    "file:///tmp/repo",
    "https://gitlab.com/team/repo?token=x",
    "https://gitlab.com/team/repo/-/blob/main/file",
    "https://gitlab.com/",
  ])
    expect(() => publicGitTarget(url)).toThrow();
});
it("collects source in a bounded VM, filters secrets and creates provider-specific citations", async () => {
  const page = await readPublicGitRepository(
    "https://gitlab.com/group/sub/repo.git",
    AbortSignal.timeout(5000),
  );
  expect(mocks.create.mock.calls[0][0]).toMatchObject({
    persistent: false,
    networkPolicy: {
      allow: ["gitlab.com"],
      subnets: { deny: expect.arrayContaining(["127.0.0.0/8", "169.254.0.0/16"]) },
    },
  });
  expect(mocks.run.mock.calls[0][0]).toMatchObject({ cmd: "sysctl", sudo: true });
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(page.repository?.files).toHaveLength(1);
  expect(repositorySnapshotSchema.safeParse(page.repository).success).toBe(true);
  expect(repositoryCitation(page.repository, 'src/main.py:L1 print("hello")')?.url).toBe(
    `https://gitlab.com/group/sub/repo/-/blob/${commit}/src/main.py#L1`,
  );
  expect(gitReaderScript).toContain("--no-checkout");
  expect(gitReaderScript).toContain("GIT_ALLOW_PROTOCOL:'https'");
});
it("does not collect anything if network isolation fails and always stops", async () => {
  mocks.run.mockResolvedValueOnce({ exitCode: 1 });
  await expect(
    readPublicGitRepository("https://forge.example.com/team/repo", AbortSignal.timeout(5000)),
  ).rejects.toMatchObject({ status: 422 });
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.stop).toHaveBeenCalledOnce();
});
it("rejects malformed collector output and cleans up", async () => {
  mocks.read.mockResolvedValue(Buffer.from('{"commit":"unknown"}'));
  await expect(
    readPublicGitRepository("https://bitbucket.org/team/repo", AbortSignal.timeout(5000)),
  ).rejects.toThrow("공개 Git 소스");
  expect(mocks.stop).toHaveBeenCalledOnce();
});
it("keeps historical GitHub evidence and uses the actual origin for other forges", async () => {
  const page = await readPublicGitRepository(
    "https://codeberg.org/team/repo",
    AbortSignal.timeout(5000),
  );
  const repo = page.repository!;
  const evidence = 'src/main.py:L1 print("hello")';
  expect(repositoryCitation(repo, evidence)?.url).toBe(
    `https://codeberg.org/team/repo/src/commit/${commit}/src/main.py#L1`,
  );
  expect(
    repositoryCitation({ ...repo, url: undefined, name: "team/repo" }, evidence)?.url,
  ).toContain("https://github.com/team/repo/blob/");
  expect(
    repositoryCitation({ ...repo, url: "https://forge.example.com/team/repo" }, evidence)?.url,
  ).toBe("https://forge.example.com/team/repo");
  expect(
    repositoryCitation({ ...repo, url: "https://bitbucket.org/team/repo" }, evidence)?.url,
  ).toContain(`/src/${commit}/src/main.py#lines-1`);
});
