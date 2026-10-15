import { expect, it, vi } from "vitest";
import {
  githubTarget,
  githubRetryDelay,
  eligibleSource,
  dependencyCandidates,
  collectRepositoryFiles,
  extractSource,
  addedLines,
  importLinks,
  readProjectRepository,
  selectRepositoryFiles,
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
it("keeps short method preconditions with a sampled later guard", () => {
  const text = Array.from({ length: 60 }, (_, i) =>
    [
      `  async finish${i}(job: Job): Promise<Result> {`,
      `    if (job.result) return job.result; // reuse-${i}`,
      `    if (job.closing) throw new Error('busy'); // guard-${i}`,
      "    job.closing = true;",
      "    job.result = this.save(job);",
      "    return job.result;",
      "  }",
      "",
    ].join("\n"),
  ).join("\n");
  const file = extractSource("src/jobs.ts", text);
  const excerpt = file.lines.map((line) => line.text).join("\n");
  expect(file.partial).toBe(true);
  expect(excerpt).toMatch(/guard-\d+/);
  for (const [, index] of excerpt.matchAll(/guard-(\d+)/g))
    expect(excerpt).toContain(`reuse-${index}`);
  expect(file.lines.reduce((sum, line) => sum + line.text.length, 0)).toBeLessThanOrEqual(6500);
});
it("keeps complete multiline boolean assignments in long callback excerpts", () => {
  const blocks = Array.from({ length: 30 }, (_, i) =>
    [
      `const task${i} = tool({`,
      "  execute: async (input) => {",
      ...Array.from({ length: 45 }, (_, n) => `    const padding${n} = input.value;`),
      `    state.accepted${i} =`,
      "      input.bound &&",
      "      input.coverage === 'COMPLETE' &&",
      "      !input.extraClaims &&",
      "      input.bindingsMatch;",
      `    if (state.accepted${i}) {`,
      `      return save${i}(input);`,
      "    }",
      "    return undefined;",
      "  },",
      "});",
    ].join("\n"),
  ).join("\n");
  const file = extractSource("src/worker.ts", blocks);
  const original = blocks.split("\n");
  const numbers = new Set(file.lines.map((line) => line.number));
  expect(file.lines.some((line) => line.text.includes("input.coverage"))).toBe(true);
  for (const line of file.lines) {
    expect(line.text).toBe(original[line.number - 1]);
    if (/input\.(?:bound|coverage|bindingsMatch)|input.extraClaims/.test(line.text)) {
      let start = line.number - 1;
      while (!/state\.accepted\d+ =$/.test(original[start])) start--;
      for (let index = start; index <= start + 4; index++)
        expect(numbers.has(index + 1)).toBe(true);
    }
  }
  expect(file.lines.reduce((sum, line) => sum + line.text.length, 0)).toBeLessThanOrEqual(6500);
});
it("keeps the full expression crossing the initial header boundary", () => {
  const source = [
    ...Array.from({ length: 20 }, (_, i) => `export const prefix${i} = '${"x".repeat(90)}';`),
    "const allowed =",
    ...Array.from({ length: 9 }, (_, i) => `  flags.condition${i} &&`),
    "  flags.last;",
    ...Array.from({ length: 80 }, (_, i) => `export const suffix${i} = '${"x".repeat(90)}';`),
  ];
  const file = extractSource("src/policy.ts", source.join("\n"));
  const numbers = new Set(file.lines.map((line) => line.number));
  for (let line = 21; line <= 31; line++) expect(numbers.has(line)).toBe(true);
  for (const line of file.lines) expect(line.text).toBe(source[line.number - 1]);
  expect(file.lines.reduce((sum, line) => sum + line.text.length, 0)).toBeLessThanOrEqual(6500);
});
it("prioritizes all changed expressions before spending a PR budget on nearby context", () => {
  const source = Array.from({ length: 20 }, (_, i) => [
    ...Array(4).fill(`// prefix ${"x".repeat(370)}`),
    `const allowed${i} =`,
    "  input.ready &&",
    "  input.enabled;",
    ...Array(4).fill(`// suffix ${"x".repeat(370)}`),
  ]).flat();
  const changed = new Set(Array.from({ length: 20 }, (_, i) => i * 11 + 6));
  const file = extractSource("src/policy.ts", source.join("\n"), changed);
  const numbers = new Set(file.lines.map((line) => line.number));
  for (const line of changed)
    for (const number of [line - 1, line, line + 1]) expect(numbers.has(number)).toBe(true);
  expect(file.changed).toBe(true);
  for (const line of file.lines) expect(line.text).toBe(source[line.number - 1]);
  expect(file.lines.reduce((sum, line) => sum + line.text.length, 0)).toBeLessThanOrEqual(6500);
});
it("omits an oversized expression as a whole in both header and PR sampling", () => {
  const source = [
    "const allowed =",
    ...Array.from({ length: 30 }, (_, i) => `  input.condition${i}${"x".repeat(300)} &&`),
    "  input.last;",
    "export const safe = true;",
  ];
  for (const changed of [undefined, new Set([10, source.length])]) {
    const file = extractSource("src/policy.ts", source.join("\n"), changed);
    expect(file.lines.some((line) => line.number < source.length)).toBe(false);
    if (changed) expect(file.lines).toEqual([{ number: source.length, text: source.at(-1) }]);
    expect(file.partial).toBe(true);
  }
});
it("reserves follow-up source slots even when each import round has many dependencies", async () => {
  const core = Array.from({ length: 10 }, (_, i) => ({
    path: `src/runtime/engine${i}/service.ts`,
  }));
  const helpers = Array.from({ length: 10 }, (_, i) => ({ path: `src/lib/helper${i}.ts` }));
  const rounds: string[][] = [];
  const files = await collectRepositoryFiles([...core, ...helpers], async (selected) => {
    rounds.push(selected.map((file) => file.path));
    return selected.map((file) =>
      extractSource(
        file.path,
        file.path === core[0].path
          ? helpers
              .slice(0, 5)
              .map((h) => `import "@/${h.path.slice(4, -3)}";`)
              .join("\n")
          : file.path === helpers[0].path
            ? `import "./helper9";`
            : "export const execute = () => true;",
      ),
    );
  });
  expect(files).toHaveLength(16);
  expect(rounds[1]).toContain(core[8].path);
  expect(rounds[2]).toContain(core[9].path);
  expect(files.some((file) => file.path === helpers[9].path)).toBe(true);
});
it("prioritizes product boundaries over marketing and verification scripts", () => {
  const paths = [
    "scripts/capture-product-screenshots.mjs",
    "scripts/run-worker-smoke.ts",
    "scripts/check-ai-workflow.mjs",
    "landing/src/App.jsx",
    "scripts/portfolio/build-demo-video.ts",
    "src/services/addressBookService.ts",
    "src/services/signingService.ts",
    "src/renderer/capture/ReplayEngine.ts",
    "scripts/approve-proposal.mjs",
  ];
  expect(
    selectRepositoryFiles(
      paths.map((path) => ({ path })),
      3,
    )
      .map((f) => f.path)
      .sort(),
  ).toEqual(paths.slice(6).sort());
  expect(
    selectRepositoryFiles(
      [{ path: "src/services/addressBookService.ts" }, { path: "src/portfolio/approval.ts" }],
      1,
    )[0].path,
  ).toBe("src/portfolio/approval.ts");
});
it("does not let AI or service words promote loading screens and decorative components", () => {
  const candidates = [
    "src/app/learn/ai/[slug]/loading.tsx",
    "src/components/learn/service-thumbnail.tsx",
    "src/components/learn/mission-session.tsx",
    "src/lib/server/project-check-service.ts",
    "src/lib/server/ai-project-check.ts",
    "src/domain/rules.ts",
  ];
  expect(
    selectRepositoryFiles(
      candidates.map((path) => ({ path })),
      3,
    )
      .map((f) => f.path)
      .sort(),
  ).toEqual(candidates.slice(3).sort());
  // Frontend-only implementations remain eligible when there is no backend.
  expect(selectRepositoryFiles([{ path: candidates[2] }], 1)[0].path).toBe(candidates[2]);
  expect(
    selectRepositoryFiles([{ path: "server/architecture.md" }, { path: "src/runtime.ts" }], 1)[0]
      .path,
  ).toBe("src/runtime.ts");
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
    "src/lib/z-storage.ts",
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
          : value.endsWith("/z-implementation.ts")
            ? 'import { save } from "./z-storage";\nexport { save };'
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
  expect(page.repository?.files.some((f) => f.path === "src/lib/z-storage.ts")).toBe(true);
});

it("reads a bounded large runtime file instead of dropping it at 100KB", async () => {
  const base = apiMock();
  const text = "def execute():\n    return 'ready'\n" + "# context\n".repeat(11000);
  const request = vi.fn<typeof fetch>(async (url, options) => {
    if (String(url).includes("/git/trees/"))
      return Response.json({
        truncated: false,
        tree: [
          {
            path: "scripts/runner.py",
            type: "blob",
            mode: "100755",
            sha: blobSha,
            size: Buffer.byteLength(text),
          },
        ],
      });
    if (String(url).startsWith("https://raw.githubusercontent.com/")) return new Response(text);
    return base(url, options);
  });
  const page = await readProjectRepository(
    "https://github.com/owner/repo",
    new AbortController().signal,
    request,
  );
  expect(page.repository!.files.map((f) => f.path)).toContain("scripts/runner.py");
  expect(page.repository!.files[0].partial).toBe(true);
  expect(page.repository!.files[0].lines.map((l) => l.text).join("\n").length).toBeLessThanOrEqual(
    6500,
  );
});

it("collects CommonJS and typed Node modules and resolves their runtime import extensions", () => {
  for (const extension of ["cjs", "mts", "cts", "mjs", "ts", "tsx"])
    expect(eligibleSource(`src/worker.${extension}`)).toBe(true);
  for (const name of [
    "node_modules/pkg/main.cjs",
    "src/credentials.cts",
    "../main.mts",
    "bundle.min.cjs",
  ])
    expect(eligibleSource(name)).toBe(false);
  const files = [
    extractSource("src/main.cts", 'const run = require("./worker.cjs"); import("@/result.mjs");'),
    extractSource("src/worker.cts", 'export { run } from "./result.mjs";'),
    extractSource("src/result.mts", "export const run = () => 1;"),
  ];
  expect(dependencyCandidates([files[0]], files.slice(1)).map((file) => file.path)).toEqual([
    "src/worker.cts",
    "src/result.mts",
  ]);
  expect(importLinks(files)).toEqual([
    { from: "src/main.cts", to: "src/worker.cts" },
    { from: "src/main.cts", to: "src/result.mts" },
    { from: "src/worker.cts", to: "src/result.mts" },
  ]);
});
