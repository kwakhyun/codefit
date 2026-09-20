import { expect, it, vi } from "vitest";
import {
  githubTarget,
  githubRetryDelay,
  eligibleSource,
  extractSource,
  addedLines,
  importLinks,
  readProjectRepository,
} from "./project-repository";
import { repositoryCitation, sourceLine } from "../project-check/repository";
const sha = "a".repeat(40),
  blobSha = "b".repeat(40);
const source = "from app.storage import save\n\ndef create():\n    return save()";
function apiMock(pr = false) {
  return vi.fn<typeof fetch>(async (url, options) => {
    if (String(url).startsWith("https://raw.githubusercontent.com/owner/repo/")) {
      expect(options?.redirect).toBe("error");
      expect(String(url)).toContain(sha);
      return new Response(source);
    }
    expect(String(url)).toMatch(/^https:\/\/api.github.com\/repos\/owner\/repo(?:\/|$)/);
    expect(options?.redirect).toBe("error");
    expect(options?.headers).not.toHaveProperty("Authorization");
    const p = new URL(String(url)).pathname;
    if (p.endsWith("/repo")) return Response.json({ private: false, default_branch: "main" });
    if (p.endsWith("/pulls/1/files"))
      return Response.json([
        {
          filename: "app/main.py",
          status: "modified",
          patch: "@@ -1,1 +1,2 @@\n import os\n+return save()",
        },
      ]);
    if (p.endsWith("/pulls/1")) return Response.json({ head: { sha }, changed_files: 1 });
    if (p.includes("/commits/")) return Response.json({ sha });
    if (p.includes("/git/trees/"))
      return Response.json({
        truncated: false,
        tree: [
          { path: "app/main.py", type: "blob", mode: "100644", sha: blobSha, size: 100 },
          { path: "app/storage.py", type: "blob", mode: "100644", sha: blobSha, size: 100 },
          { path: ".env", type: "blob", mode: "100644", sha: blobSha, size: 100 },
          { path: "symlink.py", type: "blob", mode: "120000", sha: blobSha, size: 10 },
        ],
      });
    if (p.includes("/git/blobs/"))
      return Response.json({
        encoding: "base64",
        content: Buffer.from(pr ? "import os\nreturn save()" : source).toString("base64"),
        size: 100,
      });
    return new Response(null, { status: 404 });
  });
}
it("recognizes repositories and PRs without treating arbitrary GitHub paths as repositories", () => {
  expect(githubTarget("https://github.com/owner/repo.git")).toEqual({
    name: "owner/repo",
    pullRequest: undefined,
  });
  expect(githubTarget("https://github.com/owner/repo/pull/3")).toEqual({
    name: "owner/repo",
    pullRequest: 3,
  });
  expect(githubTarget("https://example.org")).toBeNull();
  for (const url of [
    "https://github.com/owner/repo/blob/main/a.py",
    "https://github.com/owner/repo?token=secret",
    "https://x:password@github.com/owner/repo",
    "https://github.com/owner/%2e%2e",
  ])
    expect(() => githubTarget(url)).toThrow();
});
it("excludes credentials, dependencies, traversal, binary files and redacts likely secrets keeping line numbers", () => {
  for (const name of [
    ".env.local",
    "config/secrets.py",
    "id_rsa.pem",
    "node_modules/pkg/a.js",
    "../main.py",
    "a/../main.py",
    "a\\main.py",
    "a.png",
  ])
    expect(eligibleSource(name)).toBe(false);
  expect(eligibleSource("finguard/signing.py")).toBe(true);
  const f = extractSource(
    "main.py",
    'import os\napi_key = "sk-abcdefghijklmnopqrstuvwx"\nreturn True',
  );
  expect(f.lines[1]).toEqual({ number: 2, text: "[민감한 값으로 보이는 줄 제외]" });
});
it("bounds large file excerpts while including decisions beyond the header", () => {
  const f = extractSource(
    "main.py",
    Array.from({ length: 1000 }, (_, i) => `if condition_${i}: return ${i}`).join("\n"),
  );
  expect(f.partial).toBe(true);
  expect(f.lines.length).toBeLessThan(200);
  expect(f.lines.some((l) => l.number > 500)).toBe(true);
});
it("computes added lines across patch hunks and ignores deleted lines", () => {
  expect([
    ...addedLines("@@ -1,2 +1,2 @@\n-old\n+new\n context\n@@ -20 +30,2 @@\n old\n+new"),
  ]).toEqual([1, 31]);
});
it("only resolves observed imports between collected files and preserves provenance", () => {
  const files = [
    extractSource("app/main.py", source),
    extractSource("app/storage.py", "def save(): return True"),
  ];
  expect(importLinks(files)).toEqual([{ from: "app/main.py", to: "app/storage.py" }]);
  const repo = {
    name: "owner/repo",
    commit: sha,
    totalFiles: 2,
    eligibleFiles: 2,
    truncatedTree: false,
    omittedFiles: 0,
    files,
    links: [],
  };
  const evidence = sourceLine("app/main.py", 1, "from app.storage import save");
  expect(repositoryCitation(repo, evidence)?.url).toContain(`/blob/${sha}/app/main.py#L1`);
  expect(repositoryCitation(repo, "app/main.py:L2 invented()")).toBeUndefined();
});
it("reads pinned public blobs without tokens and reports omitted files", async () => {
  const mock = apiMock();
  const page = await readProjectRepository(
    "https://github.com/owner/repo",
    AbortSignal.timeout(5000),
    mock,
  );
  expect(page.source).toBe("repository");
  expect(page.repository?.commit).toBe(sha);
  expect(page.repository?.files).toHaveLength(2);
  expect(page.text).toContain("app/main.py:L4     return save()");
  expect(page.repository?.omittedFiles).toBe(1);
  expect(mock.mock.calls.some(([url]) => String(url).includes(`/git/trees/${sha}`))).toBe(true);
});
it("restricts PR collection to added-line context at its head", async () => {
  const page = await readProjectRepository(
    "https://github.com/owner/repo/pull/1",
    AbortSignal.timeout(5000),
    apiMock(true),
  );
  expect(page.repository?.files.map((f) => f.path)).toEqual(["app/main.py"]);
  expect(page.repository?.pullRequest).toBe(1);
  expect(page.repository?.files[0].changed).toBe(true);
});
it("fails clearly on rate limits, private repositories and an empty source set", async () => {
  await expect(
    readProjectRepository(
      "https://github.com/owner/repo",
      AbortSignal.timeout(5000),
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
        ),
    ),
  ).rejects.toMatchObject({ status: 429 });
  await expect(
    readProjectRepository(
      "https://github.com/owner/repo",
      AbortSignal.timeout(5000),
      vi.fn().mockResolvedValue(Response.json({ private: true, default_branch: "main" })),
    ),
  ).rejects.toMatchObject({ status: 422 });
  const mock = apiMock();
  mock
    .mockImplementationOnce(async () => Response.json({ private: false, default_branch: "main" }))
    .mockImplementationOnce(async () => Response.json({ sha }))
    .mockImplementationOnce(async () => Response.json({ truncated: false, tree: [] }));
  await expect(
    readProjectRepository("https://github.com/owner/repo", AbortSignal.timeout(5000), mock),
  ).rejects.toMatchObject({ status: 422 });
});
it("rejects PRs that move while changed files are being collected", async () => {
  const mock = apiMock(true);
  let calls = 0;
  const stable = mock.getMockImplementation()!;
  mock.mockImplementation(async (...args) =>
    String(args[0]).endsWith("/pulls/1") && ++calls === 2
      ? Response.json({ head: { sha: blobSha } })
      : stable(...args),
  );
  await expect(
    readProjectRepository("https://github.com/owner/repo/pull/1", AbortSignal.timeout(5000), mock),
  ).rejects.toMatchObject({ status: 409 });
});

