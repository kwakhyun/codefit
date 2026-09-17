import type { Progress } from "../problem";
import { MISSIONS } from "./catalog";
import { canComplete, readLearning, type LearningRecord } from "./progress";
export const LEARNING_STAGES = ["예상하기", "직접 확인", "수정과 검사", "응용하기"];
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
