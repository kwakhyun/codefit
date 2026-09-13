import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { storageSchema } from "../src/lib/server/storage-schema.mjs";

const sourcePath = process.argv[2] || "data/recode.sqlite";
const vars = process.argv[3] ? parseEnv(readFileSync(process.argv[3], "utf8")) : process.env;
const url = vars.DATABASE_URL_UNPOOLED || vars.POSTGRES_URL_NON_POOLING || vars.DATABASE_URL;
if (!url)
  throw new Error(
    "DATABASE_URL is required. Pass an ignored environment file as the second argument.",
  );
const source = new DatabaseSync(sourcePath, { readOnly: true });
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const tables = {
  problems: ["id", "content", "created_at"],
  progress: [
    "owner",
    "problem_id",
    "code",
    "bookmarked",
    "hints_viewed",
    "solution_viewed",
    "status",
    "updated_at",
  ],
  attempts: ["id", "owner", "problem_id", "code", "review", "assisted", "created_at"],
  legacy: ["owner", "content", "created_at"],
  ai_runs: ["id", "owner", "operation", "created_at", "content"],
};
try {
  const counts = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(704712001)`;
    await tx.unsafe(storageSchema);
    const result = {};
    for (const [table, columns] of Object.entries(tables)) {
      if (!source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
        continue;
      const rows = source.prepare(`SELECT ${columns.join(",")} FROM ${table}`).all();
      let inserted = 0;
      for (const row of rows) {
        const values = columns.map((key) => row[key]);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
        const changes = await tx.unsafe(
          `INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING RETURNING 1`,
          values,
        );
        inserted += changes.length;
      }
      result[table] = { source: rows.length, inserted };
    }
    return result;
  });
  console.log("Migration completed atomically. Existing cloud records were preserved.");
  console.log(JSON.stringify(counts, null, 2));
} finally {
  source.close();
  await sql.end();
}
