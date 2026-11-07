import { ProjectLearningStore } from "./project-learning";
import { ProjectCheckStore } from "./project-check-store";
import { LearningStore } from "./learning-store";
import { HANDOFF_TRACKS, handoffId } from "../handoff/catalog";
import type { AiRun, AiUsage } from "../ai-telemetry";
import { aiAllowance } from "./usage-policy";
import { generationDay } from "./generation-quota";
import { z } from "zod";
import { DOMAIN_IDS } from "../catalog";
import { readFilters } from "../library-state";
import type {
  Attempt,
  HistoryPage,
  LibraryFacets,
  LibraryPage,
  ProblemCheck,
  ProblemSummary,
  Workspace,
} from "../problem";
import { recommendProblem, trainingFromDays } from "../training";
import { HttpError } from "./http";
import { toAttempt, toProgress } from "./store-records";

export type Query = (
  sql: string,
  values?: (string | number)[],
) => Promise<Record<string, unknown>[]>;
const progressColumns =
  "g.problem_id,g.code_revision,g.bookmarked,g.hints_viewed,g.solution_viewed,g.status,g.updated_at";
const cursorSchema = z.object({
  date: z.iso.datetime(),
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
});

export function decodeCursor(value?: string | null) {
  if (!value) return null;
  try {
    if (value.length > 300 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString()));
  } catch {
    throw new HttpError(400, "기록의 페이지 주소가 올바르지 않습니다.");
  }
}

// Catalog rows restored privately from another owner's backup are not part of this library.
const visible = "(c.owner IS NULL OR c.owner=?)";
// Public AI-generated problems the owner chose to hide from their own list.
const notHidden =
  "NOT EXISTS (SELECT 1 FROM hidden_problems h WHERE h.owner=? AND h.problem_id=c.id)";
// Mission and AI lesson records are stored as compact JSON with a top-level `completed` flag.
const COMPLETED = '%"completed":true%';
const LIBRARY_PAGE_SIZE = 12;

/** Parameterized read models shared by both adapters. UI requests never load drafts or the entire bank. */
export class StoreQueries {
  constructor(
    private query: Query,
    private dialect: "sqlite" | "postgres",
  ) {}

  get projectLearning() {
    return new ProjectLearningStore(this.query);
  }

  get projectChecks() {
    return new ProjectCheckStore(this.query, this.dialect);
  }

  get learning() {
    return new LearningStore(this.query);
  }

  async countExistingProblems(problemIds: string[]): Promise<number> {
    const ids = [...new Set(problemIds)];
    let count = 0;
    // Bound parameters for both adapters, without fetching full problem content.
    for (let offset = 0; offset < ids.length; offset += 500) {
      const batch = ids.slice(offset, offset + 500);
      const [row] = await this.query(
        `SELECT COUNT(*) AS count FROM problems WHERE id IN (${batch.map(() => "?").join(",")})`,
        batch,
      );
      count += Number(row.count);
    }
    return count;
  }

