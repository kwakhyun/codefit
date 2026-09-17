import type { AttemptSummary } from "../problem";
import { HANDOFF_CRITERIA, HANDOFF_TRACKS, handoffId } from "./catalog";

export const TRANSFER_DELAY_MS = 7 * 86400000;
export type HandoffProgress = { problemId: string; hasDraft: boolean };
export function handoffLearning(
  attempts: AttemptSummary[],
  now = Date.now(),
  progress: HandoffProgress[] = [],
) {
  return HANDOFF_TRACKS.map((track) => {
    const baseId = handoffId(track.key),
      transferId = handoffId(track.key, true);
    const bases = attempts.filter((a) => a.problemId === baseId).sort(newest);
    const base = bases[0],
      firstBase = bases.at(-1);
    const transfers = attempts.filter((a) => a.problemId === transferId).sort(newest);
    const firstTransfer = transfers.at(-1);
    const latest = [base, transfers[0]]
      .filter((a): a is AttemptSummary => Boolean(a))
      .sort(newest)[0];
    // Historical first-transfer eligibility never moves when the base is revisited.
    const transferDueAt = firstBase ? Date.parse(firstBase.createdAt) + TRANSFER_DELAY_MS : null;
    const retention =
      firstTransfer &&
      transferDueAt !== null &&
      Date.parse(firstTransfer.createdAt) >= transferDueAt
        ? firstTransfer.review.passed && !firstTransfer.assisted
          ? "independent"
          : "needs-practice"
        : firstTransfer
          ? "early"
          : null;
    // Repeated practice is distinct from the one-time first-transfer metric.
    const dueAt =
      firstTransfer && latest
        ? new Date(Date.parse(latest.createdAt) + TRANSFER_DELAY_MS).toISOString()
        : transferDueAt !== null
          ? new Date(transferDueAt).toISOString()
          : null;
    const due = Boolean(dueAt && now >= Date.parse(dueAt));
    const draftId = [baseId, transferId].find(
      (id) =>
        progress.some((p) => p.problemId === id && p.hasDraft) &&
        !attempts.some((a) => a.problemId === id),
    );
    const next = draftId
      ? {
          problemId: draftId,
          label: "작성 중인 과제 이어가기",
          reason: "아직 검토하지 않은 코드와 메모가 보관되어 있습니다.",
          priority: 0,
        }
      : due
        ? {
            problemId: transferId,
            label: "7일 복습 시작",
            reason: "7일이 지났습니다. 이전 풀이를 보지 않고 다시 도전해 보세요.",
            priority: 1,
          }
        : latest && !latest.review.passed
          ? {
              problemId: latest.problemId,
              label: "피드백 반영해 다시 풀기",
              reason: "최근 검토에서 보완할 부분을 확인했습니다.",
              priority: 2,
            }
          : !base
            ? {
                problemId: baseId,
                label: "코드 분석 시작",
                reason: "원본 코드의 실행 결과를 예상하는 것부터 시작하세요.",
                priority: 3,
              }
            : {
                problemId: transferId,
                label: firstTransfer ? "변형 과제 이어서 훈련" : "변형 과제 미리 연습",
                reason: firstTransfer
                  ? "기본 과제와 달라진 조건을 확인하고 다시 풀어보세요."
                  : "지금도 연습할 수 있습니다. 기본 과제의 첫 검토일에서 7일이 지나기 전에 제출하면 7일 후 첫 제출 기록에는 포함되지 않습니다.",
                priority: 4,
              };
    return {
      key: track.key,
      base: base ? summary(base) : null,
      latest: latest ? { ...summary(latest), id: latest.id, problemId: latest.problemId } : null,
      weaknesses:
        latest?.review.criteria
          .filter((c) => !c.passed)
          .map((c) => ({
            label: HANDOFF_CRITERIA[c.requirementIndex] ?? "요구사항",
            feedback: c.feedback,
          })) ?? [],
      dueAt,
      due,
      next,
      transfer: transfers[0] ? summary(transfers[0]) : null,
      retention,
    };
  });
}
function summary(attempt: AttemptSummary) {
  return {
    score: attempt.review.score,
    passed: attempt.review.passed,
    assisted: attempt.assisted,
    createdAt: attempt.createdAt,
  };
}
function newest(a: AttemptSummary, b: AttemptSummary) {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}
type HandoffLearning = ReturnType<typeof handoffLearning>;
export type HandoffDashboard = { scope: string; learning: HandoffLearning; generatedAt: string };
