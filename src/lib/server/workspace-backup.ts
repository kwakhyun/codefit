import { repositorySnapshotSchema, repositoryCitation } from "../project-check/repository";
import { projectDialogueSchema } from "../project-check/dialogue";
import { captureSchema } from "../project-check/types";
import { practiceSchema } from "../project-check/types";
import { createHash } from "node:crypto";
import { z } from "zod";
import { backupSchema, type Backup } from "../backup";
import { BACKUP_MAX_SIZE_LABEL, BACKUP_MAX_BYTES, BACKUP_MAX_PROBLEMS } from "../backup-limits";
import {
  analysisSchema,
  assessmentSchema,
  assessmentIssueSchema,
  verificationPlanSchema,
  AREAS,
} from "../project-check/types";
import { learningSchema, validLearning } from "../learn/progress";
import { missionById } from "../learn/catalog";
import { trainingInput } from "../project-learning/types";
import { readCurriculumSnapshot, createCurriculumSnapshot } from "./project-curriculum";
import { validateGroundedAssessment } from "./project-assessment";
import { toAttempt, toProgress } from "./store-records";
import { HttpError } from "./http";
import { requestFingerprint } from "./write-conflicts";

type Row = Record<string, unknown>;
// Both adapters execute these reads in a consistent snapshot. Public problems
// unrelated to this owner must not inflate (or leak into) a personal backup.
export const backupReads = [
  `SELECT content FROM problems p WHERE EXISTS(SELECT 1 FROM progress g WHERE g.owner=? AND g.problem_id=p.id) OR EXISTS(SELECT 1 FROM attempts a WHERE a.owner=? AND a.problem_id=p.id) OR EXISTS(SELECT 1 FROM jobs j WHERE j.owner=? AND j.kind='generate' AND j.state='done' AND j.result=p.id) OR EXISTS(SELECT 1 FROM restored_problems b WHERE b.owner=? AND b.problem_id=p.id) ORDER BY p.id LIMIT ${BACKUP_MAX_PROBLEMS + 1}`,
  `SELECT * FROM progress WHERE owner=? ORDER BY problem_id LIMIT ${BACKUP_MAX_PROBLEMS + 1}`,
  "SELECT * FROM attempts WHERE owner=? ORDER BY created_at,id LIMIT 10001",
  "SELECT content FROM legacy WHERE owner=?",
  "SELECT * FROM learning_progress WHERE owner=? ORDER BY lesson_id LIMIT 501",
  "SELECT p.result,r.result AS review FROM jobs p LEFT JOIN jobs r ON r.id='project-review-' || p.id AND r.owner=p.owner AND r.kind='project-review:' || p.id AND r.state='done' WHERE p.owner=? AND p.kind='project-analysis' AND p.state='done' ORDER BY p.expires,p.id LIMIT 501",
  "SELECT kind,result FROM jobs WHERE owner=? AND kind LIKE 'project-dialogue:%' AND state='done' ORDER BY expires,id",
];
export function backupParameters(index: number, owner: string) {
  return index === 0 ? [owner, owner, owner, owner] : [owner];
}
export function buildBackup(rows: Row[][]): Backup {
  const [problems, progress, attempts, legacy, learning, projects, dialogues = []] = rows;
  const raw = {
    version: 3,
    exportedAt: new Date().toISOString(),
    problems: problems.map((r) => JSON.parse(String(r.content))),
    progress: Object.fromEntries(progress.map((r) => [String(r.problem_id), toProgress(r)])),
    attempts: attempts.map(toAttempt),
    legacy: legacy[0] ? JSON.parse(String(legacy[0].content)) : null,
    learning: learning.map((r) => ({
      id: String(r.lesson_id),
      content: String(r.content),
      updatedAt: String(r.updated_at),
    })),
    projects: projects.map((r) => ({
      check: JSON.parse(String(r.result)),
      ...(r.review ? { review: JSON.parse(String(r.review)) } : {}),
      ...(() => {
        const id = JSON.parse(String(r.result)).id;
        const latest = new Map<number, unknown>();
        for (const row of dialogues)
          if (String(row.kind).startsWith(`project-dialogue:${id}:`)) {
            const value = JSON.parse(String(row.result));
            latest.set(value.questionIndex, value);
          }
        return latest.size ? { dialogues: [...latest.values()] } : {};
      })(),
    })),
  };
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success || progress.length > BACKUP_MAX_PROBLEMS)
    throw new HttpError(
      413,
      "한 파일에 담을 수 있는 기록 수를 넘어서 내보내지 못했습니다. 저장된 기록은 그대로 유지됩니다.",
    );
  // Check exactly the compact serialization used by both the API and download.
  if (Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > BACKUP_MAX_BYTES)
    throw new HttpError(
      413,
      `백업 용량이 ${BACKUP_MAX_SIZE_LABEL}를 넘어서 내보내지 못했습니다. 저장된 기록은 그대로 유지됩니다.`,
    );
  prepareBackup(parsed.data);
  return parsed.data;
}
const quote = z.string().min(1).max(1500).nullable();
const evidence = z
  .object({
    feature: quote,
    flow: quote,
    reason: quote,
    failure: quote,
    verification: quote,
    tradeoff: quote,
  })
  .strict();
