import { afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { storageSchema } from "../../src/lib/server/storage-schema.mjs";
import { authSchema } from "../../src/lib/server/auth-schema.mjs";
import { readMigrationData } from "./migration-data.mjs";

describe("SQLite migration source", () => {
  const databases = [];
  function database(schema) {
    const db = new DatabaseSync(":memory:");
    databases.push(db);
    db.exec(schema);
    return db;
  }
  afterEach(() => databases.splice(0).forEach((db) => db.close()));

  it("preserves each owner's beginner record, revision and timestamp", () => {
    const source = database(storageSchema);
    const content = JSON.stringify({ reason: "다른 기기에서 작성한 예상", stage: 2 });
    const at = "2026-09-18T00:00:00.000Z";
    const insert = source.prepare("INSERT INTO learning_progress VALUES (?,?,?,?,?)");
    insert.run("alice", "broken-memo", content, 7, at);
    insert.run("bob", "broken-memo", "{}", 2, at);
    const data = [...readMigrationData(source)].find(
      (entry) => entry.table === "learning_progress",
    );
    expect(data.columns).toEqual(["owner", "lesson_id", "content", "revision", "updated_at"]);
    expect(data.rows).toEqual([
      ["alice", "broken-memo", content, 7, at],
      ["bob", "broken-memo", "{}", 2, at],
    ]);
    expect(
      source.prepare("SELECT revision FROM learning_progress WHERE owner='alice'").get().revision,
    ).toBe(7);
  });

  it("reads older databases without learning records and supplies missing code revisions", () => {
    const source = database(`CREATE TABLE progress (
      owner TEXT, problem_id TEXT, code TEXT, bookmarked INTEGER,
      hints_viewed INTEGER, solution_viewed INTEGER, status TEXT, updated_at TEXT
    ); INSERT INTO progress VALUES ('alice','empty',NULL,0,0,0,'new','old'),
      ('alice','draft','print(1)',1,0,0,'in-progress','old');`);
    const entries = [...readMigrationData(source)];
    expect(entries.map((entry) => entry.table)).toEqual(["progress"]);
    expect(entries[0].rows.map((row) => [row[1], row[3]])).toEqual([
      ["empty", 0],
      ["draft", 1],
    ]);
  });

  it("converts auth values while excluding sessions, in-flight jobs and rebuildable catalog", () => {
    const source = database(storageSchema + authSchema("sqlite"));
    source
      .prepare(
        `INSERT INTO auth_user (id,name,email,"emailVerified","createdAt","updatedAt") VALUES (?,?,?,?,?,?)`,
      )
      .run("alice", "연습 계정", "alice@example.test", 1, 0, 1000);
    const entries = [...readMigrationData(source)];
    expect(entries.find((entry) => entry.table === "auth_user").rows[0]).toEqual([
      "alice",
      "연습 계정",
      "alice@example.test",
      true,
      null,
      "1970-01-01T00:00:00.000Z",
      "1970-01-01T00:00:01.000Z",
      null,
    ]);
    for (const excluded of ["auth_session", "auth_verification", "jobs", "problem_catalog"])
      expect(entries.map((entry) => entry.table)).not.toContain(excluded);
  });
});
