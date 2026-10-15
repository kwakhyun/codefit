import { z } from "zod";
import type { GeneratedPractice, PracticeMode } from "./generated-practice";

type Response = GeneratedPractice["progress"][PracticeMode][number];
const responseSchema = z.object({
  choice: z.number().int().min(0).max(3),
  note: z.string().max(2000),
  predictionReason: z.string().max(800).optional(),
  completed: z.boolean(),
});
const entrySchema = z.object({
  token: z.string().max(100),
  base: responseSchema.nullable(),
  choice: z.number().int().min(0).max(3).nullable(),
  reason: z.string().max(800),
  note: z.string().max(2000),
  stage: z.number().int().min(0).max(2),
});
export const practiceDraftSchema = z.object({
  version: z.literal(1),
  content: z.string().max(100_000),
  active: z.number().int().min(0).max(2),
  entries: z.array(entrySchema.nullable()).length(3),
});
export type PracticeDraft = z.infer<typeof practiceDraftSchema>;
export type PracticeDraftEntry = z.infer<typeof entrySchema>;
export const practiceDraftKey = (scope: string, id: string, mode: PracticeMode) =>
  `codefit-practice:${encodeURIComponent(scope)}:${encodeURIComponent(id)}:${mode}`;
// Compare the actual content as well as its creation time; progress revisions do not change identity.
export const practiceContent = (saved: GeneratedPractice, mode: PracticeMode) =>
  JSON.stringify([saved.createdAt, saved.exercises[mode]]);
function sameResponse(left: Response | null, right?: Response) {
  return left
    ? Boolean(
        right &&
        left.choice === right.choice &&
        left.note === right.note &&
        left.predictionReason === right.predictionReason &&
        left.completed === right.completed,
      )
    : !right;
}

export function practiceStart(progress: Response[]) {
  const unfinished = progress.findIndex((response) => !response.completed);
  return unfinished >= 0 ? unfinished : Math.min(progress.length, 2);
}
export function emptyPracticeDraft(content: string, progress: Response[]): PracticeDraft {
  return { version: 1, content, active: practiceStart(progress), entries: [null, null, null] };
}
function fromResponse(response?: Response): PracticeDraftEntry {
  return {
    token: "",
    base: response ?? null,
    choice: response?.choice ?? null,
    reason: response?.predictionReason ?? "",
    note: response?.note ?? "",
    stage: response ? 1 : 0,
  };
}
function edited(entry: PracticeDraftEntry) {
  const previous = entry.base;
  return previous
    ? entry.note !== previous.note
    : entry.choice !== null || Boolean(entry.reason || entry.note);
}
export function practiceDraftView(draft: PracticeDraft, progress: Response[], index: number) {
  const current = fromResponse(progress[index]);
  const entry = draft.entries[index];
  if (!entry) return { entry: current, conflict: false };
  if (!sameResponse(entry.base, progress[index]))
    return { entry: current, conflict: edited(entry) };
  return {
    entry: { ...entry, stage: progress[index] ? entry.stage : 0 },
    conflict: false,
  };
}
export function practiceDraftIndex(draft: PracticeDraft, progress: Response[]) {
  return draft.active === 0 || progress[draft.active - 1]?.completed
    ? draft.active
    : practiceStart(progress);
}
export function updatePracticeDraft(
  draft: PracticeDraft,
  progress: Response[],
  index: number,
  patch: Partial<Pick<PracticeDraftEntry, "choice" | "reason" | "note" | "stage">>,
  token: string,
): PracticeDraft {
  const entry = practiceDraftView(draft, progress, index).entry;
  return {
    ...draft,
    active: index,
    entries: draft.entries.map((value, i) => (i === index ? { ...entry, ...patch, token } : value)),
  };
}
export function resolvePracticeDraft(
  draft: PracticeDraft,
  progress: Response[],
  index: number,
  restore: boolean,
  token: string,
): PracticeDraft {
  const previous = draft.entries[index];
  const current = fromResponse(progress[index]);
  const noteEdited =
    previous && (previous.base ? previous.note !== previous.base.note : Boolean(previous.note));
  const entry =
    restore && previous
      ? {
          ...previous,
          ...(progress[index] ? { choice: current.choice, reason: current.reason } : {}),
          note: noteEdited ? previous.note : current.note,
          base: current.base,
          stage: progress[index] ? previous.stage : 0,
          token,
        }
      : { ...current, token };
  return { ...draft, entries: draft.entries.map((value, i) => (i === index ? entry : value)) };
}
/** A late response cannot remove a draft edited after its request started. */
export function acknowledgePracticeDraft(
  draft: PracticeDraft,
  progress: Response[],
  index: number,
  token: string,
  finish: boolean,
): PracticeDraft {
  const previous = draft.entries[index];
  if (previous?.token !== token) return draft;
  const entry = {
    ...fromResponse(progress[index]),
    stage: finish ? 2 : previous.stage === 0 ? 1 : previous.stage,
  };
  return {
    ...draft,
    active: draft.active === index ? (finish && index < 2 ? index + 1 : index) : draft.active,
    entries: draft.entries.map((value, i) => (i === index ? entry : value)),
  };
}
