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
  expect((await store.queries.projectChecks.usage("user:a")).analysis.remaining).toBe(4);
  await store.queries.projectChecks.remove("user:b", i.requestId);
  expect(await store.queries.projectChecks.get("user:a", i.requestId)).not.toBeNull();
  await store.queries.projectChecks.remove("user:a", i.requestId);
  expect(await store.queries.projectChecks.list("user:a")).toEqual([]);
  expect(await store.queries.projectChecks.review("user:a", i.requestId)).toBeUndefined();
});
it("limits concurrent distinct member analyses to five, and keeps failed paid calls counted", async () => {
  const service = new ProjectCheckService(store, ai);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => service.create("user:a", "network", input(), signal())),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
  expect(ai.analyze).toHaveBeenCalledTimes(5);
  expect((await store.queries.projectChecks.usage("user:a")).analysis.remaining).toBe(0);
  ai.analyze.mockRejectedValue(new Error("provider unavailable"));
  await expect(service.create("user:b", "network", input(), signal())).rejects.toThrow(
    "provider unavailable",
  );
  expect((await store.queries.projectChecks.usage("user:b")).analysis.remaining).toBe(4);
});
it("does not charge AI quota when a page cannot be read or has insufficient evidence", async () => {
  const service = new ProjectCheckService(store, ai);
  ai.readPage.mockRejectedValueOnce(new Error("unreachable"));
  await expect(service.create("user:a", "network", input(), signal())).rejects.toThrow();
  ai.readPage.mockResolvedValue({ ...fixtureCheck.page, text: "Loading", limited: true });
  await expect(service.create("user:a", "network", input(), signal())).rejects.toMatchObject({
    status: 422,
  });
  expect((await store.queries.projectChecks.usage("user:a")).analysis.remaining).toBe(5);
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

it("preserves original answers while creating replayable same-question revisions without analysis quota", async () => {
  const service = new ProjectCheckService(store, ai);
  const i = input();
  await service.create("user:a", "network", i, signal());
  const answers = Array(5).fill("최초 설명입니다.");
  await service.review("user:a", "network", { id: i.requestId, answers }, signal());
  const id = randomUUID();
  const revised = await service.revise("user:a", i.requestId, id);
  expect(await service.revise("user:a", i.requestId, id)).toEqual(revised);
  expect(revised.previousReview?.answers).toEqual(answers);
  expect(revised.analysis).toEqual(publicCheck(fixtureCheck).analysis);
  expect(revised.revisionNumber).toBe(1);
  expect(revised.review).toBeUndefined();
  expect(ai.analyze).toHaveBeenCalledTimes(1);
  expect((await store.queries.projectChecks.usage("user:a")).analysis.remaining).toBe(4);
  await expect(service.revise("user:b", i.requestId, randomUUID())).rejects.toMatchObject({
    status: 404,
  });
  await service.review(
    "user:a",
    "network",
    { id, answers: Array(5).fill("보완한 설명입니다.") },
    signal(),
  );
  expect((await store.queries.projectChecks.review("user:a", i.requestId))?.answers).toEqual(
    answers,
  );
  expect(ai.assess).toHaveBeenCalledTimes(2);
  expect((await store.queries.projectChecks.usage("user:a")).review.remaining).toBe(10);
});
it("saves owner-scoped project evidence with optimistic concurrency and preserves training", async () => {
  const service = new ProjectCheckService(store, ai);
  const i = input();
  await service.create("user:a", "network", i, signal());
  await service.review(
    "user:a",
    "network",
    { id: i.requestId, answers: Array(5).fill("설명") },
    signal(),
  );
  const old = store.db
    .prepare("SELECT result FROM jobs WHERE id=?")
    .get(`project-review-${i.requestId}`) as { result: string };
  const training = { version: 1, revision: 0, modules: {} };
  store.db
    .prepare("UPDATE jobs SET result=? WHERE id=?")
    .run(JSON.stringify({ ...JSON.parse(old.result), training }), `project-review-${i.requestId}`);
  const practice = {
    revision: 0,
    tasks: Array.from({ length: 5 }, (_, questionIndex) => ({
      questionIndex,
      status: "planned" as const,
      result: "이 프로젝트에서 직접 확인할 계획",
    })),
  };
  await expect(
    store.queries.projectChecks.savePractice("user:b", i.requestId, practice),
  ).rejects.toMatchObject({ status: 404 });
  const saved = await store.queries.projectChecks.savePractice("user:a", i.requestId, practice);
  expect(saved.revision).toBe(1);
  expect(await store.queries.projectChecks.savePractice("user:a", i.requestId, practice)).toEqual(
    saved,
  );
  await expect(
    store.queries.projectChecks.savePractice("user:a", i.requestId, {
      ...practice,
      tasks: practice.tasks.map((t) => ({ ...t, result: "다른 변경" })),
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await store.queries.projectChecks.detail("user:a", i.requestId))?.review?.practice,
  ).toEqual(saved);
  const row = store.db
    .prepare("SELECT result FROM jobs WHERE id=?")
    .get(`project-review-${i.requestId}`) as { result: string };
  expect(JSON.parse(row.result).training).toEqual(training);
});
it("does not expose screenshot bytes or captured text in history responses", () => {
  const result = publicCheck({
    ...fixtureCheck,
    page: {
      ...fixtureCheck.page,
      source: "rendered",
      captures: [{ url: "https://example.com/", title: "화면", text: "본문", screenshot: "YWJj" }],
    },
  });
  expect(result.page.captures).toEqual([
    { url: "https://example.com/", title: "화면", hasScreenshot: true },
  ]);
  expect(JSON.stringify(result)).not.toContain("YWJj");
});

it("accepts a short but successfully rendered public screen without a forced description", async () => {
  ai.readPage.mockResolvedValue({
    ...fixtureCheck.page,
    source: "rendered",
    limited: true,
    text: "짧은 서비스 홈 화면",
    captures: [
      {
        url: "https://example.com/",
        title: "화면",
        text: "짧은 서비스 홈 화면",
        screenshot: "YWJj",
      },
    ],
  });
  const service = new ProjectCheckService(store, ai);
  await service.create("user:a", "network", input(), signal());
  expect(ai.analyze).toHaveBeenCalledTimes(1);
});
it("cannot finish copying a revision after its source was deleted", async () => {
  const service = new ProjectCheckService(store, ai);
  const i = input();
  await service.create("user:a", "network", i, signal());
  const original = await store.queries.projectChecks.get("user:a", i.requestId);
  const id = randomUUID();
  const claim = store.startJob("user:a", id, "project-analysis", "revision");
  if (claim.state !== "new") throw Error();
  await store.queries.projectChecks.remove("user:a", i.requestId);
  await expect(
    store.queries.projectChecks.complete(claim.lease, { ...original!, id }, i.requestId),
  ).rejects.toThrow();
});

it("allows three guest analyses while keeping the two-review limit", async () => {
  const service = new ProjectCheckService(store, ai),
    owner = "visitor:guest";
  for (let index = 0; index < 2; index++) {
    const i = input();
    await service.create(owner, "guest-network", i, signal());
    const answers = {
      id: i.requestId,
      answers: Array(5).fill("서버의 저장 결과를 직접 확인했습니다."),
    };
    await service.review(owner, "guest-network", answers, signal());
    await service.review(owner, "guest-network", answers, signal());
    await expect(
      service.review("visitor:other", "guest-network", answers, signal()),
    ).rejects.toMatchObject({ status: 404 });
  }
  expect(ai.analyze).toHaveBeenCalledTimes(2);
  expect(ai.assess).toHaveBeenCalledTimes(2);
  await service.create(owner, "guest-network", input(), signal());
  expect(ai.analyze).toHaveBeenCalledTimes(3);
  expect(await store.queries.projectChecks.usage(owner)).toMatchObject({
    analysis: { remaining: 0 },
    review: { remaining: 0 },
  });
  await expect(service.create(owner, "guest-network", input(), signal())).rejects.toMatchObject({
    status: 429,
  });
  await expect(
    service.create("visitor:new-cookie", "guest-network", input(), signal()),
  ).rejects.toMatchObject({ status: 429 });
  expect(await store.queries.projectChecks.list("visitor:other")).toEqual([]);
  expect((await store.queries.projectChecks.usage("user:member")).analysis.remaining).toBe(5);
});

it("accepts a bounded repository snapshot without a user description and keeps its code provenance", async () => {
  const repository = {
    name: "owner/repo",
    commit: "a".repeat(40),
    totalFiles: 1,
    eligibleFiles: 1,
    truncatedTree: false,
    omittedFiles: 0,
    files: [
      {
        path: "main.py",
        totalLines: 1,
        partial: false,
        lines: [{ number: 1, text: "return True" }],
      },
    ],
    links: [],
  };
  ai.readPage.mockResolvedValue({
    ...fixtureCheck.page,
    source: "repository",
    limited: true,
    repository,
  });
  const result = await new ProjectCheckService(store, ai).create(
    "user:repo",
    "network",
    input(),
    signal(),
  );
  expect(result.page.repository).toEqual(repository);
  expect(
    (await store.queries.projectChecks.detail("user:repo", result.id))?.page.repository,
  ).toEqual(repository);
  const checked = structuredClone(fixtureAnalysis);
  checked.questions[0] = {
    ...checked.questions[0],
    basis: "page",
    evidence: "main.py:L1 invented()",
  };
  expect(() =>
    validateAnalysis(
      checked,
      { ...fixtureCheck.page, repository, text: "main.py:L1 return True" },
      "",
    ),
  ).toThrow();
});

it("executes a pre-reserved background analysis once and exposes its completed status", async () => {
  const service = new ProjectCheckService(store, ai);
  const request = input();
  const claim = await service.beginAnalysis("user:a", request);
  if (claim.state !== "new") throw new Error("lease");
  expect(await service.beginAnalysis("user:a", request)).toEqual({ state: "pending" });
  expect(ai.analyze).not.toHaveBeenCalled();
  await service.create("user:a", "network", request, signal(), claim.lease);
  expect(await store.queries.projectChecks.analysisStatus("user:a", request.requestId)).toEqual({
    status: "done",
  });
  expect((await service.beginAnalysis("user:a", request)).state).toBe("done");
  expect(ai.analyze).toHaveBeenCalledTimes(1);
  expect((await store.queries.projectChecks.usage("user:a")).analysis.remaining).toBe(4);
});
