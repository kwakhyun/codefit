const tables = {
  auth_user: ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "bio"],
  auth_account: [
    "id",
    "accountId",
    "providerId",
    "userId",
    "accessToken",
    "refreshToken",
    "idToken",
    "accessTokenExpiresAt",
    "refreshTokenExpiresAt",
    "scope",
    "password",
    "createdAt",
    "updatedAt",
  ],
  generation_usage: ["request_id", "owner", "day", "state", "expires"],
  problems: ["id", "content", "created_at"],
  restored_problems: ["owner", "problem_id"],
  progress: [
    "owner",
    "problem_id",
    "code",
    "code_revision",
    "bookmarked",
    "hints_viewed",
    "solution_viewed",
    "status",
    "updated_at",
  ],
  learning_progress: ["owner", "lesson_id", "content", "revision", "updated_at"],
  attempts: ["id", "owner", "problem_id", "code", "review", "assisted", "created_at"],
  legacy: ["owner", "content", "created_at"],
  ai_runs: ["id", "owner", "operation", "created_at", "content"],
};

/** Read only durable records. Sessions, job leases and derived catalog rows stay local. */
export function* readMigrationData(source) {
  for (const [table, columns] of Object.entries(tables)) {
    if (!source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
      continue;
    const available = new Set(
      source
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => row.name),
    );
    const selection = columns
      .map((key) =>
        key === "code_revision" && !available.has(key)
          ? "CASE WHEN code IS NULL THEN 0 ELSE 1 END AS code_revision"
          : `"${key}"`,
      )
      .join(",");
    const rows = source
      .prepare(`SELECT ${selection} FROM ${table}`)
      .all()
      .map((row) =>
        columns.map((key) => {
          const value = row[key];
          if (value == null) return null;
          if (key === "emailVerified") return Boolean(value);
          if (table.startsWith("auth_") && key.endsWith("At")) return new Date(value).toISOString();
          return value;
        }),
      );
    yield { table, columns, rows };
  }
  // Completed project jobs are durable private learning records, not disposable leases.
  if (source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='jobs'").get()) {
    const columns = ["id", "owner", "kind", "state", "result", "expires", "token", "fingerprint"];
    const available = new Set(
      source
        .prepare("PRAGMA table_info(jobs)")
        .all()
        .map((row) => row.name),
    );
    if (columns.every((column) => available.has(column))) {
      const records = source
        .prepare(
          "SELECT * FROM jobs WHERE state='done' AND (kind='project-analysis' OR kind LIKE 'project-review:%' OR kind LIKE 'project-dialogue:%' OR kind LIKE 'project-practice:%')",
        )
        .all();
      if (records.length)
        yield {
          table: "jobs",
          columns,
          rows: records.map((row) => columns.map((column) => row[column])),
        };
    }
  }
}
