import type { Progress } from "../problem";
import { MISSIONS, type Mission } from "./catalog";
import { canComplete, readLearning, type LearningRecord } from "./progress";
import { domainFor, SERVICE_DOMAINS } from "./services/domains";
import type { ServiceDomain } from "./services/types";
export const LEARNING_STAGES = ["예상하기", "직접 확인", "수정과 검사", "응용하기"];
/** Sections in recommended order: the first recommended mission is a basics mission. */
export const MISSION_SECTIONS = ["foundation", "lab"] as const;

export function missionDomain(value: unknown): ServiceDomain | undefined {
  return SERVICE_DOMAINS.find((domain) => domain.id === value)?.id;
}
/**
 * The next mission in the same section (basics or labs). When the list was filtered by a
 * service domain (`?domain=`), the next mission stays in that domain as well.
 */
export function nextMission(mission: Mission, domain?: ServiceDomain) {
  const scoped = domain && domainFor(mission) === domain ? domain : undefined;
  const section = MISSIONS.filter(
    (m) => m.kind === mission.kind && (!scoped || domainFor(m) === scoped),
  );
  const index = section.findIndex((m) => m.id === mission.id);
  return index >= 0 ? section[index + 1] : undefined;
}
export function hasLearningDraft(record: LearningRecord) {
  return record.locked || record.prediction >= 0 || Boolean(record.reason.trim());
}
export function learningOverview(progress: Progress[]) {
  const records = new Map(progress.map((p) => [p.problemId, p]));
  const missions = MISSIONS.map((mission) => {
    const saved = records.get(`learn:${mission.id}`);
    const record = readLearning(saved?.code);
    return {
      mission,
      record,
      updatedAt: saved?.updatedAt || "",
      completed: record.completed && canComplete(mission, record),
    };
  });
  const resume = missions
    .filter((m) => !m.completed && hasLearningDraft(m.record))
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return {
    missions,
    resume,
    next: resume || missions.find((m) => !m.completed) || missions[0],
    complete: missions.filter((m) => m.completed).length,
  };
}
