import { z } from "zod";
import { problemSchema, reviewSchema } from "./problem";
import { BACKUP_MAX_PROBLEMS } from "./backup-limits";
const legacyBackupSchema = z.object({
  version: z.literal(2),
  problems: z.array(problemSchema).max(BACKUP_MAX_PROBLEMS),
  progress: z.record(
    z.string().max(100),
    z.object({
      problemId: z.string().max(100),
      code: z.string().max(30000).nullable(),
      bookmarked: z.boolean(),
      hintsViewed: z.number().int().min(0).max(3),
      solutionViewed: z.boolean(),
      status: z.enum(["new", "in-progress", "solved"]),
      updatedAt: z.iso.datetime(),
    }),
  ),
  attempts: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        problemId: z.string().max(100),
        code: z.string().max(30000),
        review: reviewSchema.extend({ score: z.number().min(0).max(100), passed: z.boolean() }),
        assisted: z.boolean(),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(10000),
  legacy: z.unknown().optional(),
});
// Version 2 remains readable. New records are validated by the server before any write.
export const backupSchema = z.union([
  legacyBackupSchema,
  legacyBackupSchema
    .extend({
      version: z.literal(3),
      exportedAt: z.iso.datetime(),
      learning: z
        .array(
          z
            .object({
              id: z.string().min(1).max(100),
              content: z.string().max(30000),
              updatedAt: z.iso.datetime(),
            })
            .strict(),
        )
        .max(500),
      projects: z
        .array(
          z
            .object({
              check: z.unknown(),
              review: z.unknown().optional(),
              dialogues: z.array(z.unknown()).max(5).optional(),
              generatedPractice: z.unknown().optional(),
              aiWorkshop: z.unknown().optional(),
            })
            .strict(),
        )
        .max(500),
    })
    .strict(),
]);
export type Backup = z.infer<typeof backupSchema>;
export type BackupImportResult = {
  problems: number;
  attempts: number;
  learning?: number;
  projects?: number;
};