it("reads rate-limit retry delays without inventing an unknown reset time", () => {
  const now = 1800000000000;
  expect(githubRetryDelay(new Headers({ "retry-after": "90" }), now)).toBe(90);
  expect(
    githubRetryDelay(new Headers({ "x-ratelimit-reset": String(now / 1000 + 120) }), now),
  ).toBe(120);
  expect(githubRetryDelay(new Headers(), now)).toBeUndefined();
  expect(githubRetryDelay(new Headers({ "retry-after": "invalid" }), now)).toBeUndefined();
});

it("reserves room for an imported implementation beyond the initial file selection", async () => {
  const fallback = apiMock();
  const paths = [
    ...Array.from({ length: 20 }, (_, i) => `src/lib/a${String(i).padStart(2, "0")}.ts`),
    "src/lib/z-implementation.ts",
  ];
  const request = vi.fn<typeof fetch>(async (url, options) => {
    const value = String(url);
    if (value.includes("/git/trees/"))
      return Response.json({
        truncated: false,
        tree: paths.map((path) => ({
          path,
          type: "blob",
          mode: "100644",
          sha: blobSha,
          size: 100,
        })),
      });
    if (value.startsWith("https://raw.githubusercontent.com/"))
      return new Response(
        value.endsWith("/a00.ts")
          ? 'import { save } from "@/lib/z-implementation";\nexport const run = () => save();'
          : "export const save = () => 1;",
      );
    return fallback(url, options);
  });
  const page = await readProjectRepository(
    "https://github.com/owner/repo",
    AbortSignal.timeout(5000),
    request,
  );
  expect(page.repository?.files).toHaveLength(16);
  expect(page.repository?.files.some((f) => f.path === "src/lib/z-implementation.ts")).toBe(true);
});
