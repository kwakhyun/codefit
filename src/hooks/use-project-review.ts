"use client";
import { useState } from "react";
import { z } from "zod";
const entry = z.object({
  note: z.string().max(2000),
  choice: z.number().int().min(0).max(20).nullable(),
  revealed: z.boolean(),
});
const schema = z.object({
  version: z.literal(1),
  active: z.string().max(12000),
  entries: z.record(z.string().max(12000), entry),
});
type Review = z.infer<typeof schema>;
export const reviewStorageKey = (scope: string, id: string) =>
  `codefit-project-review:${scope}:${id}`;
export function useProjectReview(scope: string, id: string) {
  const key = reviewStorageKey(scope, id);
  const [initial] = useState(() => {
    try {
      const parsed = schema.safeParse(JSON.parse(localStorage.getItem(key) || "null"));
      return {
        value: parsed.success ? parsed.data : { version: 1 as const, active: "", entries: {} },
        failed: false,
      };
    } catch {
      return { value: { version: 1 as const, active: "", entries: {} }, failed: true };
    }
  });
  const [saved, setSaved] = useState<Review>(initial.value);
  const [failed, setFailed] = useState(initial.failed);
  function save(value: Review) {
    setSaved(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  function update(active: string, patch: Partial<z.infer<typeof entry>> = {}) {
    save({
      version: 1,
      active,
      entries: {
        ...saved.entries,
        [active]: {
          ...(saved.entries[active] ?? { note: "", choice: null, revealed: false }),
          ...patch,
        },
      },
    });
  }
  function reset(active: string) {
    save({ version: 1, active, entries: {} });
  }
  return { saved, update, reset, failed };
}
