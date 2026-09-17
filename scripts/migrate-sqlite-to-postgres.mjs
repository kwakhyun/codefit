import { DatabaseSync } from "node:sqlite";
import { readMigrationData } from "./lib/migration-data.mjs";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { authSchema } from "../src/lib/server/auth-schema.mjs";
import { storageSchema, storageColumns } from "../src/lib/server/storage-schema.mjs";

const sourcePath = process.argv[2] || "data/recode.sqlite";
const vars = process.argv[3] ? parseEnv(readFileSync(process.argv[3], "utf8")) : process.env;
const url = vars.DATABASE_URL_UNPOOLED || vars.POSTGRES_URL_NON_POOLING || vars.DATABASE_URL;
if (!url)
  throw new Error(
    "DATABASE_URL is required. Pass an ignored environment file as the second argument.",
  );
const source = new DatabaseSync(sourcePath, { readOnly: true });
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  const counts = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(704712001)`;
    await tx.unsafe(storageSchema);
    for (const [table, column, definition] of storageColumns)
      await tx.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    await tx.unsafe(authSchema("postgres"));
    const result = {};
    for (const { table, columns, rows } of readMigrationData(source)) {
      let inserted = 0;
      for (const values of rows) {
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
        const changes = await tx.unsafe(
          `INSERT INTO ${table} (${columns.map((key) => `"${key}"`).join(",")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING RETURNING 1`,
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