const savedAssessment = assessmentSchema
  .extend({
    score: z.number().int().min(0).max(100),
    rubricVersion: z.enum(["evidence-v1", "evidence-v2", "evidence-v3"]).optional(),
    feedback: z
      .array(
        assessmentSchema.shape.feedback.element
          .extend({
            evidence: evidence.optional(),
            verificationPlan: verificationPlanSchema.optional(),
            blockingIssue: assessmentIssueSchema.nullable().optional(),
          })
          .strict(),
      )
      .length(5),
  })
  .strict();
const savedCheck = z
  .object({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    description: z.string().max(2000),
    page: z
      .object({
        url: z.url().max(1500),
        text: z.string().max(100000),
        title: z.string().max(1000),
        fetchedAt: z.iso.datetime(),
        limited: z.boolean(),
        source: z.enum(["html", "metadata", "rendered", "repository"]).optional(),
        repository: repositorySnapshotSchema.optional(),
        collectionNote: z.string().max(1000).optional(),
        captures: z.array(captureSchema).max(3).optional(),
      })
      .strict(),
    analysis: analysisSchema,
    previousReview: z
      .object({ answers: z.array(z.string().max(1500)).length(5), assessment: savedAssessment })
      .strict()
      .optional(),
    revisionNumber: z.number().int().min(1).max(3).optional(),
  })
  .strict();
const submission = trainingInput
  .pick({ answers: true, confidence: true, assisted: true })
  .extend({
    submittedAt: z.iso.datetime(),
    correct: z.number().int().min(0).max(2),
    priorPractice: z.boolean(),
    practiceRevision: z.number().int().nonnegative().nullable(),
    practiceHints: z.number().int().min(0).max(3),
  })
  .strict();
const savedTraining = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative().safe(),
    modules: z.partialRecord(
      z.enum(["flow", "storage", "access", "recovery", "rules"]),
      z.object({ baseline: submission.optional(), transfer: submission.optional() }).strict(),
    ),
    curriculum: z.unknown().optional(),
  })
  .strict();
const savedReview = z
  .object({
    answers: z.array(z.string().max(1500)).length(5),
    assessment: savedAssessment,
    training: savedTraining.optional(),
    practice: practiceSchema.optional(),
  })
  .strict();

/** Reject broken relationships before importing any part. Imported files are user
 * records, not signed proof of an AI judgement or independently measured mastery. */
