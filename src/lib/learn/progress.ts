import { z } from "zod";
import { ACTION_LABELS, type Action, type Mission } from "./catalog";
import { reproduced, simulate, verification } from "./simulation";
export const requestFields = [
  { key: "where", label: "어디에서 문제가 생겼나요?", placeholder: "예: 예약 화면에서" },
  { key: "steps", label: "무엇을 했을 때 생겼나요?", placeholder: "실제로 눌렀던 순서와 조건" },
  {
    key: "actual",
    label: "실제 결과는 무엇인가요?",
    placeholder: "화면과 저장된 데이터에서 확인한 결과",
  },
  { key: "expected", label: "어떻게 동작해야 하나요?", placeholder: "수정 후 확인할 수 있는 결과" },
  {
    key: "keep",
    label: "어떤 동작은 유지해야 하나요?",
    placeholder: "정상 사용과 실패 후 재시도 등",
  },
] as const;
export const coachSchema = z
  .object({ question: z.string().min(1).max(500), nextCheck: z.string().min(1).max(500) })
  .strict();
export const learningSchema = z
  .object({
    version: z.literal(1),
    stage: z.number().int().min(0).max(3),
    prediction: z.number().int().min(-1).max(2),
    reason: z.string().max(800),
    locked: z.boolean(),
    actions: z.array(z.enum(Object.keys(ACTION_LABELS) as [Action, ...Action[]])).max(80),
    fix: z.string().max(30),
    checked: z.array(z.string().max(30)).max(8),
    hints: z.number().int().min(0).max(3),
    request: z
      .object({
        where: z.string().max(500),
        steps: z.string().max(500),
        actual: z.string().max(500),
        expected: z.string().max(500),
        keep: z.string().max(500),
      })
      .strict(),
    transfer: z.number().int().min(-1).max(2),
    reflection: z.string().max(1000),
    completed: z.boolean(),
    coach: z.object({ reply: coachSchema, snapshot: z.string().max(8000) }).nullable(),
  })
  .strict();
export type LearningRecord = z.infer<typeof learningSchema>;
export type LearningRecordUpdate = (change: (record: LearningRecord) => LearningRecord) => void;
export function emptyLearning(): LearningRecord {
  return {
    version: 1,
    stage: 0,
    prediction: -1,
    reason: "",
    locked: false,
    actions: [],
    fix: "",
    checked: [],
    hints: 0,
    request: { where: "", steps: "", actual: "", expected: "", keep: "" },
    transfer: -1,
    reflection: "",
    completed: false,
    coach: null,
  };
}
export function readLearning(raw?: string | null): LearningRecord {
  try {
    return learningSchema.parse(JSON.parse(raw || ""));
  } catch {
    return emptyLearning();
  }
}
export function requestReady(r: LearningRecord) {
  return requestFields.every((f) => r.request[f.key].trim().length >= 3);
}
export function checksPassed(m: Mission, r: LearningRecord) {
  return !!r.fix && verification(m, r.fix).every((c) => c.passed && r.checked.includes(c.id));
}
export function canComplete(m: Mission, r: LearningRecord) {
  return (
    r.locked &&
    r.prediction >= 0 &&
    reproduced(m, r.actions) &&
    checksPassed(m, r) &&
    (m.kind !== "lab" || requestReady(r)) &&
    r.transfer === m.transfer.answer &&
    r.reflection.trim().length >= 10
  );
}
export function validLearning(m: Mission, r: LearningRecord) {
  return (
    r.actions.every((a) => m.actions.includes(a)) &&
    (!r.fix || m.fixes.some((f) => f.id === r.fix)) &&
    (!r.locked || r.prediction >= 0) &&
    r.checked.every((id) => verification(m, r.fix).some((c) => c.id === id)) &&
    (!r.completed || canComplete(m, r))
  );
}
export function learningSummary(m: Mission, r: LearningRecord) {
  return `${m.title}\n예측: ${m.choices[r.prediction] || "작성 전"}\n이유: ${r.reason}\n\n관찰\n${simulate(m, r.actions).trace.join("\n")}\n\n수정 요청\n${requestFields.map((f) => `${f.label}\n${r.request[f.key]}`).join("\n")}\n\n선택한 수정: ${m.fixes.find((f) => f.id === r.fix)?.title || "없음"}\n확인한 검사: ${r.checked.join(", ")}\n\n배운 점: ${r.reflection}`;
}
export function coachSnapshot(m: Mission, r: LearningRecord) {
  return JSON.stringify({
    id: m.id,
    prediction: r.prediction,
    reason: r.reason,
    actions: r.actions,
    request: r.request,
    fix: r.fix,
  });
}
