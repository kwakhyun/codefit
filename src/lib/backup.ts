import { z } from "zod";
import { problemSchema, reviewSchema } from "./problem";
export const backupSchema = z.object({
  version: z.literal(2),
  problems: z.array(problemSchema).max(2500),
  progress: z.record(z.string().max(100), z.object({
    problemId: z.string().max(100), code: z.string().max(30000).nullable(), bookmarked: z.boolean(),
    hintsViewed: z.number().int().min(0).max(3), solutionViewed: z.boolean(), status: z.enum(["new", "in-progress", "solved"]), updatedAt: z.iso.datetime(),
  })),
  attempts: z.array(z.object({
    id: z.string().min(1).max(100), problemId: z.string().max(100), code: z.string().max(30000),
    review: reviewSchema.extend({ score: z.number().min(0).max(100), passed: z.boolean() }), assisted: z.boolean(), createdAt: z.iso.datetime(),
  })).max(10000),
  legacy: z.unknown().optional(),
});
export type Backup = z.infer<typeof backupSchema>;