export function prepareBackup(backup: Backup) {
  if (
    new Set(backup.problems.map((p) => p.id)).size !== backup.problems.length ||
    new Set(backup.attempts.map((a) => a.id)).size !== backup.attempts.length ||
    Object.entries(backup.progress).some(([id, p]) => id !== p.problemId)
  )
    throw new Error("Duplicate or inconsistent backup records");
  if (backup.version === 2) return { learning: [], projects: [] };
  const learning = backup.learning.map((item) => {
    const mission = missionById(item.id);
    const record = learningSchema.parse(JSON.parse(item.content));
    if (!mission || !validLearning(mission, record)) throw new Error("Invalid lesson record");
    return { ...item, content: JSON.stringify(record) };
  });
  const projects = backup.projects.map((item) => {
    const check = savedCheck.parse(item.check);
    if (new Set(check.analysis.questions.map((q) => q.area)).size !== AREAS.length)
      throw new Error("Invalid project areas");
    const review = item.review === undefined ? undefined : savedReview.parse(item.review);
    for (const item of [
      review,
      check.previousReview ? { ...check.previousReview, training: undefined } : undefined,
    ]) {
      if (!item) continue;
      const review = item;
      const { assessment, answers } = review;
      if (
        new Set(assessment.feedback.map((f) => f.questionIndex)).size !== 5 ||
        assessment.score !== assessment.feedback.reduce((s, f) => s + f.level * 5, 0)
      )
        throw new Error("Invalid assessment score");
      if (
        !assessment.rubricVersion &&
        assessment.feedback.some((f) => f.blockingIssue !== undefined)
      )
        throw new Error("Unexpected assessment issue for legacy rubric");
      if (assessment.rubricVersion) {
        for (const f of assessment.feedback) {
          if (assessment.rubricVersion === "evidence-v3") {
            if (f.blockingIssue === undefined) throw new Error("Missing assessment issue decision");
            if (
              f.blockingIssue?.evidence.some(
                (q) => !q.trim() || !answers[f.questionIndex].includes(q),
              )
            )
              throw new Error("Invalid assessment issue evidence");
          } else if (f.blockingIssue !== undefined) {
            throw new Error("Unexpected assessment issue for legacy rubric");
          }
        }
        const grounded = validateGroundedAssessment(
          {
            summary: assessment.summary,
            feedback: assessment.feedback.map(
              ({ questionIndex, feedback, nextStep, evidence }) => ({
                questionIndex,
                feedback,
                nextStep,
                evidence,
              }),
            ),
          },
          answers,
        );
        if (
          grounded.feedback.some((f) => {
            const saved = assessment.feedback.find((v) => v.questionIndex === f.questionIndex)!;
            return (saved.blockingIssue ? Math.min(f.level, 1) : f.level) !== saved.level;
          })
        )
          throw new Error("Inconsistent assessment evidence");
      }
      if (review.training) {
        const t = review.training;
        const curriculum =
          t.curriculum === undefined
            ? createCurriculumSnapshot()
            : readCurriculumSnapshot(t.curriculum);
        if (
          t.curriculum === undefined &&
          Object.keys(t.modules).length &&
          curriculum.contentId !==
            "6983bc2c9faa3434428b0570d406268999f179512e610df29fbaa8ac3e39d67f"
        )
          throw new Error("Unknown legacy curriculum");
        for (const m of curriculum.modules) {
          if (!missionById(m.missionId)) throw new Error("Unknown curriculum mission");
          const record = t.modules[m.id];
          if (record?.transfer && !record.baseline) throw new Error("Missing baseline");
          for (const phase of ["baseline", "transfer"] as const) {
            const s = record?.[phase];
            if (s && s.correct !== m[phase].filter((p, i) => p.answer === s.answers[i]).length)
              throw new Error("Inconsistent training score");
          }
        }
        t.curriculum = curriculum;
      }
    }
    const dialogues = item.dialogues?.map((d) => projectDialogueSchema.parse(d));
    if (dialogues) {
      if (
        !check.page.repository ||
        new Set(dialogues.map((d) => d.questionIndex)).size !== dialogues.length
      )
        throw new Error("Invalid code dialogue");
      for (const d of dialogues)
        for (const t of d.turns)
          if (
            t.reply.codeEvidence &&
            !repositoryCitation(check.page.repository, t.reply.codeEvidence)
          )
            throw new Error("Invalid dialogue code evidence");
    }
    return { check, review, dialogues };
  });
  if (
    new Set(learning.map((l) => l.id)).size !== learning.length ||
    new Set(projects.map((p) => p.check.id)).size !== projects.length
  )
    throw new Error("Duplicate learning records");
  return { learning, projects };
}
export function restoredProjectId(owner: string, sourceId: string) {
  const h = createHash("sha256")
    .update(JSON.stringify(["codefit-project-backup-v3", owner, sourceId]))
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function restoredProjectJobs(
  project: ReturnType<typeof prepareBackup>["projects"][number],
  id: string,
) {
  const check = { ...project.check, id };
  const jobs = [
    {
      id,
      kind: "project-analysis",
      result: JSON.stringify(check),
      fingerprint: requestFingerprint(check.page.url, check.description),
    },
  ];
  if (project.review)
    jobs.push({
      id: `project-review-${id}`,
      kind: `project-review:${id}`,
      result: JSON.stringify(project.review),
      fingerprint: requestFingerprint(...project.review.answers),
    });
  for (const d of project.dialogues ?? []) {
    // Keep each prefix so retried previous turns can still be resolved after import.
    for (let i = 0; i < d.turns.length; i++) {
      const dialogueId = `${id}:dialogue:${d.questionIndex}:${i}`;
      jobs.push({
        id: dialogueId,
        kind: `project-dialogue:${id}:${d.questionIndex}`,
        result: JSON.stringify({ ...d, id: dialogueId, turns: d.turns.slice(0, i + 1) }),
        fingerprint: requestFingerprint(
          d.turns[i].answer,
          i ? `${id}:dialogue:${d.questionIndex}:${i - 1}` : "",
        ),
      });
    }
  }
  return jobs.map((job) => ({ ...job, expires: Date.parse(check.createdAt) }));
}
