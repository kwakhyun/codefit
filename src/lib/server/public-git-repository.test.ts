import { beforeEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { readProjectRepository } from "./project-repository";
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
function mockRepository(sources: { path: string; text: string }[]) {
  const files = sources.map((source, index) => ({
    ...source,
    mode: "100644",
    sha: (index + 1).toString(16).padStart(40, "0"),
  }));
  mocks.read.mockImplementation(async () => {
    const args = mocks.run.mock.calls.at(-1)?.[0]?.args ?? [];
    return Buffer.from(
      JSON.stringify(
        args[1] === "read"
          ? {
              blobs: files
                .filter((file) => args.slice(2).includes(file.sha))
                .map(({ sha, text }) => ({ sha, text })),
            }
          : {
              commit,
              total: files.length,
              files: files.map(({ text: _text, ...file }) => {
                void _text;
                return file;
              }),
            },
      ),
    );
  });
  return files;
}
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
  mockRepository([
    { path: "src/main.py", text: 'print("hello")' },
    { path: ".env", text: "TOKEN=private" },
  ]);
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
  expect(page.repository?.truncatedTree).toBe(false);
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

it("uses the same two import-following rounds as GitHub for Node module extensions", async () => {
  const sources = [
    ...Array.from({ length: 20 }, (_, i) => ({
      path: `src/lib/a${String(i).padStart(2, "0")}.cts`,
      text:
        i === 0 ? 'const run = require("./z-implementation.mjs");' : "export const setup = true;",
    })),
    { path: "src/lib/z-implementation.mts", text: 'export { save } from "./z-final.cjs";' },
    { path: "src/lib/z-final.cts", text: 'export const save = () => "saved";' },
    { path: ".env", text: "TOKEN=private" },
  ];
  const files = mockRepository(sources);
  const git = await readPublicGitRepository(
    "https://gitlab.com/team/repo",
    AbortSignal.timeout(5000),
  );
  const requests = vi.fn<typeof fetch>(async (url) => {
    const value = String(url);
    if (value.startsWith("https://raw.githubusercontent.com/")) {
      const file = files.find((file) => value.endsWith(`/${file.path}`));
      return new Response(file?.text, { status: file ? 200 : 404 });
    }
    if (value.includes("/git/trees/"))
      return Response.json({
        truncated: false,
        tree: files.map(({ text, ...file }) => ({
          ...file,
          type: "blob",
          size: Buffer.byteLength(text),
        })),
      });
    if (value.includes("/commits/")) return Response.json({ sha: commit });
    return Response.json({ private: false, default_branch: "main" });
  });
  const github = await readProjectRepository(
    "https://github.com/owner/repo",
    AbortSignal.timeout(5000),
    requests,
  );
  expect(git.repository?.files).toEqual(github.repository?.files);
  expect(git.repository?.links).toEqual(github.repository?.links);
  expect(git.repository?.files).toHaveLength(16);
  expect(git.repository?.files.map((file) => file.path)).toEqual(
    expect.arrayContaining(["src/lib/z-implementation.mts", "src/lib/z-final.cts"]),
  );
  const reads = mocks.run.mock.calls
    .map(([input]) => input.args)
    .filter((args) => args?.[1] === "read");
  expect(reads.map((args) => args.length - 2)).toEqual([8, 4, 4]);
  expect(reads.flat()).not.toContain(files.at(-1)!.sha);
});

it("rejects unrequested blobs and always cleans up the VM", async () => {
  const manifest = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation(async () => {
    const args = mocks.run.mock.calls.at(-1)?.[0]?.args;
    return args?.[1] === "read"
      ? Buffer.from(JSON.stringify({ blobs: [{ sha: "f".repeat(40), text: "unrequested()" }] }))
      : manifest();
  });
  await expect(
    readPublicGitRepository("https://gitlab.com/team/repo", AbortSignal.timeout(5000)),
  ).rejects.toMatchObject({ status: 422 });
  expect(mocks.stop).toHaveBeenCalledOnce();
});

it("emits a valid module reader without running repository code", () => {
  expect(() =>
    execFileSync(process.execPath, ["--input-type=module", "--check"], { input: gitReaderScript }),
  ).not.toThrow();
});

it("the VM reader returns only regular-file metadata and requested small text blobs", () => {
  const textId = "1".repeat(40),
    largeId = "2".repeat(40),
    binaryId = "3".repeat(40);
  const source = 'module.exports = () => "saved";';
  const execute = vi.fn((_command: string, args: string[]) => {
    if (args.includes("clone")) return "";
    if (args.includes("rev-parse")) return commit + "\n";
    if (args.includes("ls-tree"))
      return `100644 blob ${textId}\tsrc/main.cjs\0` + `120000 blob ${binaryId}\tsymlink.cjs\0`;
    const sha = args.at(-1);
    if (args.includes("-s")) return sha === largeId ? "500001" : "100";
    if (args.includes("blob")) return sha === binaryId ? "binary\0data" : source;
    throw new Error("unexpected git command");
  });
  const write = vi.fn();
  const context = (args: string[]) => ({
    execFileSync: execute,
    readFileSync: () => JSON.stringify({ url: "https://gitlab.com/team/repo" }),
    writeFileSync: write,
    mkdirSync: vi.fn(),
    process: { argv: ["node", "/vercel/sandbox/read.mjs", ...args], env: { PATH: "/usr/bin" } },
  });
  const script = gitReaderScript.replace(/^import .*;\n/gm, "");
  runInNewContext(script, context([]));
  expect(JSON.parse(write.mock.calls.at(-1)![1])).toEqual({
    commit,
    total: 2,
    files: [{ sha: textId, path: "src/main.cjs", mode: "100644" }],
  });
  expect(execute.mock.calls[0][1]).toEqual(
    expect.arrayContaining(["--no-checkout", "--no-recurse-submodules"]),
  );
  runInNewContext(script, context(["read", textId, largeId, binaryId]));
  expect(JSON.parse(write.mock.calls.at(-1)![1])).toEqual({
    blobs: [{ sha: textId, text: source }],
  });
  expect(
    execute.mock.calls
      .filter(([, args]) => args.includes("blob"))
      .some(([, args]) => args.at(-1) === largeId),
  ).toBe(false);
  expect(() => runInNewContext(script, context(["read", "--execute=bad"]))).toThrow(
    "invalid selection",
  );
});
