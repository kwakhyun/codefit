import type { Query } from "./store-queries";
import type { JobLease } from "./store-contract";
import type { Assessment, Check, StoredCheck } from "../project-check/types";
import { PROJECT_LIMITS } from "../project-check/types";
import { StaleJob } from "./write-conflicts";
export function publicCheck(check: StoredCheck): Check {
  const { text: _text, ...page } = check.page;
  void _text;
  return {
    ...check,
    page,
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
    return row ? JSON.parse(String(row.result)) : undefined;
  }
  async list(owner: string): Promise<Check[]> {
    const rows = await this.query(
      "SELECT j.result,r.result AS review FROM jobs j LEFT JOIN jobs r ON r.owner=j.owner AND r.kind='project-review:' || j.id AND r.state='done' WHERE j.owner=? AND j.kind='project-analysis' AND j.state='done' ORDER BY j.expires DESC LIMIT 20",
      [owner],
    );
    return rows
      .map((row) => ({
        ...publicCheck(JSON.parse(String(row.result))),
        ...(row.review ? { review: JSON.parse(String(row.review)) } : {}),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);
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
        limit: PROJECT_LIMITS[kind],
        remaining: Math.max(0, PROJECT_LIMITS[kind] - Number(row?.count || 0)),
        resetsAt: row ? new Date(Number(row.expires)).toISOString() : null,
      };
    }
    return result;
  }
  async complete(
    lease: JobLease,
    result: StoredCheck | { answers: string[]; assessment: Assessment },
  ) {
    if (lease.kind !== "project-analysis" && !lease.kind.startsWith("project-review:"))
      throw new StaleJob();
    const parent = lease.kind.startsWith("project-review:")
      ? lease.kind.slice("project-review:".length)
      : null;
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
