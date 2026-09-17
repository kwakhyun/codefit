import type { Query } from "./store-queries";
import type { Progress } from "../problem";
import type { JobLease } from "./store-contract";
import { CodeConflict, RevisionRequired, StaleJob } from "./write-conflicts";
function toLearningProgress(row: Record<string, unknown>): Progress {
  return {
    problemId: `learn:${row.lesson_id}`,
    code: String(row.content),
    codeRevision: Number(row.revision),
    updatedAt: String(row.updated_at),
    bookmarked: false,
    hintsViewed: 0,
    solutionViewed: false,
    status: "in-progress",
  };
}
/** One conditional SQL statement is the write boundary on both SQLite and PostgreSQL. */
export class LearningStore {
  constructor(private query: Query) {}
  async get(owner: string, id: string) {
    const [row] = await this.query(
      "SELECT * FROM learning_progress WHERE owner=? AND lesson_id=?",
      [owner, id],
    );
    return row ? toLearningProgress(row) : null;
  }
  async all(owner: string) {
    return (
      await this.query("SELECT * FROM learning_progress WHERE owner=? ORDER BY updated_at DESC", [
        owner,
      ])
    ).map(toLearningProgress);
  }
  async save(owner: string, id: string, content: string, revision: number) {
    if (!Number.isSafeInteger(revision) || revision < 0) throw new RevisionRequired();
    // A missing row may only be created from revision zero. Identical retry is acknowledged.
    const [row] = await this.query(
      `INSERT INTO learning_progress(owner,lesson_id,content,revision,updated_at)
      SELECT ?,?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM learning_progress WHERE owner=? AND lesson_id=?)
      ON CONFLICT(owner,lesson_id) DO UPDATE SET content=excluded.content,
      revision=CASE WHEN learning_progress.content=excluded.content THEN learning_progress.revision ELSE learning_progress.revision+1 END,
      updated_at=excluded.updated_at
      WHERE learning_progress.revision=? OR learning_progress.content=excluded.content RETURNING *`,
      [owner, id, content, new Date().toISOString(), revision, owner, id, revision],
    );
    if (row) return toLearningProgress(row);
    throw new CodeConflict(
      (await this.get(owner, id)) ?? {
        problemId: `learn:${id}`,
        code: null,
        codeRevision: 0,
        updatedAt: "",
        bookmarked: false,
        hintsViewed: 0,
        solutionViewed: false,
        status: "new",
      },
    );
  }
  async completeCoach(lease: JobLease, id: string, result: string) {
    if (lease.kind !== `learn-coach:${id}`) throw new StaleJob();
    const rows = await this.query(
      "UPDATE jobs SET state='done',result=?,expires=? WHERE id=? AND owner=? AND kind=? AND token=? AND state='pending' AND expires>? RETURNING id",
      [result, Date.now() + 86400000, lease.id, lease.owner, lease.kind, lease.token, Date.now()],
    );
    if (!rows.length) throw new StaleJob();
  }
}
