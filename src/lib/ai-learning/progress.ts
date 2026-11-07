import { AI_LESSONS, aiContentVersion, exerciseChoiceId, type AiLessonId } from "./catalog";
import type { AiLessonContent } from "./content";
import { learningStorageDescription } from "../learn/session";

export type AiProgress = {
  step: 0 | 1 | 2;
  /** Id of the exercise choice explored last. */
  experiment: string | null;
  completed: boolean;
  /** Id of the selected quiz choice. */
  answer?: string | null;
  checked?: boolean;
  /** Distinct wrong quiz choices checked since the quiz was last started. */
  wrong?: string[];
  /** Whether the first checked quiz answer was correct. Absent until the first check. */
  firstAttemptCorrect?: boolean;
  /** Content version the choice ids refer to (`aiContentVersion`). */
  version?: number;
  updatedAt?: number;
};
export type AiProgressMap = Partial<Record<AiLessonId, AiProgress>>;
export const EMPTY_AI_PROGRESS: AiProgress = { step: 0, experiment: null, completed: false };
export const AI_PROGRESS_KEY = "codefit.ai-learning.v1";
/** Wrong answers checked before the explanation is shown without a correct answer. */
export const EXPLANATION_AFTER_WRONG = 2;

const CHOICE_ID = /^[a-z0-9-]{1,24}$/;
const isChoiceId = (value: unknown): value is string =>
  typeof value === "string" && CHOICE_ID.test(value);
const isLessonId = (id: string): id is AiLessonId => AI_LESSONS.some((lesson) => lesson.id === id);

/** Fixed key order so equal records serialize identically on every device. */
function normalized(p: AiProgress): AiProgress {
  const experiment = p.experiment ?? null;
  const answer = p.answer ?? null;
  return {
    step: p.step === 2 && experiment === null && !p.completed ? 1 : p.step,
    experiment,
    completed: p.completed,
    answer,
    checked: Boolean(p.checked) && answer !== null,
    wrong: [...new Set(p.wrong ?? [])].slice(0, 8),
    ...(typeof p.firstAttemptCorrect === "boolean"
      ? { firstAttemptCorrect: p.firstAttemptCorrect }
      : {}),
    ...(p.version !== undefined ? { version: p.version } : {}),
    ...(p.updatedAt !== undefined ? { updatedAt: p.updatedAt } : {}),
  };
}

/**
 * Shape-checks one stored lesson record without loading lesson content. Version 1 records stored
 * choice positions: exercise choices kept their original order, so those positions map to their
 * letter ids, while the rewritten quizzes drop the old selection and keep only completion.
 */
export function parseAiRecord(id: AiLessonId, value: unknown): AiProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const step = record.step;
  if (step !== 0 && step !== 1 && step !== 2) return null;
  const current = aiContentVersion(id);
  const saved =
    typeof record.version === "number" && Number.isInteger(record.version) && record.version >= 1
      ? record.version
      : 1;
  let experiment: string | null = null;
  let answer: string | null = null;
  let checked = false;
  let wrong: string[] = [];
  if (saved === 1) {
    const index = record.experiment;
    if (typeof index === "number" && Number.isInteger(index) && index >= 0 && index < 8)
      experiment = exerciseChoiceId(index);
  } else if (saved === current) {
    experiment = isChoiceId(record.experiment) ? record.experiment : null;
    answer = isChoiceId(record.answer) ? record.answer : null;
    checked = record.checked === true;
    wrong = Array.isArray(record.wrong) ? record.wrong.filter(isChoiceId) : [];
  }
  const updatedAt = record.updatedAt;
  return normalized({
    step,
    experiment,
    completed: record.completed === true,
    answer,
    checked,
    wrong,
    ...(typeof record.firstAttemptCorrect === "boolean"
      ? { firstAttemptCorrect: record.firstAttemptCorrect }
      : {}),
    version: current,
    ...(typeof updatedAt === "number" && Number.isFinite(updatedAt) && updatedAt > 0
      ? { updatedAt }
      : {}),
  });
}

