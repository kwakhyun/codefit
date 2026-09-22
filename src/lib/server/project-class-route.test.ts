import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { SqliteStore } from "./sqlite-store";
import { fixtureCheck } from "../project-check/fixtures";
const { current, getStore } = vi.hoisted(() => ({ current: vi.fn(), getStore: vi.fn() }));
vi.mock("./session", () => ({ session: current }));
vi.mock("./database", () => ({ getStore }));
import { GET as versions } from "../../app/api/projects/[id]/versions/route";
import { DELETE as cancelAnalysis } from "../../app/api/project-check/[id]/status/route";
import { GET, PATCH, DELETE } from "../../app/api/projects/[id]/route";
let store: SqliteStore;
const id = randomUUID(),
  owner = "user:classes",
  context = { params: Promise.resolve({ id }) };
const request = (method = "GET", body?: unknown) =>
  new Request(`https://codefit.test/api/projects/${id}`, {
    method,
    headers: { "x-codefit-workspace": owner, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(async () => {
  store = new SqliteStore(":memory:");
  getStore.mockResolvedValue(store);
  current.mockResolvedValue({ owner, scope: owner, user: { id: "classes" } });
  const job = store.startJob(owner, id, "project-analysis", "fixture");
  if (job.state !== "new") throw Error();
  await store.queries.projectChecks.complete(job.lease, { ...fixtureCheck, id });
});
afterEach(() => store.db.close());
it("serves old analyses as classes and persists edited metadata without exposing assessment criteria", async () => {
  const detail = await GET(request(), context);
  expect(detail.status).toBe(200);
  const body = await detail.json();
  expect(body.practice).toBeNull();
  expect(body.check.analysis.questions[0]).not.toHaveProperty("criteria");
  expect(
    (
      await PATCH(
        request("PATCH", { name: "내 클래스", goal: "실패 복구 학습", revision: 0 }),
        context,
      )
    ).status,
  ).toBe(200);
  expect((await (await GET(request(), context)).json()).check.classMetadata.name).toBe("내 클래스");
  expect(
    (await PATCH(request("PATCH", { name: "덮어쓰기", goal: "", revision: 0 }), context)).status,
  ).toBe(409);
  expect((await DELETE(request("DELETE"), context)).status).toBe(200);
  expect((await GET(request(), context)).status).toBe(404);
});
it("blocks changed sessions, other owners, malformed identifiers and unsafe edits", async () => {
  expect((await GET(request(), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect((await PATCH(request("PATCH", { name: "", goal: "", revision: 0 }), context)).status).toBe(
    400,
  );
  current.mockResolvedValue({ owner: "user:other", scope: "user:other", user: { id: "other" } });
  expect((await DELETE(request("DELETE"), context)).status).toBe(409);
  const other = new Request(`https://codefit.test/api/projects/${id}`, {
    headers: { "x-codefit-workspace": "user:other" },
  });
  expect((await GET(other, context)).status).toBe(404);
  expect(await store.queries.projectChecks.get(owner, id)).not.toBeNull();
});

it("limits version history to an owned class", async () => {
  expect((await versions(request(), context)).status).toBe(200);
  current.mockResolvedValue({ owner: "user:other", scope: "user:other", user: { id: "other" } });
  const other = new Request(`https://codefit.test/api/projects/${id}/versions`, {
    headers: { "x-codefit-workspace": "user:other" },
  });
  expect((await versions(other, context)).status).toBe(404);
});

it("cancellation endpoint enforces workspace ownership and does not delete completed classes", async () => {
  expect((await cancelAnalysis(request("DELETE"), context)).status).toBe(200);
  expect(await store.queries.projectChecks.get(owner, id)).not.toBeNull();
  const pendingId = randomUUID();
  store.startJob(owner, pendingId, "project-analysis", "pending");
  const pendingContext = { params: Promise.resolve({ id: pendingId }) };
  current.mockResolvedValue({ owner: "user:other", scope: "user:other", user: { id: "other" } });
  expect((await cancelAnalysis(request("DELETE"), pendingContext)).status).toBe(409);
  const otherRequest = new Request("https://codefit.test/api/project-check/status", {
    method: "DELETE",
    headers: { "x-codefit-workspace": "user:other" },
  });
  expect((await cancelAnalysis(otherRequest, pendingContext)).status).toBe(404);
  expect(await store.queries.projectChecks.analysisStatus(owner, pendingId)).toEqual({
    status: "pending",
  });
  current.mockResolvedValue({ owner, scope: owner, user: { id: "classes" } });
  const response = await cancelAnalysis(request("DELETE"), pendingContext);
  expect(await response.json()).toEqual({ status: "cancelled" });
});
