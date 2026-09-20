import { AI_LESSONS, type AiLessonId } from "./catalog";

export type AiProgress = { step: 0 | 1 | 2; experiment: number | null; completed: boolean };
export type AiProgressMap = Partial<Record<AiLessonId, AiProgress>>;
export const EMPTY_AI_PROGRESS: AiProgress = { step: 0, experiment: null, completed: false };
export const AI_PROGRESS_KEY = "codefit.ai-learning.v1";

export function parseAiProgress(raw: string | null): AiProgressMap {
  try {
    const data = JSON.parse(raw || "null");
    if (data?.version !== 1 || !data.lessons || typeof data.lessons !== "object") return {};
    const entries: AiProgressMap = {};
    for (const lesson of AI_LESSONS) {
      const record = data.lessons[lesson.id];
      if (!record || ![0, 1, 2].includes(record.step)) continue;
      const experiment =
        Number.isInteger(record.experiment) && record.experiment >= 0 && record.experiment < 3
          ? record.experiment
          : null;
      entries[lesson.id] = {
        step: record.step === 2 && experiment === null ? 1 : record.step,
        experiment,
        completed: record.completed === true && experiment !== null,
      };
    }
    return entries;
  } catch {
    return {};
  }
}

export function filterAiLessons(query: string, track: string, level: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return AI_LESSONS.filter((lesson) => {
    const text = [lesson.title, lesson.summary, ...lesson.tools].join(" ").toLocaleLowerCase();
    return (
      (track === "all" || lesson.track === track) &&
      (level === "all" || lesson.level === level) &&
      words.every((word) => text.includes(word))
    );
  });
}
