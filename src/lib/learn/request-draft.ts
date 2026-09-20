import { actionLabel, type Mission } from "./catalog";
import type { LearningRecord } from "./progress";
import { simulate } from "./simulation";

function bounded(text: string) {
  return text.length <= 500 ? text : `${text.slice(0, 465)}… (전체 내용은 실행 기록에서 확인)`;
}

/** Copy only observed facts into empty fields; preserve the learner's own decisions. */
export function requestFromObservation(
  mission: Mission,
  record: LearningRecord,
): LearningRecord["request"] {
  if (!record.actions.length) return record.request;
  const observed = simulate(mission, record.actions);
  const draft = {
    where: `예제 서비스: ${mission.title}`,
    steps: record.actions.map((action) => actionLabel(mission, action)).join(" → "),
    actual: observed.message,
  };
  const request = { ...record.request };
  for (const key of ["where", "steps", "actual"] as const) {
    if (!request[key].trim()) request[key] = bounded(draft[key]);
  }
  return request;
}
