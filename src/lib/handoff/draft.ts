import { z } from "zod";
import { trainingSchema, type TrainingDraft } from "./training";

export const HANDOFF_MIN_LENGTH = 20;
export const HANDOFF_FIELDS = [
  {
    key: "understanding",
    label: "구조 이해",
    prompt: "입력부터 출력까지의 흐름과 상태를 누가 소유하는지 설명하세요.",
    outline: "입력과 출력:\n처리 흐름:\n상태가 생성되고 유지되는 범위:",
    max: 2000,
  },
  {
    key: "diagnosis",
    label: "문제 판단",
    prompt:
      "구체적인 입력, 기존 코드의 결과와 기대 결과를 비교하고 원인을 설명하세요. 정상 동작은 유지할 근거를 적으세요.",
    outline: "재현 입력:\n원래 결과와 기대 결과:\n원인이 되는 코드 또는 유지해야 할 정상 동작:",
    max: 2000,
  },
  {
    key: "verification",
    label: "검증 계획과 테스트",
    prompt:
      "입력, 기대 결과, 회귀 테스트 코드를 적으세요. 실행하지 않았다면 미실행이라고 명시하세요.",
    outline:
      "준비 환경과 대상 함수 연결:\n정상 및 경계 입력, 기대 결과:\n회귀 테스트 코드:\n실행 여부와 확인하지 못한 점:",
    max: 4000,
  },
  {
    key: "decision",
    label: "인수인계 판단",
    prompt: "변경한 부분, 유지한 부분, 남은 위험과 배포 전 확인할 내용을 정리하세요.",
    outline:
      "변경한 부분과 유지한 부분:\n적용 범위와 남은 위험:\n다음 개발자가 배포 전에 확인할 사항:",
    max: 2000,
  },
] as const;
export type HandoffField = (typeof HANDOFF_FIELDS)[number];
export type HandoffNotes = Record<HandoffField["key"], string>;
const handoffNotesSchema = z
  .object(
    Object.fromEntries(
      HANDOFF_FIELDS.map((field) => [field.key, z.string().max(field.max)]),
    ) as Record<HandoffField["key"], z.ZodString>,
  )
  .strict();
export function missingHandoffFields(notes: HandoffNotes) {
  return HANDOFF_FIELDS.filter((field) => notes[field.key].trim().length < HANDOFF_MIN_LENGTH);
}
export function handoffMissingMessage(fields: readonly HandoffField[]) {
  return `다음 항목을 각각 ${HANDOFF_MIN_LENGTH}자 이상 작성해 주세요: ${fields.map((field) => field.label).join(", ")}`;
}

const marker = "\n// CODEFIT_HANDOFF_V1 ";
const trainingMarker = "\n// CODEFIT_HANDOFF_V2 ";
const envelope = z.object({ notes: handoffNotesSchema, training: trainingSchema }).strict();
const empty = (): HandoffNotes => ({
  understanding: "",
  diagnosis: "",
  verification: "",
  decision: "",
});

/** One code revision protects the implementation AND report; no timestamp-based merge. */
export function readHandoffDraft(value: string): {
  implementation: string;
  notes: HandoffNotes;
  training?: TrainingDraft;
} {
  const trainingIndex = value.lastIndexOf(trainingMarker);
  if (trainingIndex >= 0) {
    const parsed = (() => {
      try {
        return envelope.safeParse(JSON.parse(value.slice(trainingIndex + trainingMarker.length)));
      } catch {
        return null;
      }
    })();
    if (parsed?.success) return { implementation: value.slice(0, trainingIndex), ...parsed.data };
  }
  const index = value.lastIndexOf(marker);
  if (index >= 0) {
    try {
      const notes = handoffNotesSchema.parse(JSON.parse(value.slice(index + marker.length)));
      return { implementation: value.slice(0, index), notes };
    } catch {
      /* Unrecognized legacy/user text is preserved verbatim, never discarded. */
    }
  }
  return { implementation: value, notes: empty() };
}
export function writeHandoffDraft(
  implementation: string,
  notes: HandoffNotes,
  training?: TrainingDraft,
) {
  // JSON escapes newlines, so report text cannot escape this JavaScript line comment.
  return (
    implementation +
    (training ? trainingMarker : marker) +
    JSON.stringify(training ? envelope.parse({ notes, training }) : handoffNotesSchema.parse(notes))
      .replaceAll("\u2028", "\\u2028")
      .replaceAll("\u2029", "\\u2029")
  );
}
export function formatHandoffDraft(value: string) {
  const { implementation, notes, training } = readHandoffDraft(value);
  return [
    implementation,
    ...HANDOFF_FIELDS.map((f) => `\n[${f.label}]\n${notes[f.key] || "미작성"}`),
    ...(training ? [formatTraining(training)] : []),
  ].join("\n");
}

export function formatTraining(t: TrainingDraft) {
  return [
    "[코드 이해 훈련]",
    `예측 선택: ${t.prediction.choice || "미선택"}`,
    `예측 이유: ${t.prediction.reason || "미작성"}`,
    `예측 확정: ${t.prediction.locked ? "예" : "아니요"}`,
    `원본 관찰: ${t.observation?.actual ?? "미실행"}`,
    ...(t.run?.results.map((r) => `테스트 ${r.id} (${r.status}): ${r.actual}`) ?? []),
    ...(t.coach ? [`AI 질문: ${t.coach.question}`] : []),
    ...(t.coach?.focus
      ? [
          ...(t.coach.focus.learnerQuote === null
            ? []
            : [`질문 당시 내 설명: ${t.coach.focus.learnerQuote}`]),
          `질문으로 확인할 점: ${t.coach.focus.goal}`,
        ]
      : []),
    ...(t.experiment
      ? [
          `추가 실험 코드: ${t.experiment.expression || "미작성"}`,
          `추가 실험 예상: ${t.experiment.prediction || "미작성"}`,
          ...(t.experiment.reflection
            ? [
                `실험 후 알게 된 점: ${t.experiment.reflection.text || "미작성"}`,
                `설명이 연결된 실험: ${t.experiment.reflection.runHash}`,
              ]
            : []),
          ...(t.experiment.run
            ? [
                `마지막 실행식: ${t.experiment.run.expression}`,
                `실행 당시 예상: ${t.experiment.run.prediction || "미작성"}`,
                `실험 원본 (${t.experiment.run.original.status}): ${t.experiment.run.original.actual}`,
                `실험 수정 코드 (${t.experiment.run.current.status}): ${t.experiment.run.current.actual}`,
                `실험 출처: ${t.experiment.run.sourceHash}; 수정 코드: ${t.experiment.run.codeHash}; 실행기: ${t.experiment.run.suiteVersion}`,
                "마지막 실행 당시의 기록입니다. 현재 코드나 실험 조건과 다를 수 있습니다.",
              ]
            : ["추가 실험: 미실행"]),
        ]
      : []),
  ].join("\n");
}
