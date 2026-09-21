import { z } from "zod";
const reviewEntrySchema = z.object({
  note: z.string().max(2000),
  choice: z.number().int().min(0).max(20).nullable(),
  revealed: z.boolean(),
  alternatives: z.array(z.string().max(2000)).optional(),
});
export const reviewDraftSchema = z.object({
  version: z.literal(1),
  active: z.string().max(12000),
  entries: z.record(z.string().max(12000), reviewEntrySchema),
});
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
export type ReviewEntry = z.infer<typeof reviewEntrySchema>;
export const emptyReview = (): ReviewDraft => ({ version: 1, active: "", entries: {} });
export function mergeReviewDraft(
  remote: ReviewDraft,
  base: ReviewDraft,
  active: string,
  patch: Partial<ReviewEntry>,
): ReviewDraft {
  const current = remote.entries[active] ?? { note: "", choice: null, revealed: false };
  const alternatives = new Set([
    ...(current.alternatives ?? []),
    ...(base.entries[active]?.alternatives ?? []),
  ]);
  if (
    patch.note !== undefined &&
    current.note !== (base.entries[active]?.note ?? "") &&
    current.note !== patch.note &&
    current.note
  )
    alternatives.add(current.note);
  return {
    version: 1,
    active,
    entries: {
      ...remote.entries,
      [active]: {
        ...current,
        ...patch,
        ...(alternatives.size ? { alternatives: [...alternatives] } : {}),
      },
    },
  };
}
