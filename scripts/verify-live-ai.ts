import assert from "node:assert/strict";
import { seedProblems } from "../src/data/problems";

if (!process.argv.includes("--live"))
  throw new Error(
    "Use --live against a disposable local server with AI enabled. This makes two paid requests.",
  );
const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3010";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Live integration fixtures are restricted to a local server.");
const cookies = new Map<string, string>();
async function request(path: string, body?: unknown, method = "POST") {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : method,
    headers: {
      cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      ...(body === undefined ? {} : { origin: base, "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(115_000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0],
      index = pair.indexOf("=");
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
}
assert.equal((await request("/api/workspace")).aiReady, true);
const input = {
  domain: "backend",
  language: "python",
  difficulty: "하",
  kind: "implementation",
  topic: "사용자 목록의 중복 이메일을 대소문자 구분 없이 제거하되 처음 등장한 순서를 유지하는 함수",
  requestId: crypto.randomUUID(),
};
const generated = await request("/api/generate", input);
assert.equal((await request("/api/generate", input)).problem.id, generated.problem.id);
const detail = await request(`/api/problems/${generated.problem.id}`);
assert.equal(detail.problem.source, "ai");
assert.equal(detail.solution, null);
assert.deepEqual(detail.hints, []);
const problem = seedProblems.find((p) => p.id === "be-pagination")!;
await request(`/api/progress/${problem.id}`, { code: problem.solution }, "PUT");
const reviewInput = { code: problem.solution, requestId: crypto.randomUUID() };
const reviewed = await request(`/api/problems/${problem.id}/review`, reviewInput);
assert.equal(reviewed.attempt.review.passed, true);
assert.equal(
  (await request(`/api/problems/${problem.id}/review`, reviewInput)).attempt.id,
  reviewed.attempt.id,
);
assert.equal((await request(`/api/problems/${problem.id}`)).attempts.length, 1);
const usage = await request("/api/usage");
assert.equal(usage.last30Days.requests, 2);
assert.equal(usage.last30Days.failures, 0);
assert.ok(usage.last30Days.inputTokens > 0);
assert.ok(usage.last30Days.outputTokens > 0);
assert.deepEqual(usage.remaining, { generate: 4, review: 19 });
console.log(
  JSON.stringify({
    status: "PASS",
    generatedProblem: generated.problem.id,
    reviewPassed: true,
    attempts: 1,
    measuredRequests: usage.last30Days.requests,
    idempotency: "same result without another paid call",
  }),
);
