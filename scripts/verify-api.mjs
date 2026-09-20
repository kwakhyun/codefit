import assert from "node:assert/strict";
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3011";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error(
    "This writes fixtures. Use a disposable local server, never the production site.",
  );
function browser() {
  const cookies = new Map();
  return async (
    pathname,
    { method = "GET", body, origin = base, raw, contentType = "application/json" } = {},
  ) => {
    const res = await fetch(base + pathname, {
      method,
      headers: {
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(method !== "GET" ? { origin, "content-type": contentType } : {}),
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0];
      const index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const data = await res.json();
    return { status: res.status, data, headers: res.headers };
  };
}
const a = browser(),
  b = browser();
const workspace = await a("/api/workspace");
assert.equal(workspace.status, 200);
assert.ok(workspace.data.stats.total >= 12);
assert.equal(workspace.headers.get("cache-control"), "no-store");
assert.equal(workspace.headers.get("x-content-type-options"), "nosniff");
const library = await a("/api/library");
assert.ok(library.data.problems.length <= 8);
assert.ok(library.data.problems.every((p) => !("solution" in p) && !("hints" in p)));
const id = "be-pagination";
assert.equal((await a("/api/problems/missing")).status, 404);
assert.equal(
  (
    await a(`/api/progress/${id}`, {
      method: "PUT",
      body: { code: "foreign" },
      origin: "https://attacker.example",
    })
  ).status,
  403,
);
assert.equal((await a(`/api/progress/${id}`, { method: "PUT", raw: "broken json" })).status, 400);
assert.equal(
  (await a(`/api/progress/${id}`, { method: "PUT", raw: "code=x", contentType: "text/plain" }))
    .status,
  415,
);
assert.equal(
  (await a(`/api/progress/${id}`, { method: "PUT", body: { code: "x".repeat(100001) } })).status,
  413,
);
assert.equal(
  (
    await a(`/api/progress/${id}`, {
      method: "PUT",
      body: { code: "print('persisted draft')", baseRevision: 0, bookmarked: true },
    })
  ).status,
  200,
);
assert.equal((await a(`/api/problems/${id}`)).data.progress.code, "print('persisted draft')");
assert.equal((await b(`/api/problems/${id}`)).data.progress, null);
for (let i = 0; i < 4; i++)
  assert.equal(
    (await a(`/api/problems/${id}/reveal`, { method: "POST", body: { kind: "hint" } })).data.hints
      .length,
    Math.min(i + 1, 3),
  );
const revealed = await a(`/api/problems/${id}/reveal`, {
  method: "POST",
  body: { kind: "solution" },
});
assert.ok(revealed.data.solution.code.includes("def paginate"));
assert.equal(revealed.data.progress.status, "in-progress");
const after = await a(`/api/problems/${id}`);
assert.equal(after.data.hints.length, 3);
assert.ok(after.data.solution);
const backup = await a("/api/export");
assert.equal(backup.data.version, 3);
assert.ok(backup.data.problems[0].solution);
assert.equal((await b("/api/import", { method: "POST", body: backup.data })).status, 200);
assert.equal((await b(`/api/problems/${id}`)).data.progress.code, "print('persisted draft')");
assert.equal((await b(`/api/problems/${id}`)).data.hints.length, 3);
assert.equal((await b("/api/import", { method: "POST", body: { version: 1 } })).status, 400);
assert.equal(
  (
    await a("/api/generate", {
      method: "POST",
      body: {
        domain: "frontend",
        language: "sql",
        difficulty: "중",
        kind: "debugging",
        topic: "검증",
        requestId: crypto.randomUUID(),
      },
    })
  ).status,
  400,
);
console.log(
  "PASS: public access, anonymous sessions, 12+ problems, hidden answers, origin protection, malformed/oversized inputs, autosave, per-user isolation, hints, solution, backup export/import and guest generation input validation.",
);