  async library(owner: string, params: URLSearchParams): Promise<LibraryPage> {
    const f = readFilters(params);
    // Each clause keeps its bound values; facet counts drop only their own filter.
    const clauses: { sql: string; values: string[]; facet?: keyof LibraryFacets }[] = [
      { sql: visible, values: [owner] },
      { sql: notHidden, values: [owner] },
    ];
    const domain = params.get("domain");
    if (DOMAIN_IDS.includes(domain as (typeof DOMAIN_IDS)[number]))
      clauses.push({ sql: "c.domain=?", values: [domain!] });
    for (const [facet, column, value] of [
      ["level", "difficulty", f.level],
      ["kind", "kind", f.kind],
      ["language", "language", f.language],
      ["source", "source", f.source],
    ] as const) {
      if (value !== "all") clauses.push({ sql: `c.${column}=?`, values: [value], facet });
    }
    if (f.status !== "all")
      clauses.push({ sql: "COALESCE(g.status,'new')=?", values: [f.status], facet: "status" });
    if (params.get("view") === "bookmarks") clauses.push({ sql: "g.bookmarked=1", values: [] });
    if (f.search.trim())
      clauses.push({
        sql: "c.search_text LIKE ? ESCAPE '!'",
        values: [`%${f.search.trim().toLowerCase().replace(/[!%_]/g, "!$&")}%`],
      });
    const from = (without?: keyof LibraryFacets, checks = false) => {
      const used = clauses.filter((clause) => !without || clause.facet !== without);
      const join = checks ? " LEFT JOIN problem_checks k ON k.problem_id=c.id AND k.owner=?" : "";
      return {
        sql: `FROM problem_catalog c LEFT JOIN progress g ON g.problem_id=c.id AND g.owner=?${join} WHERE ${used.map((c) => c.sql).join(" AND ")}`,
        values: [owner, ...(checks ? [owner] : []), ...used.flatMap((c) => c.values)],
      };
    };
    const facetColumns: Record<keyof LibraryFacets, string> = {
      level: "c.difficulty",
      kind: "c.kind",
      language: "c.language",
      source: "c.source",
      status: "COALESCE(g.status,'new')",
    };
    const all = from();
    const [[count], [hidden], ...facetRows] = await Promise.all([
      this.query(`SELECT COUNT(*) AS total ${all.sql}`, all.values),
      this.query("SELECT COUNT(*) AS count FROM hidden_problems WHERE owner=?", [owner]),
      ...(Object.keys(facetColumns) as (keyof LibraryFacets)[]).map((facet) => {
        const scoped = from(facet);
        return this.query(
          `SELECT ${facetColumns[facet]} AS value,COUNT(*) AS count ${scoped.sql} GROUP BY ${facetColumns[facet]}`,
          scoped.values,
        );
      }),
    ]);
    const total = Number(count.total);
    const page = Math.min(f.page, Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)));
    const orders: Record<string, string> = {
      newest: "c.created_at DESC,c.id DESC",
      easy: "CASE c.difficulty WHEN '하' THEN 0 WHEN '중' THEN 1 ELSE 2 END,c.created_at DESC,c.id DESC",
      short: "c.minutes,c.created_at DESC,c.id DESC",
      // Reviewed built-in problems come before public AI-generated ones.
      recommended:
        "CASE WHEN c.id='fe-search-race' THEN 0 WHEN c.source='curated' THEN 1 ELSE 2 END,c.created_at,c.id",
    };
    const listed = from(undefined, true);
    const rows = await this.query(
      `SELECT c.summary,k.kind AS check_kind,${progressColumns} ${listed.sql} ORDER BY ${orders[f.sort]} LIMIT ? OFFSET ?`,
      [...listed.values, LIBRARY_PAGE_SIZE, (page - 1) * LIBRARY_PAGE_SIZE],
    );
    const problems = rows.map((r) => JSON.parse(String(r.summary)) as ProblemSummary);
    return {
      problems,
      progress: Object.fromEntries(
        rows
          .filter((r) => r.problem_id)
          .map((r) => {
            const { code, ...summary } = toProgress(r);
            void code;
            return [String(r.problem_id), summary];
          }),
      ),
      checks: Object.fromEntries(
        rows.flatMap((r, i) =>
          r.check_kind ? [[problems[i].id, String(r.check_kind) as ProblemCheck["kind"]]] : [],
        ),
      ),
      facets: Object.fromEntries(
        (Object.keys(facetColumns) as (keyof LibraryFacets)[]).map((facet, i) => [
          facet,
          Object.fromEntries(facetRows[i].map((r) => [String(r.value), Number(r.count)])),
        ]),
      ) as LibraryFacets,
      hidden: Number(hidden.count),
      total,
      page,
      pageSize: LIBRARY_PAGE_SIZE,
    };
  }

  async workspace(
    owner: string,
    activeId?: string | null,
  ): Promise<Omit<Workspace, "aiReady" | "storage" | "legacyCount" | "account" | "scope">> {
    const passed =
      this.dialect === "sqlite"
        ? "json_extract(review,'$.passed')=1"
        : "(review::jsonb->>'passed')::boolean";
    const day = (column: string) =>
      this.dialect === "sqlite"
        ? `date(${column},'+9 hours')`
        : `((${column}::timestamptz AT TIME ZONE 'Asia/Seoul')::date)::text`;
    const todayStart = Math.floor((Date.now() + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
    const [start, todayEnd] = [todayStart, todayStart + 86400000].map((t) =>
      new Date(t).toISOString(),
    );
    const [
      counts,
      progressCounts,
      recommendation,
      days,
      learningDays,
      independent,
      todayAttempts,
      todayLearning,
      active,
    ] = await Promise.all([
      this.query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN source='ai' THEN 1 ELSE 0 END) AS ai FROM problem_catalog c WHERE ${visible} AND ${notHidden}`,
        [owner, owner],
      ),
      this.query(
        "SELECT SUM(CASE WHEN status='solved' THEN 1 ELSE 0 END) AS solved,SUM(CASE WHEN status='in-progress' THEN 1 ELSE 0 END) AS in_progress,SUM(bookmarked) AS bookmarked FROM progress WHERE owner=?",
        [owner],
      ),
      this.query(
        `SELECT c.summary,${progressColumns} FROM problem_catalog c LEFT JOIN progress g ON g.problem_id=c.id AND g.owner=? WHERE ${visible} AND ${notHidden} ORDER BY CASE COALESCE(g.status,'new') WHEN 'in-progress' THEN 0 WHEN 'new' THEN 1 ELSE 2 END,CASE WHEN g.status='in-progress' THEN g.updated_at ELSE '' END DESC,c.minutes,c.id LIMIT 1`,
        [owner, owner, owner],
      ),
      this.query(
        `SELECT ${day("created_at")} AS day,COUNT(*) AS count FROM attempts WHERE owner=? GROUP BY ${day("created_at")}`,
        [owner],
      ),
      // Missions and AI lessons saved as completed count as a learning day (the day of the
      // completed record's last save). Matching the JSON text works for every dialect and
      // never fails on a row that is not JSON.
      this.query(
        `SELECT DISTINCT ${day("updated_at")} AS day FROM learning_progress WHERE owner=? AND content LIKE ?`,
        [owner, COMPLETED],
      ),
      this.query(
        `SELECT COUNT(DISTINCT problem_id) AS count FROM attempts WHERE owner=? AND assisted=0 AND ${passed} AND created_at<?`,
        [owner, todayEnd],
      ),
      this.query(
        "SELECT SUM(CASE WHEN problem_id LIKE 'handoff-%' THEN 1 ELSE 0 END) AS understanding,SUM(CASE WHEN problem_id LIKE 'handoff-%' THEN 0 ELSE 1 END) AS coding FROM attempts WHERE owner=? AND created_at>=? AND created_at<?",
        [owner, start, todayEnd],
      ),
      this.query(
        "SELECT SUM(CASE WHEN lesson_id LIKE 'ai:%' THEN 1 ELSE 0 END) AS lessons,SUM(CASE WHEN lesson_id LIKE 'ai:%' THEN 0 ELSE 1 END) AS missions FROM learning_progress WHERE owner=? AND content LIKE ? AND updated_at>=? AND updated_at<?",
        [owner, COMPLETED, start, todayEnd],
      ),
      activeId
        ? this.query(`SELECT summary FROM problem_catalog c WHERE id=? AND ${visible}`, [
            activeId,
            owner,
          ])
        : Promise.resolve([]),
    ]);
    const rec = recommendation[0];
    const resume = rec?.status === "in-progress" ? toProgress(rec) : null;
    if (resume) delete (resume as Partial<typeof resume>).code;
    return {
      stats: {
        total: Number(counts[0].total),
        ai: Number(counts[0].ai || 0),
        solved: Number(progressCounts[0].solved || 0),
        inProgress: Number(progressCounts[0].in_progress || 0),
        bookmarked: Number(progressCounts[0].bookmarked || 0),
        attempts: days.reduce((sum, r) => sum + Number(r.count), 0),
      },
      recommended: rec ? JSON.parse(String(rec.summary)) : null,
      resume,
      activeProblem: active[0] ? JSON.parse(String(active[0].summary)) : null,
      training: {
        ...trainingFromDays(
          [...days, ...learningDays].map((r) => Date.parse(String(r.day)) / 86400000),
          Number(independent[0].count),
        ),
        today: {
          coding: Number(todayAttempts[0]?.coding || 0),
          understanding: Number(todayAttempts[0]?.understanding || 0),
          missions: Number(todayLearning[0]?.missions || 0),
          lessons: Number(todayLearning[0]?.lessons || 0),
        },
      },
    };
  }

  /** Newest reviews first. "unsolved" lists the latest review of each problem not yet solved. */
  async history(
    owner: string,
    cursorValue?: string | null,
    filter: "all" | "unsolved" = "all",
  ): Promise<HistoryPage> {
    const cursor = decodeCursor(cursorValue);
    const after = cursor ? "AND (a.created_at<? OR (a.created_at=? AND a.id<?))" : "";
    const cursorValues = cursor ? [cursor.date, cursor.date, cursor.id] : [];
    const rows =
      filter === "unsolved"
        ? await this.query(
            `SELECT a.id,a.problem_id,a.review,a.assisted,a.created_at,c.title FROM (
            SELECT id,problem_id,review,assisted,created_at,
              ROW_NUMBER() OVER (PARTITION BY problem_id ORDER BY created_at DESC,id DESC) AS latest
            FROM attempts WHERE owner=?
          ) a JOIN problem_catalog c ON c.id=a.problem_id
          LEFT JOIN progress g ON g.owner=? AND g.problem_id=a.problem_id
          WHERE a.latest=1 AND COALESCE(g.status,'new')<>'solved' ${after}
          ORDER BY a.created_at DESC,a.id DESC LIMIT 21`,
            [owner, owner, ...cursorValues],
          )
        : await this.query(
            `SELECT a.id,a.problem_id,a.review,a.assisted,a.created_at,c.title FROM attempts a JOIN problem_catalog c ON c.id=a.problem_id WHERE a.owner=? ${after} ORDER BY a.created_at DESC,a.id DESC LIMIT 21`,
            [owner, ...cursorValues],
          );
    const attempts = rows.slice(0, 20).map((row) => {
      const { code, ...summary } = toAttempt(row);
      void code;
      return { ...summary, problemTitle: String(row.title) };
    });
    const last = attempts.at(-1);
    return {
      attempts,
      nextCursor:
        rows.length > 20 && last
          ? Buffer.from(JSON.stringify({ date: last.createdAt, id: last.id })).toString("base64url")
          : null,
    };
  }

  /** A status separate from "solved". Example-test results are reported by the browser. */
  async problemCheck(owner: string, problemId: string): Promise<ProblemCheck | null> {
    const [row] = await this.query(
      "SELECT kind,passed,total,updated_at FROM problem_checks WHERE owner=? AND problem_id=?",
      [owner, problemId],
    );
    return row
      ? {
          kind: String(row.kind) as ProblemCheck["kind"],
          passed: Number(row.passed),
          total: Number(row.total),
          updatedAt: String(row.updated_at),
        }
      : null;
  }

  async saveProblemCheck(
    owner: string,
    problemId: string,
    check: Pick<ProblemCheck, "kind" | "passed" | "total">,
  ): Promise<ProblemCheck> {
    const updatedAt = new Date().toISOString();
    await this.query(
      "INSERT INTO problem_checks(owner,problem_id,kind,passed,total,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner,problem_id) DO UPDATE SET kind=excluded.kind,passed=excluded.passed,total=excluded.total,updated_at=excluded.updated_at",
      [owner, problemId, check.kind, check.passed, check.total, updatedAt],
    );
    return { ...check, updatedAt };
  }

  /** Only a self-check can be withdrawn; a recorded test pass stays like other history. */
  async clearSelfCheck(owner: string, problemId: string) {
    await this.query("DELETE FROM problem_checks WHERE owner=? AND problem_id=? AND kind='self'", [
      owner,
      problemId,
    ]);
  }

  /** Hides a public AI-generated problem from this owner's list only. */
  async hideProblem(owner: string, problemId: string) {
    const [problem] = await this.query(
      `SELECT c.source FROM problem_catalog c WHERE c.id=? AND ${visible}`,
      [problemId, owner],
    );
    if (!problem) throw new HttpError(404, "문제를 찾을 수 없습니다.");
    if (problem.source !== "ai")
      throw new HttpError(400, "AI 생성 문제만 목록에서 숨길 수 있습니다.");
    await this.query(
      "INSERT INTO hidden_problems(owner,problem_id,created_at) VALUES (?,?,?) ON CONFLICT(owner,problem_id) DO NOTHING",
      [owner, problemId, new Date().toISOString()],
    );
  }

  async isHidden(owner: string, problemId: string) {
    return (
      (
        await this.query("SELECT 1 AS hidden FROM hidden_problems WHERE owner=? AND problem_id=?", [
          owner,
          problemId,
        ])
      ).length > 0
    );
  }

  async unhideProblems(owner: string, problemId?: string) {
    if (problemId)
      await this.query("DELETE FROM hidden_problems WHERE owner=? AND problem_id=?", [
        owner,
        problemId,
      ]);
    else await this.query("DELETE FROM hidden_problems WHERE owner=?", [owner]);
  }

  /** Coding problems to offer after one: the overall recommendation and the next unsolved
   * problem of the same domain in list order. Understanding tasks keep their own flow. */
  async nextProblems(
    owner: string,
    problemId: string,
  ): Promise<{ recommended: ProblemSummary | null; sameDomain: ProblemSummary | null }> {
    const [current] = await this.query(
      `SELECT c.domain,c.source,c.created_at FROM problem_catalog c WHERE c.id=? AND ${visible}`,
      [problemId, owner],
    );
    if (!current) throw new HttpError(404, "문제를 찾을 수 없습니다.");
    const base = `FROM problem_catalog c LEFT JOIN progress g ON g.problem_id=c.id AND g.owner=? WHERE ${visible} AND ${notHidden} AND c.id<>? AND c.id NOT LIKE 'handoff-%' AND COALESCE(g.status,'new')<>'solved'`;
    const [candidates, domainRows] = await Promise.all([
      // Ordered like recommendProblem so its choice is within this bounded set.
      this.query(
        `SELECT c.summary,${progressColumns} ${base} ORDER BY CASE WHEN g.status='in-progress' THEN 0 ELSE 1 END,CASE WHEN g.status='in-progress' THEN g.updated_at ELSE '' END DESC,c.minutes,c.id LIMIT 20`,
        [owner, owner, owner, problemId],
      ),
      this.query(
        `SELECT c.summary,c.source,c.created_at ${base} AND c.domain=? ORDER BY CASE WHEN c.source='curated' THEN 0 ELSE 1 END,c.created_at,c.id LIMIT 50`,
        [owner, owner, owner, problemId, String(current.domain)],
      ),
    ]);
    const summaries = candidates.map((r) => JSON.parse(String(r.summary)) as ProblemSummary);
    const progress = Object.fromEntries(
      candidates
        .filter((r) => r.problem_id)
        .map((r) => {
          const { code, ...summary } = toProgress(r);
          void code;
          return [String(r.problem_id), summary];
        }),
    );
    const key = (row: Record<string, unknown>) =>
      `${row.source === "curated" ? 0 : 1}|${String(row.created_at)}`;
    const currentKey = key(current);
    const after =
      domainRows.find(
        (r) =>
          key(r) > currentKey ||
          (key(r) === currentKey &&
            (JSON.parse(String(r.summary)) as ProblemSummary).id > problemId),
      ) ?? domainRows[0];
    return {
      recommended: recommendProblem(summaries, progress) ?? null,
      sameDomain: after ? (JSON.parse(String(after.summary)) as ProblemSummary) : null,
    };
  }

  async recentAttempts(
    owner: string,
    problemId: string,
    selectedId?: string | null,
  ): Promise<Attempt[]> {
    const rows = await this.query(
      "SELECT * FROM attempts WHERE owner=? AND problem_id=? ORDER BY created_at DESC,id DESC LIMIT 20",
      [owner, problemId],
    );
    if (selectedId && !rows.some((r) => r.id === selectedId)) {
      rows.push(
        ...(await this.query("SELECT * FROM attempts WHERE owner=? AND problem_id=? AND id=?", [
          owner,
          problemId,
          selectedId,
        ])),
      );
    }
    return rows.map(toAttempt);
  }

  async titles(domain: string) {
    return (
      await this.query(
        "SELECT title FROM problem_catalog WHERE domain=? AND owner IS NULL ORDER BY created_at DESC,id DESC LIMIT 50",
        [domain],
      )
    ).map((r) => String(r.title));
  }
  async handoffProgress(owner: string): Promise<import("../handoff/learning").HandoffProgress[]> {
    const ids = HANDOFF_TRACKS.flatMap((t) => [handoffId(t.key), handoffId(t.key, true)]);
    const rows = await this.query(
      `SELECT problem_id, CASE WHEN code IS NOT NULL THEN 1 ELSE 0 END AS has_draft FROM progress WHERE owner=? AND problem_id IN (${ids.map(() => "?").join(",")})`,
      [owner, ...ids],
    );
    return rows.map((row) => ({
      problemId: String(row.problem_id),
      hasDraft: Boolean(row.has_draft),
    }));
  }

  async handoffAttempts(owner: string): Promise<import("../problem").AttemptSummary[]> {
    const ids = HANDOFF_TRACKS.flatMap((t) => [handoffId(t.key), handoffId(t.key, true)]);
    // At most two rows per exercise: latest feedback and first transfer attempt.
    // Never select private code or another owner's records into the dashboard.
    const rows = await this.query(
      `SELECT id,problem_id,review,assisted,created_at FROM (
      SELECT id,problem_id,review,assisted,created_at,
        ROW_NUMBER() OVER (PARTITION BY problem_id ORDER BY created_at DESC,id DESC) AS latest,
        ROW_NUMBER() OVER (PARTITION BY problem_id ORDER BY created_at ASC,id ASC) AS first
      FROM attempts WHERE owner=? AND problem_id IN (${ids.map(() => "?").join(",")})
    ) ranked WHERE latest=1 OR first=1`,
      [owner, ...ids],
    );
    return rows.map((row) => ({
      id: String(row.id),
      problemId: String(row.problem_id),
      review: JSON.parse(String(row.review)),
      assisted: Boolean(row.assisted),
      createdAt: String(row.created_at),
    }));
  }

  async releaseLimits(keys: string[], now = Date.now()) {
    for (const key of keys)
      await this.query("UPDATE limits SET count=count-1 WHERE key=? AND count>0 AND expires>?", [
        key,
        now,
      ]);
  }

  async recordAiRun(owner: string, run: AiRun) {
    await this.query(
      "INSERT INTO ai_runs(id,owner,operation,created_at,content) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      [run.id, owner, run.operation, run.createdAt, JSON.stringify(run)],
    );
  }
  /** Return one unit to each live window, e.g. after a failure the visitor should not pay for. */
  async refundLimits(keys: string[], now = Date.now()) {
    for (const key of keys)
      await this.query("UPDATE limits SET count=count-1 WHERE key=? AND count>0 AND expires>?", [
        key,
        now,
      ]);
  }
  async usage(owner: string, now = Date.now()): Promise<AiUsage> {
    const numeric = (field: string) =>
      this.dialect === "sqlite"
        ? `json_extract(content,'$.${field}')`
        : `(content::jsonb->>'${field}')::numeric`;
    const outcome =
      this.dialect === "sqlite"
        ? "json_extract(content,'$.outcome')"
        : "content::jsonb->>'outcome'";
    const day = generationDay(now);
    const [limits, [totals], [generation]] = await Promise.all([
      this.query("SELECT key,count,expires FROM limits WHERE key IN (?,?) AND expires>?", [
        `ai:generate:${owner}`,
        `ai:review:${owner}`,
        now,
      ]),
      this.query(
        `SELECT COUNT(*) AS requests,SUM(CASE WHEN ${outcome}='error' THEN 1 ELSE 0 END) AS failures,SUM(${numeric("inputTokens")}) AS input,SUM(${numeric("outputTokens")}) AS output,AVG(${numeric("latencyMs")}) AS latency,SUM(${numeric("estimatedCostUsd")}) AS cost,SUM(CASE WHEN ${numeric("estimatedCostUsd")} IS NULL THEN 1 ELSE 0 END) AS unmetered FROM ai_runs WHERE owner=? AND created_at>=?`,
        [owner, new Date(now - 30 * 86400000).toISOString()],
      ),
      this.query(
        "SELECT COUNT(*) AS count FROM generation_usage WHERE owner=? AND day=? AND (state='done' OR expires>?)",
        [owner, day.key, now],
      ),
    ]);
    const allowance = aiAllowance(owner);
    const remaining: AiUsage["remaining"] = { ...allowance };
    const resetsAt: AiUsage["resetsAt"] = { generate: null, review: null };
    for (const kind of ["generate", "review"] as const) {
      const row = limits.find((r) => r.key === `ai:${kind}:${owner}`);
      remaining[kind] = Math.max(0, allowance[kind] - Number(row?.count || 0));
      resetsAt[kind] = row ? new Date(Number(row.expires)).toISOString() : null;
    }
    remaining.generate = Math.max(0, allowance.generate - Number(generation.count));
    resetsAt.generate = new Date(day.resetsAt).toISOString();
    return {
      canGenerate: true,
      allowance,
      remaining,
      resetsAt,
      last30Days: {
        requests: Number(totals.requests),
        failures: Number(totals.failures || 0),
        inputTokens: Number(totals.input || 0),
        outputTokens: Number(totals.output || 0),
        averageLatencyMs: Math.round(Number(totals.latency || 0)),
        estimatedCostUsd: Number(totals.cost || 0),
        unmeteredRequests: Number(totals.unmetered || 0),
      },
    };
  }
}
