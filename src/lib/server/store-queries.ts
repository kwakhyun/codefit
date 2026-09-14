import { HANDOFF_TRACKS, handoffId } from "../handoff/catalog";
import type { AiRun, AiUsage } from "../ai-telemetry";
import { AI_ALLOWANCE } from "./usage-policy";
import { generationDay } from "./generation-quota";
import { z } from "zod";
import { DOMAIN_IDS } from "../catalog";
import { readFilters } from "../library-state";
import type { Attempt, HistoryPage, LibraryPage, ProblemSummary, Workspace } from "../problem";
import { trainingFromDays } from "../training";
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

/** Parameterized read models shared by both adapters. UI requests never load drafts or the entire bank. */
export class StoreQueries {
  constructor(
    private query: Query,
    private dialect: "sqlite" | "postgres",
  ) {}

  async library(owner: string, params: URLSearchParams): Promise<LibraryPage> {
    const f = readFilters(params);
    const values: (string | number)[] = [owner];
    const where: string[] = [];
    const domain = params.get("domain");
    if (DOMAIN_IDS.includes(domain as (typeof DOMAIN_IDS)[number])) {
      where.push("c.domain=?");
      values.push(domain!);
    }
    for (const [column, value] of [
      ["difficulty", f.level],
      ["kind", f.kind],
      ["language", f.language],
      ["source", f.source],
    ]) {
      if (value !== "all") {
        where.push(`c.${column}=?`);
        values.push(value);
      }
    }
    if (f.status !== "all") {
      where.push("COALESCE(g.status,'new')=?");
      values.push(f.status);
    }
    if (params.get("view") === "bookmarks") where.push("g.bookmarked=1");
    if (f.search.trim()) {
      where.push("c.search_text LIKE ? ESCAPE '!'");
      values.push(`%${f.search.trim().toLowerCase().replace(/[!%_]/g, "!$&")}%`);
    }
    const from = `FROM problem_catalog c LEFT JOIN progress g ON g.problem_id=c.id AND g.owner=? ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
    const [count] = await this.query(`SELECT COUNT(*) AS total ${from}`, values);
    const total = Number(count.total),
      pageSize = 8;
    const page = Math.min(f.page, Math.max(1, Math.ceil(total / pageSize)));
    const orders: Record<string, string> = {
      newest: "c.created_at DESC,c.id DESC",
      easy: "CASE c.difficulty WHEN '하' THEN 0 WHEN '중' THEN 1 ELSE 2 END,c.created_at DESC,c.id DESC",
      short: "c.minutes,c.created_at DESC,c.id DESC",
      recommended:
        "CASE WHEN c.id='fe-search-race' THEN 0 WHEN c.source='ai' THEN 1 ELSE 2 END,c.created_at,c.id",
    };
    const rows = await this.query(
      `SELECT c.summary,${progressColumns} ${from} ORDER BY ${orders[f.sort]} LIMIT ? OFFSET ?`,
      [...values, pageSize, (page - 1) * pageSize],
    );
    return {
      problems: rows.map((r) => JSON.parse(String(r.summary)) as ProblemSummary),
      progress: Object.fromEntries(
        rows
          .filter((r) => r.problem_id)
          .map((r) => {
            const { code, ...summary } = toProgress(r);
            void code;
            return [String(r.problem_id), summary];
          }),
      ),
      total,
      page,
      pageSize,
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
    const day =
      this.dialect === "sqlite"
        ? "date(created_at,'+9 hours')"
        : "((created_at::timestamptz AT TIME ZONE 'Asia/Seoul')::date)::text";
    const todayEnd = new Date(
      Math.floor((Date.now() + 9 * 3600000) / 86400000) * 86400000 + 15 * 3600000,
    ).toISOString();
    const [counts, progressCounts, recommendation, days, independent, active] = await Promise.all([
      this.query(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN source='ai' THEN 1 ELSE 0 END) AS ai FROM problem_catalog",
      ),
      this.query(
        "SELECT SUM(CASE WHEN status='solved' THEN 1 ELSE 0 END) AS solved,SUM(CASE WHEN status='in-progress' THEN 1 ELSE 0 END) AS in_progress,SUM(bookmarked) AS bookmarked FROM progress WHERE owner=?",
        [owner],
      ),
      this.query(
        `SELECT c.summary,${progressColumns} FROM problem_catalog c LEFT JOIN progress g ON g.problem_id=c.id AND g.owner=? ORDER BY CASE COALESCE(g.status,'new') WHEN 'in-progress' THEN 0 WHEN 'new' THEN 1 ELSE 2 END,CASE WHEN g.status='in-progress' THEN g.updated_at ELSE '' END DESC,c.minutes,c.id LIMIT 1`,
        [owner],
      ),
      this.query(
        `SELECT ${day} AS day,COUNT(*) AS count FROM attempts WHERE owner=? GROUP BY ${day}`,
        [owner],
      ),
      this.query(
        `SELECT COUNT(DISTINCT problem_id) AS count FROM attempts WHERE owner=? AND assisted=0 AND ${passed} AND created_at<?`,
        [owner, todayEnd],
      ),
      activeId
        ? this.query("SELECT summary FROM problem_catalog WHERE id=?", [activeId])
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
      training: trainingFromDays(
        days.map((r) => Date.parse(String(r.day)) / 86400000),
        Number(independent[0].count),
      ),
    };
  }

  async history(owner: string, cursorValue?: string | null): Promise<HistoryPage> {
    const cursor = decodeCursor(cursorValue);
    const rows = await this.query(
      `SELECT a.id,a.problem_id,a.review,a.assisted,a.created_at,c.title FROM attempts a JOIN problem_catalog c ON c.id=a.problem_id WHERE a.owner=? ${cursor ? "AND (a.created_at<? OR (a.created_at=? AND a.id<?))" : ""} ORDER BY a.created_at DESC,a.id DESC LIMIT 21`,
      cursor ? [owner, cursor.date, cursor.date, cursor.id] : [owner],
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
        "SELECT title FROM problem_catalog WHERE domain=? ORDER BY created_at DESC,id DESC LIMIT 50",
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

  async recordAiRun(owner: string, run: AiRun) {
    await this.query(
      "INSERT INTO ai_runs(id,owner,operation,created_at,content) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      [run.id, owner, run.operation, run.createdAt, JSON.stringify(run)],
    );
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
    const remaining: AiUsage["remaining"] = { ...AI_ALLOWANCE };
    const resetsAt: AiUsage["resetsAt"] = { generate: null, review: null };
    for (const kind of ["generate", "review"] as const) {
      const row = limits.find((r) => r.key === `ai:${kind}:${owner}`);
      remaining[kind] = Math.max(0, AI_ALLOWANCE[kind] - Number(row?.count || 0));
      resetsAt[kind] = row ? new Date(Number(row.expires)).toISOString() : null;
    }
    const canGenerate = owner.startsWith("user:");
    remaining.generate = canGenerate
      ? Math.max(0, AI_ALLOWANCE.generate - Number(generation.count))
      : 0;
    resetsAt.generate = new Date(day.resetsAt).toISOString();
    return {
      canGenerate,
      allowance: AI_ALLOWANCE,
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