/** Drops choice ids the lesson does not have. Used by the lesson screen and the server. */
export function resolveAiProgress(progress: AiProgress, content: AiLessonContent): AiProgress {
  const exercise = new Set(content.exercise.choices.map((choice) => choice.id));
  const quiz = new Set(content.quiz.choices.map((choice) => choice.id));
  return normalized({
    ...progress,
    experiment:
      progress.experiment && exercise.has(progress.experiment) ? progress.experiment : null,
    answer: progress.answer && quiz.has(progress.answer) ? progress.answer : null,
    wrong: (progress.wrong ?? []).filter((id) => quiz.has(id) && id !== content.quiz.answer),
  });
}

/**
 * Combines two copies of one lesson without losing either side: completion is kept from both,
 * a wrong first attempt on either device is kept, and the newer copy decides the current step
 * and quiz selection.
 */
export function mergeAiProgress(a?: AiProgress, b?: AiProgress): AiProgress | undefined {
  if (!a || !b) return a ? normalized(a) : b && normalized(b);
  const [newer, older] = (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? [b, a] : [a, b];
  const first = [a.firstAttemptCorrect, b.firstAttemptCorrect].filter(
    (value): value is boolean => typeof value === "boolean",
  );
  const updatedAt = Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0);
  return normalized({
    step: newer.step,
    experiment: newer.experiment ?? older.experiment,
    completed: a.completed || b.completed,
    answer: newer.answer,
    checked: newer.checked,
    wrong: newer.wrong,
    ...(first.length ? { firstAttemptCorrect: first.every(Boolean) } : {}),
    version: newer.version ?? older.version,
    ...(updatedAt ? { updatedAt } : {}),
  });
}

export function sameAiProgress(a?: AiProgress, b?: AiProgress) {
  return JSON.stringify(a && normalized(a)) === JSON.stringify(b && normalized(b));
}

/** Reads a map of lesson records, e.g. from the browser cache or a request body. */
export function parseAiLessons(value: unknown): AiProgressMap {
  const entries: AiProgressMap = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return entries;
  for (const [id, record] of Object.entries(value)) {
    if (!isLessonId(id)) continue;
    const parsed = parseAiRecord(id, record);
    if (parsed) entries[id] = parsed;
  }
  return entries;
}

/**
 * Browser cache: `{ version: 1, scope?, lessons }`. A cache without `scope` was written before
 * progress synced to the server and still has to be uploaded once.
 */
export function parseAiCache(raw: string | null): { scope: string | null; lessons: AiProgressMap } {
  try {
    const data = JSON.parse(raw || "null");
    if (data?.version !== 1 || !data.lessons || typeof data.lessons !== "object")
      return { scope: null, lessons: {} };
    return {
      scope: typeof data.scope === "string" ? data.scope : null,
      lessons: parseAiLessons(data.lessons),
    };
  } catch {
    return { scope: null, lessons: {} };
  }
}
export const parseAiProgress = (raw: string | null) => parseAiCache(raw).lessons;

/** Where AI lesson progress is kept, for the catalog and lesson screens. */
export function aiProgressNote(status: {
  storageError: boolean;
  synced: boolean;
  offline: boolean;
  signedIn: boolean;
}) {
  if (status.offline)
    return status.storageError
      ? "브라우저 저장이 차단되고 서버에도 연결하지 못해 현재 탭에서만 기록됩니다."
      : "서버에 연결하지 못해 이 브라우저에만 기록했어요. 연결되면 자동으로 저장합니다.";
  if (!status.synced) return "학습 기록을 서버와 맞추는 중이에요.";
  return `${status.storageError ? "브라우저 저장이 차단되어 서버에만 저장합니다. " : ""}${learningStorageDescription(status.signedIn)}`;
}

/** Lessons whose quiz was not answered correctly on the first attempt. */
export function lessonsToReview(records: AiProgressMap) {
  return AI_LESSONS.filter((lesson) => records[lesson.id]?.firstAttemptCorrect === false);
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
