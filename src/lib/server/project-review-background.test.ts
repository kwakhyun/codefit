import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { SqliteStore } from "./sqlite-store";
import { ProjectCheckService } from "./project-check-service";
import { fixtureAnalysis, fixtureAssessment, fixtureCheck } from "../project-check/fixtures";
let store: SqliteStore;
const ai = { readPage: vi.fn(), analyze: vi.fn(), assess: vi.fn() };
const signal = () => new AbortController().signal;
const answers = Array(5).fill("사용자가 예약하면 서버가 중복을 확인합니다.");
async function analysis(owner = "user:a") {
  const requestId = randomUUID();
  await new ProjectCheckService(store, ai).create(
    owner,
    "network",
    { requestId, url: "https://example.com/", description: "" },
    signal(),
  );
  return requestId;
}
beforeEach(() => {
  store = new SqliteStore(":memory:");
  ai.readPage.mockReset().mockResolvedValue(fixtureCheck.page);
  ai.analyze.mockReset().mockResolvedValue(fixtureAnalysis);
  ai.assess.mockReset().mockResolvedValue(fixtureAssessment);
});
afterEach(() => store.db.close());

it("runs a reserved background review once and reports pending, then the saved review", async () => {
  const service = new ProjectCheckService(store, ai);
  const id = await analysis();
  const claim = await service.beginReview("user:a", { id, answers });
  if (claim.state !== "new") throw new Error("lease");
  expect(await store.queries.projectChecks.reviewStatus("user:a", id)).toEqual({
    status: "pending",
  });
  expect(await service.beginReview("user:a", { id, answers })).toEqual({ state: "pending" });
  await service.review("user:a", "network", { id, answers }, signal(), claim.lease);
  const status = await store.queries.projectChecks.reviewStatus("user:a", id);
  expect(status).toMatchObject({ status: "done", review: { answers } });
  expect(ai.assess).toHaveBeenCalledTimes(1);
  expect(await store.queries.projectChecks.reviewStatus("user:b", id)).toBeNull();
});

it("records a definite failure, refunds an explicit provider rejection and accepts edited answers", async () => {
  const service = new ProjectCheckService(store, ai);
  const id = await analysis();
  const before = (await store.queries.projectChecks.usage("user:a")).review.remaining;
  ai.assess.mockRejectedValueOnce(
    new OpenAI.APIError(500, { message: "provider detail" }, "provider detail", new Headers()),
  );
  await expect(service.review("user:a", "network", { id, answers }, signal())).rejects.toThrow();
  const failed = await store.queries.projectChecks.reviewStatus("user:a", id);
  expect(failed).toMatchObject({ status: "failed", code: expect.any(Number) });
  expect(JSON.stringify(failed)).not.toContain("provider detail");
  expect((await store.queries.projectChecks.usage("user:a")).review.remaining).toBe(before);
  const edited = Array(5).fill("고쳐 쓴 설명입니다.");
  const claim = await service.beginReview("user:a", { id, answers: edited });
  expect(claim.state).toBe("new");
});

it("keeps the unit counted when the outcome of the paid call is unknown", async () => {
  const service = new ProjectCheckService(store, ai);
  const id = await analysis();
  const before = (await store.queries.projectChecks.usage("user:a")).review.remaining;
  ai.assess.mockRejectedValueOnce(new Error("connection reset"));
  await expect(service.review("user:a", "network", { id, answers }, signal())).rejects.toThrow();
  expect(await store.queries.projectChecks.reviewStatus("user:a", id)).toMatchObject({
    status: "failed",
  });
  expect((await store.queries.projectChecks.usage("user:a")).review.remaining).toBe(before - 1);
});

it("lists the root and every revision with scores on both the root and a revision", async () => {
  const service = new ProjectCheckService(store, ai);
  const id = await analysis();
  await service.review("user:a", "network", { id, answers }, signal());
  const first = await service.revise("user:a", id, randomUUID());
  const root = await store.queries.projectChecks.detail("user:a", id);
  const revision = await store.queries.projectChecks.detail("user:a", first.id);
  const expected = [
    { id, revisionNumber: 0, score: fixtureAssessment.score },
    { id: first.id, revisionNumber: 1 },
  ];
  expect(root?.revisionTimeline).toMatchObject(expected);
  expect(revision?.revisionTimeline).toMatchObject(expected);
  expect(revision?.revisionTimeline?.[1]).not.toHaveProperty("score");
});
