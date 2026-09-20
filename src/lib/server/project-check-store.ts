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
  async remove(owner: string, id: string) {
    await this.query(
      "DELETE FROM jobs WHERE owner=? AND ((id=? AND kind='project-analysis') OR kind=?)",
      [owner, id, `project-review:${id}`],
    );
  }
}
