import type { ProjectWorkshop, workshopSaveSchema } from "../ai-learning/project-workshop";
import {
  validPracticeProgress,
  type GeneratedPractice,
  type practiceSaveSchema,
} from "../project-check/generated-practice";
import type { ProjectDialogue } from "../project-check/dialogue";
import { allowanceFor } from "../ai-access";
import type { Query } from "./store-queries";
import type { JobLease } from "./store-contract";
import type { Assessment, Check, StoredCheck } from "../project-check/types";
import { z } from "zod";
import { HttpError } from "./http";
import { StaleJob } from "./write-conflicts";
export function publicReview(raw: string): NonNullable<Check["review"]> {
  const { answers, assessment, practice } = JSON.parse(raw);
  return { answers, assessment, ...(practice ? { practice } : {}) };
}
export function publicCheck(check: StoredCheck): Check {
  const { text: _text, captures, ...page } = check.page;
  void _text;
  return {
    ...check,
    page: {
      ...page,
      ...(captures
        ? {
            captures: captures.map((p) => ({
              url: p.url,
              title: p.title,
              hasScreenshot: !!p.screenshot,
            })),
          }
        : {}),
    },
    analysis: {
      ...check.analysis,
      questions: check.analysis.questions.map(({ criteria: _criteria, ...q }) => {
        void _criteria;
        return q;
      }),
    },
  };
}
export class ProjectCheckStore {
  constructor(private query: Query) {}
  async get(owner: string, id: string): Promise<StoredCheck | null> {
    const [row] = await this.query(
      "SELECT result FROM jobs WHERE id=? AND owner=? AND kind='project-analysis' AND state='done'",
      [id, owner],
    );
    return row ? JSON.parse(String(row.result)) : null;
  }
  async review(owner: string, id: string): Promise<Check["review"]> {
    const [row] = await this.query(
      "SELECT result FROM jobs WHERE id=? AND owner=? AND kind=? AND state='done'",
      [`project-review-${id}`, owner, `project-review:${id}`],
    );
    return row ? publicReview(String(row.result)) : undefined;
  }
  async detail(owner: string, id: string): Promise<Check | null> {
    const rows = await this.query(
      "SELECT j.result,r.result AS review FROM jobs j LEFT JOIN jobs r ON r.id='project-review-' || j.id AND r.owner=j.owner AND r.kind='project-review:' || j.id AND r.state='done' WHERE j.owner=? AND j.id=? AND j.kind='project-analysis' AND j.state='done'",
      [owner, id],
    );
    return rows.length ? this.readCheck(rows[0]) : null;
  }
  private readCheck(row: Record<string, unknown>): Check {
    return {
      ...publicCheck(JSON.parse(String(row.result))),
      ...(row.review ? { review: publicReview(String(row.review)) } : {}),
    };
  }
  async list(owner: string): Promise<Check[]> {
    return (await this.page(owner)).checks;
  }
  async page(owner: string, cursor?: string | null) {
    let after: { expires: number; id: string } | undefined;
    if (cursor !== undefined && cursor !== null) {
      try {
        if (cursor.length > 256) throw new Error();
        after = z
          .object({ expires: z.number().int().nonnegative().safe(), id: z.uuid() })
          .strict()
          .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
      } catch {
        throw new HttpError(
          400,
          "기록 목록 주소가 올바르지 않습니다. 처음부터 다시 불러와 주세요.",
        );
      }
    }
    // Completed jobs keep their lease timestamp. Pair it with the unique ID so
    // insertions, deletions and equal timestamps do not shift the next page.
    const rows = await this.query(
      `SELECT j.id,j.expires,j.result,r.result AS review FROM jobs j LEFT JOIN jobs r ON r.id='project-review-' || j.id AND r.owner=j.owner AND r.kind='project-review:' || j.id AND r.state='done' WHERE j.owner=? AND j.kind='project-analysis' AND j.state='done' ${after ? "AND (j.expires<? OR (j.expires=? AND j.id<?))" : ""} ORDER BY j.expires DESC,j.id DESC LIMIT 21`,
      [owner, ...(after ? [after.expires, after.expires, after.id] : [])],
    );
    const visible = rows.slice(0, 20);
    const last = visible.at(-1);
    return {
      checks: visible.map((row) => this.readCheck(row)),
      nextCursor:
        rows.length > 20 && last
          ? Buffer.from(
              JSON.stringify({ expires: Number(last.expires), id: String(last.id) }),
            ).toString("base64url")
          : null,
    };
  }
  async savePractice(
    owner: string,
    id: string,
    practice: import("../project-check/types").ProjectPractice,
  ) {
    const [row] = await this.query(
      "SELECT result FROM jobs WHERE id=? AND owner=? AND kind=? AND state='done'",
      [`project-review-${id}`, owner, `project-review:${id}`],
    );
    if (!row) throw new HttpError(404, "평가 기록을 찾지 못했습니다.");
    const raw = String(row.result);
    const review = JSON.parse(raw);
    if (
      review.practice?.revision === practice.revision + 1 &&
      JSON.stringify(review.practice.tasks) === JSON.stringify(practice.tasks)
    )
      return review.practice;
    if ((review.practice?.revision ?? 0) !== practice.revision)
      throw new HttpError(
        409,
        "다른 화면에서 기록이 바뀌었습니다. 새로고침 후 다시 저장해 주세요.",
      );
    const saved = { ...practice, revision: practice.revision + 1 };
    const rows = await this.query(
      "UPDATE jobs SET result=? WHERE id=? AND owner=? AND kind=? AND state='done' AND result=? RETURNING id",
      [
        JSON.stringify({ ...review, practice: saved }),
        `project-review-${id}`,
        owner,
        `project-review:${id}`,
        raw,
      ],
    );
    if (!rows.length)
      throw new HttpError(409, "기록이 바뀌었습니다. 새로고침 후 다시 저장해 주세요.");
    return saved;
  }
  async usage(owner: string) {
    const result = {} as Record<
      "analysis" | "review",
      { limit: number; remaining: number; resetsAt: string | null }
    >;
    for (const kind of ["analysis", "review"] as const) {
      const [row] = await this.query("SELECT count,expires FROM limits WHERE key=? AND expires>?", [
        `project:${kind}:${owner}`,
        Date.now(),
      ]);
      result[kind] = {
        limit: allowanceFor(owner)[kind === "analysis" ? "analysis" : "projectReview"],
        remaining: Math.max(
          0,
          allowanceFor(owner)[kind === "analysis" ? "analysis" : "projectReview"] -
            Number(row?.count || 0),
        ),
        resetsAt: row ? new Date(Number(row.expires)).toISOString() : null,
      };
    }
    return result;
  }
  async complete(
    lease: JobLease,
    result: StoredCheck | { answers: string[]; assessment: Assessment },
    revisionParent?: string,
  ) {
    if (lease.kind !== "project-analysis" && !lease.kind.startsWith("project-review:"))
      throw new StaleJob();
    const parent = lease.kind.startsWith("project-review:")
      ? lease.kind.slice("project-review:".length)
      : (revisionParent ?? null);
    const rows = await this.query(
      `UPDATE jobs SET state='done',result=? WHERE id=? AND owner=? AND kind=? AND token=? AND state='pending' AND expires>? ${parent ? "AND EXISTS(SELECT 1 FROM jobs p WHERE p.id=? AND p.owner=? AND p.kind='project-analysis' AND p.state='done')" : ""} RETURNING id`,
      [
        JSON.stringify(result),
        lease.id,
        lease.owner,
        lease.kind,
        lease.token,
        Date.now(),
        ...(parent ? [parent, lease.owner] : []),
      ],
    );
    if (!rows.length) throw new StaleJob();
  }
  async dialogue(
    owner: string,
    checkId: string,
    questionIndex: number,
    id?: string,
  ): Promise<ProjectDialogue | null> {
    const rows = await this.query(
      "SELECT result FROM jobs WHERE owner=? AND kind=? AND state='done'" +
        (id ? " AND id=?" : "") +
        " ORDER BY expires DESC,id DESC LIMIT 1",
      [owner, `project-dialogue:${checkId}:${questionIndex}`, ...(id ? [id] : [])],
    );
    return rows[0] ? JSON.parse(String(rows[0].result)) : null;
  }
  async completeDialogue(lease: JobLease, checkId: string, result: ProjectDialogue) {
    if (
      lease.kind !== `project-dialogue:${checkId}:${result.questionIndex}` ||
      lease.id !== result.id
    )
      throw new StaleJob();
    const rows = await this.query(
      "UPDATE jobs SET state='done',result=? WHERE id=? AND owner=? AND kind=? AND token=? AND state='pending' AND expires>? AND EXISTS(SELECT 1 FROM jobs p WHERE p.id=? AND p.owner=? AND p.kind='project-analysis' AND p.state='done') RETURNING id",
      [
        JSON.stringify(result),
        lease.id,
        lease.owner,
        lease.kind,
        lease.token,
        Date.now(),
        checkId,
        lease.owner,
      ],
    );
    if (!rows.length) throw new StaleJob();
  }
  async practiceCharges(owner: string, network: string) {
    const rows = await this.query("SELECT key,expires FROM limits WHERE key IN (?,?)", [
      `project:analysis:${owner}`,
      `project:guest-network:analysis:${network}`,
    ]);
    return rows
      .map((row) => ({ key: String(row.key), expires: Number(row.expires) }))
      .filter((row) =>
        owner.startsWith("user:") ? row.key === `project:analysis:${owner}` : true,
      );
  }
  async refundPractice(lease: JobLease, charges: { key: string; expires: number }[]) {
    // Only the failed lease may refund its own window. Global/short-term limits
    // still count the attempted provider request to bound repeated failures.
    for (const charge of charges)
      await this.query(
        "UPDATE limits SET count=CASE WHEN count>0 THEN count-1 ELSE 0 END WHERE key=? AND expires=? AND EXISTS(SELECT 1 FROM jobs WHERE id=? AND owner=? AND kind=? AND token=? AND state='failed')",
        [charge.key, charge.expires, lease.id, lease.owner, lease.kind, lease.token],
      );
  }
  async learningStage(
    owner: string,
    id: string,
    kind: "practice" | "workshop",
    stage: string,
  ): Promise<unknown | null> {
    const [row] = await this.query(
      "SELECT result FROM jobs WHERE owner=? AND id=? AND kind=? AND state='done'",
      [owner, `${id}:${kind}:${stage}`, `project-learning-stage:${id}`],
    );
    return row ? JSON.parse(String(row.result)) : null;
  }
  async completeLearningStage(lease: JobLease, id: string, result: unknown) {
    if (
      lease.kind !== `project-learning-stage:${id}` ||
      !["practice:code", "practice:service", "workshop:observed", "workshop:proposed"].some(
        (s) => lease.id === `${id}:${s}`,
      )
    )
      throw new StaleJob();
    const rows = await this.query(
      "UPDATE jobs SET state='done',result=? WHERE id=? AND owner=? AND kind=? AND token=? AND state='pending' AND expires>? AND EXISTS(SELECT 1 FROM jobs p WHERE p.id=? AND p.owner=? AND p.kind='project-analysis' AND p.state='done') RETURNING id",
      [
        JSON.stringify(result),
        lease.id,
        lease.owner,
        lease.kind,
        lease.token,
        Date.now(),
        id,
        lease.owner,
      ],
    );
    if (!rows.length) throw new StaleJob();
  }
  async generatedPractice(owner: string, id: string): Promise<GeneratedPractice | null> {
    const [row] = await this.query(
      "SELECT result FROM jobs WHERE owner=? AND id=? AND kind=? AND state='done'",
      [owner, `${id}:practice`, `project-practice:${id}`],
    );
    return row ? JSON.parse(String(row.result)) : null;
  }
  async completePractice(lease: JobLease, id: string, result: GeneratedPractice) {
    if (lease.kind !== `project-practice:${id}` || lease.id !== `${id}:practice`)
      throw new StaleJob();
    const rows = await this.query(
      "UPDATE jobs SET state='done',result=? WHERE id=? AND owner=? AND kind=? AND token=? AND state='pending' AND expires>? AND EXISTS(SELECT 1 FROM jobs p WHERE p.id=? AND p.owner=? AND p.kind='project-analysis' AND p.state='done') RETURNING id",
      [
        JSON.stringify(result),
        lease.id,
        lease.owner,
        lease.kind,
        lease.token,
        Date.now(),
        id,
        lease.owner,
      ],
    );
    if (!rows.length) throw new StaleJob();
  }
  async saveGeneratedPractice(
    owner: string,
    id: string,
    input: z.infer<typeof practiceSaveSchema>,
  ) {
    const saved = await this.generatedPractice(owner, id);
    if (!saved) throw new HttpError(404, "저장된 실습을 찾지 못했습니다.");
    if (!validPracticeProgress(saved.exercises[input.mode], input.progress))
      throw new HttpError(400, "앞 단계의 확인을 마친 뒤 이어서 진행해 주세요.");
    if (JSON.stringify(saved.progress[input.mode]) === JSON.stringify(input.progress)) return saved;
    if (saved.revision !== input.revision)
      throw new HttpError(
        409,
        "다른 화면에서 실습 기록이 바뀌었습니다. 저장된 기록을 다시 불러와 주세요.",
      );
    const next = {
      ...saved,
      revision: saved.revision + 1,
      progress: { ...saved.progress, [input.mode]: input.progress },
    };
    const rows = await this.query(
      "UPDATE jobs SET result=? WHERE owner=? AND id=? AND kind=? AND state='done' AND result=? RETURNING id",
      [
        JSON.stringify(next),
        owner,
        `${id}:practice`,
        `project-practice:${id}`,
        JSON.stringify(saved),
      ],
    );
    if (!rows.length)
      throw new HttpError(409, "기록이 바뀌었습니다. 저장된 기록을 다시 불러와 주세요.");
    return next;
  }
  async workshop(owner: string, id: string): Promise<ProjectWorkshop | null> {
    const [row] = await this.query(
      "SELECT result FROM jobs WHERE owner=? AND id=? AND kind=? AND state='done'",
      [owner, `${id}:workshop`, `project-workshop:${id}`],
    );
    return row ? JSON.parse(String(row.result)) : null;
  }
  async completeWorkshop(lease: JobLease, id: string, result: ProjectWorkshop) {
    if (lease.kind !== `project-workshop:${id}` || lease.id !== `${id}:workshop`)
      throw new StaleJob();
    const rows = await this.query(
      "UPDATE jobs SET state='done',result=? WHERE id=? AND owner=? AND kind=? AND token=? AND state='pending' AND expires>? AND EXISTS(SELECT 1 FROM jobs p WHERE p.id=? AND p.owner=? AND p.kind='project-analysis' AND p.state='done') RETURNING id",
      [
        JSON.stringify(result),
        lease.id,
        lease.owner,
        lease.kind,
        lease.token,
        Date.now(),
        id,
        lease.owner,
      ],
    );
    if (!rows.length) throw new StaleJob();
  }
  async saveWorkshop(owner: string, id: string, input: z.infer<typeof workshopSaveSchema>) {
    const saved = await this.workshop(owner, id);
    if (!saved) throw new HttpError(404, "저장된 AI 학습을 찾지 못했습니다.");
    const topic = saved.plan.topics[input.index];
    if (!topic || input.response.choice >= topic.choices.length)
      throw new HttpError(400, "학습 항목과 선택을 다시 확인해 주세요.");
    if (JSON.stringify(saved.responses[input.index]) === JSON.stringify(input.response))
      return saved;
    if (saved.revision !== input.revision)
      throw new HttpError(409, "다른 화면에서 기록이 바뀌었습니다. 다시 불러온 후 저장해 주세요.");
    const responses = Array.from({ length: saved.plan.topics.length }, (_, i) =>
      i === input.index ? input.response : (saved.responses[i] ?? null),
    );
    const next = { ...saved, responses, revision: saved.revision + 1 };
    const rows = await this.query(
      "UPDATE jobs SET result=? WHERE owner=? AND id=? AND kind=? AND state='done' AND result=? RETURNING id",
      [
        JSON.stringify(next),
        owner,
        `${id}:workshop`,
        `project-workshop:${id}`,
        JSON.stringify(saved),
      ],
    );
    if (!rows.length)
      throw new HttpError(409, "기록이 바뀌었습니다. 다시 불러온 후 저장해 주세요.");
    return next;
  }
  async remove(owner: string, id: string) {
    await this.query(
      "DELETE FROM jobs WHERE owner=? AND ((id=? AND kind='project-analysis') OR kind=? OR kind=? OR kind=? OR kind=? OR kind IN (?,?,?,?,?))",
      [
        owner,
        id,
        `project-review:${id}`,
        `project-practice:${id}`,
        `project-workshop:${id}`,
        `project-learning-stage:${id}`,
        ...Array.from({ length: 5 }, (_, i) => `project-dialogue:${id}:${i}`),
      ],
    );
  }
}
