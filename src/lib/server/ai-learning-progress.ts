import { AI_LESSONS, type AiLessonId } from "../ai-learning/catalog";
import { AI_CONTENT } from "../ai-learning/content";
import {
  mergeAiProgress,
  parseAiRecord,
  resolveAiProgress,
  sameAiProgress,
  type AiProgress,
  type AiProgressMap,
} from "../ai-learning/progress";
import type { Progress } from "../problem";
import type { LearningStore } from "./learning-store";
import { CodeConflict } from "./write-conflicts";

/** AI lesson records share `learning_progress` with missions under an `ai:` lesson id. */
const PREFIX = "ai:";
export const aiProgressKey = (id: AiLessonId) => `${PREFIX}${id}`;
export function aiLessonFromKey(key: string): AiLessonId | null {
  if (!key.startsWith(PREFIX)) return null;
  const id = key.slice(PREFIX.length);
  return AI_LESSONS.find((lesson) => lesson.id === id)?.id ?? null;
}
export const isAiProgressRow = (progress: Progress) =>
  progress.problemId.startsWith(`learn:${PREFIX}`);

/** Validates one record against its lesson's choices; null when it cannot be read at all. */
export function validAiProgress(id: AiLessonId, value: unknown): AiProgress | null {
  const parsed = parseAiRecord(id, value);
  return parsed && resolveAiProgress(parsed, AI_CONTENT[id]);
}
function stored(id: AiLessonId, content: string | null | undefined) {
  try {
    return validAiProgress(id, JSON.parse(content || "null")) ?? undefined;
  } catch {
    return undefined;
  }
}

export function aiProgressFromRows(rows: Progress[]): AiProgressMap {
  const lessons: AiProgressMap = {};
  for (const row of rows) {
    const id = aiLessonFromKey(row.problemId.slice("learn:".length));
    const record = id && stored(id, row.code);
    if (id && record) lessons[id] = record;
  }
  return lessons;
}

/** Merges each incoming lesson into the saved copy, retrying when another write lands first. */
export async function saveAiProgress(
  learning: Pick<LearningStore, "get" | "save">,
  owner: string,
  lessons: Partial<Record<AiLessonId, AiProgress>>,
): Promise<AiProgressMap> {
  const result: AiProgressMap = {};
  for (const [id, incoming] of Object.entries(lessons) as [AiLessonId, AiProgress][]) {
    const key = aiProgressKey(id);
    for (let attempt = 0; ; attempt++) {
      const current = await learning.get(owner, key);
      const saved = stored(id, current?.code);
      const merged = mergeAiProgress(incoming, saved)!;
      if (current && saved && sameAiProgress(merged, saved)) {
        result[id] = saved;
        break;
      }
      try {
        await learning.save(owner, key, JSON.stringify(merged), current?.codeRevision ?? 0);
        result[id] = merged;
        break;
      } catch (error) {
        if (!(error instanceof CodeConflict) || attempt >= 2) throw error;
      }
    }
  }
  return result;
}
