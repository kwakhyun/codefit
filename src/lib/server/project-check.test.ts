import { projectContract } from "./project-contract.test-helper";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { SqliteStore } from "./sqlite-store";
import { ProjectCheckService } from "./project-check-service";
import { fixtureAnalysis, fixtureAssessment, fixtureCheck } from "../project-check/fixtures";
import { publicCheck } from "./project-check-store";
import { validateAnalysis } from "./ai-project-check";
let store: SqliteStore;
const ai = { readPage: vi.fn(), analyze: vi.fn(), assess: vi.fn() };
const input = () => ({
  requestId: randomUUID(),
  url: "https://example.com/",
  description: "",
  consent: true as const,
});
const signal = () => new AbortController().signal;
beforeEach(() => {
  store = new SqliteStore(":memory:");
  ai.readPage.mockReset().mockResolvedValue(fixtureCheck.page);
  ai.analyze.mockReset().mockResolvedValue(fixtureAnalysis);
  ai.assess.mockReset().mockResolvedValue(fixtureAssessment);
});
afterEach(() => store.db.close());
it("persists private questions and assessment, replaying identical requests without another AI call", async () => {
  const service = new ProjectCheckService(store, ai),
    i = input();
  const result = await service.create("user:a", "network", i, signal());
  expect(result.analysis.questions[0]).not.toHaveProperty("criteria");
  expect(result.page).not.toHaveProperty("text");
  expect(await service.create("user:a", "network", i, signal())).toEqual(result);
  expect(ai.analyze).toHaveBeenCalledTimes(1);
  expect(ai.readPage).toHaveBeenCalledTimes(1);
  const answers = {
    id: i.requestId,
    answers: Array(5).fill("서버에 예약을 보내고 결과를 확인합니다."),
  };
  await service.review("user:a", "network", answers, signal());
  await service.review("user:a", "network", answers, signal());
  expect(ai.assess).toHaveBeenCalledTimes(1);
  const [record] = await store.queries.projectChecks.list("user:a");
  expect(record.review?.assessment.score).toBe(50);
  expect(await store.queries.projectChecks.list("user:b")).toEqual([]);
  await expect(service.review("user:b", "network", answers, signal())).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    service.create("user:a", "network", { ...i, description: "changed" }, signal()),
  ).rejects.toThrow();
  await expect(
    service.review(
      "user:a",
      "network",
      { ...answers, answers: Array(5).fill("different") },
      signal(),
    ),
  ).rejects.toThrow();
  expect((await store.queries.projectChecks.usage("user:a")).analysis.remaining).toBe(1);
  await store.queries.projectChecks.remove("user:b", i.requestId);
  expect(await store.queries.projectChecks.get("user:a", i.requestId)).not.toBeNull();
  await store.queries.projectChecks.remove("user:a", i.requestId);
  expect(await store.queries.projectChecks.list("user:a")).toEqual([]);
  expect(await store.queries.projectChecks.review("user:a", i.requestId)).toBeUndefined();
});
it("limits concurrent distinct analyses to two, and keeps failed paid calls counted", async () => {
  const service = new ProjectCheckService(store, ai);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => service.create("user:a", "network", input(), signal())),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
  expect(ai.analyze).toHaveBeenCalledTimes(2);
  expect((await store.queries.projectChecks.usage("user:a")).analysis.remaining).toBe(0);
  ai.analyze.mockRejectedValue(new Error("provider unavailable"));
  await expect(service.create("user:b", "network", input(), signal())).rejects.toThrow(
    "provider unavailable",
  );
  expect((await store.queries.projectChecks.usage("user:b")).analysis.remaining).toBe(1);
});
it("does not charge AI quota when a page cannot be read or has insufficient evidence", async () => {
  const service = new ProjectCheckService(store, ai);
  ai.readPage.mockRejectedValueOnce(new Error("unreachable"));
  await expect(service.create("user:a", "network", input(), signal())).rejects.toThrow();
  ai.readPage.mockResolvedValue({ ...fixtureCheck.page, text: "Loading", limited: true });
  await expect(service.create("user:a", "network", input(), signal())).rejects.toMatchObject({
    status: 422,
  });
  expect((await store.queries.projectChecks.usage("user:a")).analysis.remaining).toBe(2);
  expect(ai.analyze).not.toHaveBeenCalled();
});
it("fences stale completion and deletion during review with conditional SQL", async () => {
  const id = randomUUID(),
    old = store.startJob("user:a", id, "project-analysis", "same");
  if (old.state !== "new") throw new Error();
  store.db.prepare("UPDATE jobs SET expires=0 WHERE id=?").run(id);
  const current = store.startJob("user:a", id, "project-analysis", "same");
  if (current.state !== "new") throw new Error();
  await expect(
    store.queries.projectChecks.complete(old.lease, { ...fixtureCheck, id }),
  ).rejects.toThrow();
  expect(store.failJob(old.lease)).toBe(false);
  await store.queries.projectChecks.complete(current.lease, { ...fixtureCheck, id });
  const review = store.startJob("user:a", `project-review-${id}`, `project-review:${id}`, "same");
  if (review.state !== "new") throw new Error();
  await store.queries.projectChecks.remove("user:a", id);
  await expect(
    store.queries.projectChecks.complete(review.lease, {
      answers: [],
      assessment: fixtureAssessment,
    }),
  ).rejects.toThrow();
});
it("rejects fabricated citations and duplicate categories, bounds score and leaves unanswered items ungraded", () => {
  expect(validateAnalysis(structuredClone(fixtureAnalysis), fixtureCheck.page, "")).toBeTruthy();
  const fabricated = structuredClone(fixtureAnalysis);
  fabricated.questions[0].evidence = "secret database";
  expect(() => validateAnalysis(fabricated, fixtureCheck.page, "")).toThrow();
  const duplicate = structuredClone(fixtureAnalysis);
  duplicate.questions[0].area = duplicate.questions[1].area;
  expect(() => validateAnalysis(duplicate, fixtureCheck.page, "")).toThrow();
  expect(publicCheck(fixtureCheck).analysis.questions.every((q) => !("criteria" in q))).toBe(true);
});

projectContract(() => store);

it("project deletion cannot remove an unrelated AI job owned by the same account", async () => {
  const id = randomUUID();
  store.startJob("user:a", id, "generate", "input");
  await store.queries.projectChecks.remove("user:a", id);
  expect(store.startJob("user:a", id, "generate", "input").state).toBe("pending");
});

it("accepts metadata-backed public apps with an empty owner description and preserves provenance in backups", async () => {
  const service = new ProjectCheckService(store, ai);
  ai.readPage.mockResolvedValue({ ...fixtureCheck.page, limited: true, source: "metadata" });
  const result = await service.create("user:metadata", "network", input(), signal());
  expect(result.page.source).toBe("metadata");
  expect(result.page.limited).toBe(true);
  expect(ai.analyze).toHaveBeenCalledTimes(1);
  expect(ai.analyze.mock.calls[0][1]).toBe("");
  const backup = store.exportBackup("user:metadata");
  store.importBackup("user:restored", backup);
  const [restored] = await store.queries.projectChecks.list("user:restored");
  expect(restored.page.source).toBe("metadata");
  expect(restored.page.limited).toBe(true);
});
