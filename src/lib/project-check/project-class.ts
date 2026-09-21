import { z } from "zod";
import type { Check } from "./types";
import type { GeneratedPractice } from "./generated-practice";
import type { ProjectWorkshop } from "../ai-learning/project-workshop";
export const classMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    goal: z.string().trim().max(2000),
    revision: z.number().int().nonnegative().safe(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const classEditSchema = classMetadataSchema.omit({ updatedAt: true });
export type ClassMetadata = z.infer<typeof classMetadataSchema>;
export interface ProjectClassDetail {
  check: Check;
  practice: GeneratedPractice | null;
  workshop: ProjectWorkshop | null;
}
