import type { AttemptSummary, ProblemSummary, ProgressSummary } from "./problem";
const dayMs = 86400000;
// Learning days follow the service's Korean calendar, including UTC date boundaries.
function dayIndex(date: string | number) { return Math.floor((new Date(date).getTime() + 9 * 3600000) / dayMs); }
export function trainingSummary(attempts: AttemptSummary[], now = Date.now()) {
  const today = dayIndex(now);
  const days = new Set(attempts.map(a => dayIndex(a.createdAt)).filter(d => Number.isFinite(d) && d <= today));
  let cursor = days.has(today) ? today : today - 1, streak = 0;
  while (days.has(cursor)) { streak++; cursor--; }
  return { streak, activeDays: [...days].filter(d => d >= today - 6).length,
    independentSolved: new Set(attempts.filter(a => a.review.passed && !a.assisted && Number.isFinite(dayIndex(a.createdAt)) && dayIndex(a.createdAt) <= today).map(a => a.problemId)).size,
    week: Array.from({ length: 7 }, (_, i) => ({ label: new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short", month: "numeric", day: "numeric" }).format(new Date((today - 6 + i) * dayMs)), active: days.has(today - 6 + i) })) };
}
export function recommendProblem(problems: ProblemSummary[], progress: Record<string, ProgressSummary>) {
  const resumable = problems.filter(p => progress[p.id]?.status === "in-progress").sort((a,b) => progress[b.id].updatedAt.localeCompare(progress[a.id].updatedAt));
  return resumable[0] || problems.filter(p => progress[p.id]?.status !== "solved").sort((a,b) => a.minutes - b.minutes)[0] || problems[0];
}
