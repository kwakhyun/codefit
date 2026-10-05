import { z } from "zod";

const runSchema = z
  .object({
    outcome: z.enum(["not_run", "passed", "failed"]),
    evidence: z.string().trim().max(600),
  })
  .strict();

export const verificationRecordSchema = z
  .object({
    command: z.string().trim().max(300),
    before: runSchema,
    after: runSchema,
    reverted: runSchema,
  })
  .strict();
export type VerificationRecord = z.infer<typeof verificationRecordSchema>;
export const verificationStages = [
  { key: "before", label: "수정 전", expected: "결함 때문에 실패하는지 확인" },
  { key: "after", label: "수정 후", expected: "같은 테스트가 통과하는지 확인" },
  { key: "reverted", label: "수정만 되돌린 사본", expected: "같은 결함으로 다시 실패하는지 확인" },
] as const;

export function emptyVerification(): VerificationRecord {
  return {
    command: "",
    before: { outcome: "not_run", evidence: "" },
    after: { outcome: "not_run", evidence: "" },
    reverted: { outcome: "not_run", evidence: "" },
  };
}

/** User-entered observations never become an automated verification receipt. */
export function verificationStatus(record?: VerificationRecord) {
  if (!record || verificationStages.every(({ key }) => record[key].outcome === "not_run"))
    return {
      state: "not_run",
      label: "테스트 미실행",
      detail: "아직 실행 결과를 기록하지 않았습니다.",
    };
  if (record.after.outcome === "failed")
    return {
      state: "failed",
      label: "수정 후 실패 기록",
      detail: "수정 후에도 실패했습니다. 원인과 기존 기능의 영향을 다시 확인하세요.",
    };
  if (record.before.outcome === "passed" || record.reverted.outcome === "passed")
    return {
      state: "inconclusive",
      label: "결함 구별 여부 확인 필요",
      detail: "수정이 없는 코드에서도 통과했습니다. 테스트가 해당 결함을 잡는지 확인하세요.",
    };
  if (
    !record.command.trim() ||
    verificationStages.some(
      ({ key }) => record[key].outcome === "not_run" || !record[key].evidence.trim(),
    )
  )
    return {
      state: "incomplete",
      label: "검증 기록 부족",
      detail: "동일한 테스트의 실행 방법과 세 단계의 실제 결과가 모두 필요합니다.",
    };
  return {
    state: "recorded",
    label: "재현 패턴 기록됨 (자기 기록)",
    detail:
      "실패 → 통과 → 실패를 기록했습니다. 코드핏이 실행 결과나 실패 원인을 검증한 것은 아닙니다.",
  };
}

export function verificationRecordText(record?: VerificationRecord) {
  const status = verificationStatus(record);
  return [
    `회귀검증 상태: ${status.label}. ${status.detail}`,
    ...(record
      ? [
          `실행 방법: ${record.command || "미작성"}`,
          ...verificationStages.map(
            ({ key, label }) =>
              `${label}: ${record[key].outcome === "not_run" ? "미실행" : record[key].outcome === "passed" ? "통과 기록" : "실패 기록"}\n근거: ${record[key].evidence || "미작성"}`,
          ),
        ]
      : []),
  ].join("\n");
}
