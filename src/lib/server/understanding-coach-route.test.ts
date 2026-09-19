import { createHash, randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { handoffProblems } from "../../data/handoff-problems";
import {
  emptyTraining,
  observationSourceText,
  type TrainingDraft,
  type CoachingEvidence,
} from "../handoff/training";
import { experimentInput } from "./experiment-fixture.test-helper";
import { readHandoffDraft, writeHandoffDraft } from "../handoff/draft";
import { learningLab } from "./learning-lab";
const { getStore, requireProblem, aiLimit, coach } = vi.hoisted(() => ({
  getStore: vi.fn(),
  requireProblem: vi.fn(),
  aiLimit: vi.fn(),
  coach: vi.fn(),
}));
vi.mock("./database", () => ({ getStore }));
vi.mock("./problem-access", () => ({ requireProblem, aiLimit }));
vi.mock("./session", () => ({ session: async () => ({ owner: "owner" }) }));
vi.mock("./ai-coach", () => ({ coachUnderstanding: coach, COACH_PROMPT_VERSION: "fixture" }));
import { POST } from "../../app/api/problems/[id]/coach/route";
const problem = handoffProblems.find((p) => p.id === "handoff-cart")!;
const lab = learningLab(problem);
const fingerprint = (source: string, spec = lab) =>
  createHash("sha256").update(observationSourceText(source, spec)).digest("hex");
const training = () => ({
  ...emptyTraining(),
  prediction: { choice: "preserved", reason: "참조를 비교하겠습니다.", locked: true },
  observation: { id: "prediction", status: "ok" as const, actual: "[3,3]" },
  observationSource: fingerprint(problem.starterCode),
});
const call = (
  t: TrainingDraft,
  evidence: CoachingEvidence = "prediction",
  code = "while (true) {}",
) =>
  POST(
    new Request("https://codefit.test/api/problems/handoff-cart/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: randomUUID(),
        evidence,
        code: writeHandoffDraft(code, readHandoffDraft("").notes, t),
      }),
    }),
    { params: Promise.resolve({ id: problem.id }) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  requireProblem.mockResolvedValue(problem);
});
it("rejects stale follow-up evidence before quota/jobs and separates initial and experiment request fingerprints", async () => {
  const data = experimentInput();
  expect((await call(data.training, "experiment", "while(true){}")).status).toBe(400);
  expect(getStore).not.toHaveBeenCalled();
  expect(coach).not.toHaveBeenCalled();
  expect(aiLimit).not.toHaveBeenCalled();
  const result = {
    evidenceId: "experiment",
    observation: "두 실험 결과입니다.",
    question: "다른 입력에서도 확인할까요?",
    nextCheck: "수량 0인 항목을 비교해 보세요.",
  };
  const store = {
    startJob: vi.fn().mockResolvedValue({ state: "done", result: JSON.stringify(result) }),
  };
  getStore.mockResolvedValue(store);
  expect((await call(data.training, "experiment", data.currentCode)).status).toBe(200);
  const followupFingerprint = store.startJob.mock.calls[0][3];
  await call(data.training, "prediction", data.currentCode);
  expect(store.startJob.mock.calls[1][3]).not.toBe(followupFingerprint);
  expect(coach).not.toHaveBeenCalled();
  expect(aiLimit).not.toHaveBeenCalled();
  store.startJob.mockResolvedValue({ state: "new", lease: {} } as never);
  getStore.mockResolvedValue({
    ...store,
    queries: { recordAiRun: vi.fn() },
    completeCoaching: vi.fn(),
    failJob: vi.fn(),
  });
  coach.mockResolvedValue(result);
  expect((await call(data.training, "experiment", data.currentCode)).status).toBe(200);
  expect(coach).toHaveBeenCalledWith(
    expect.objectContaining({ evidence: "experiment", training: data.training }),
    expect.any(Function),
  );
  expect(aiLimit).toHaveBeenCalledTimes(1);
});
it.each(["missing", "different-code", "different-probe", "different-version"])(
  "rejects %s observation provenance before storage, quota or paid calls",
  async (kind) => {
    const t = training();
    if (kind === "missing") Reflect.deleteProperty(t, "observationSource");
    if (kind === "different-code") t.observationSource = fingerprint("another source");
    if (kind === "different-probe")
      t.observationSource = fingerprint(problem.starterCode, {
        ...lab,
        probe: { ...lab.probe, expression: "42" },
      });
    if (kind === "different-version")
      t.observationSource = fingerprint(problem.starterCode, { ...lab, version: "old" });
    const response = await call(t);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("다시 실행") });
    expect(getStore).not.toHaveBeenCalled();
    expect(aiLimit).not.toHaveBeenCalled();
    expect(coach).not.toHaveBeenCalled();
  },
);
it("rejects an incompatible result even with a matching source hash, before quota or AI", async () => {
  const t = training();
  t.observation.actual = "[2,3]";
  const response = await call(t);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("다시 실행") });
  expect(getStore).not.toHaveBeenCalled();
  expect(aiLimit).not.toHaveBeenCalled();
  expect(coach).not.toHaveBeenCalled();
});
it("rejects a changed stored starter rather than applying a different source's expectation", async () => {
  const changed = { ...problem, starterCode: problem.solution };
  requireProblem.mockResolvedValue(changed);
  const t = training();
  t.observationSource = fingerprint(changed.starterCode);
  const response = await call(t);
  expect(response.status).toBe(409);
  expect(getStore).not.toHaveBeenCalled();
  expect(coach).not.toHaveBeenCalled();
});
it("passes the declared contract and current reported observation without executing edited code", async () => {
  const lease = { id: "lease" };
  const store = {
    startJob: vi.fn().mockResolvedValue({ state: "new", lease }),
    queries: { recordAiRun: vi.fn() },
    completeCoaching: vi.fn(),
    failJob: vi.fn(),
  };
  getStore.mockResolvedValue(store);
  const reply = {
    evidenceId: "prediction",
    observation: "표시된 결과입니다.",
    question: "참조를 비교해 볼까요?",
    nextCheck: "두 객체를 비교하세요.",
    experiment: {
      expression:
        "(() => { const items = [{id:'a',quantity:2}]; return changeQuantity(items,'a',1); })()",
    },
  };
  coach.mockResolvedValue(reply);
  const response = await call(training());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(reply);
  expect(coach).toHaveBeenCalledWith(
    expect.objectContaining({
      originalCode: problem.starterCode,
      currentCode: "while (true) {}",
      lab: expect.objectContaining({ contract: lab.contract }),
    }),
    expect.any(Function),
  );
  expect(aiLimit).toHaveBeenCalledTimes(1);
  expect(store.completeCoaching).toHaveBeenCalledWith(lease, problem.id, JSON.stringify(reply));
});
it.each([false, true])(
  "replays a saved reply (experiment=%s) without a second AI call or quota",
  async (withExperiment) => {
    const reply = {
      evidenceId: "prediction",
      observation: "이전 실행 결과입니다.",
      question: "참조를 비교해 볼까요?",
      nextCheck: "원본 함수를 호출해 보세요.",
      ...(withExperiment
        ? {
            experiment: { expression: "changeQuantity([{id:'a',quantity:2}],'a',1)" },
            focus: {
              learnerQuote: "참조를 비교하겠습니다.",
              goal: "원본과 반환값의 참조를 확인합니다.",
            },
          }
        : {}),
    };
    getStore.mockResolvedValue({
      startJob: vi.fn().mockResolvedValue({ state: "done", result: JSON.stringify(reply) }),
    });
    const response = await call(training());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(reply);
    expect(aiLimit).not.toHaveBeenCalled();
    expect(coach).not.toHaveBeenCalled();
  },
);
