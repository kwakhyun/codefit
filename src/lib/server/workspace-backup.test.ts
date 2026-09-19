import { afterEach, beforeEach, expect, it } from "vitest";
import { BACKUP_MAX_BYTES } from "../backup-limits";
import { SqliteStore } from "./sqlite-store";
import { workspaceBackupContract } from "./workspace-backup-contract.test-helper";
import { seedProblems } from "../../data/problems";
let store: SqliteStore;
beforeEach(() => {
  store = new SqliteStore(":memory:");
});
afterEach(() => store.db.close());
workspaceBackupContract(() => store);
it("backup excludes over 2500 unrelated public problems instead of creating an unimportable file", () => {
  const insert = store.db.prepare("INSERT INTO problems VALUES (?,?,?)");
  store.db.exec("BEGIN");
  for (let i = 0; i < 2501; i++) {
    const p = { ...seedProblems[0], id: `unrelated-${i}` };
    insert.run(p.id, JSON.stringify(p), p.createdAt);
  }
  store.db.exec("COMMIT");
  store.saveProgress("owner", seedProblems[0].id, { code: "내 코드", baseRevision: 0 });
  expect(store.exportBackup("owner").problems).toHaveLength(1);
});
it("backup rejects a file above the exact UTF-8 byte limit instead of silently truncating", () => {
  store.archiveLegacy("owner", "가".repeat(Math.ceil(BACKUP_MAX_BYTES / 3)));
  expect(() => store.exportBackup("owner")).toThrow(/4 MB/);
});
it("backup rolls back coding and lesson inserts when a later project review write fails", async () => {
  const { learningFixture } = await import("./project-learning-contract.test-helper");
  const { emptyLearning } = await import("../learn/progress");
  const { owner } = await learningFixture(store);
  store.saveProgress(owner, seedProblems[0].id, { code: "source", baseRevision: 0 });
  await store.queries.learning.save(owner, "where-data-lives", JSON.stringify(emptyLearning()), 0);
  const file = store.exportBackup(owner);
  store.db.exec(
    "CREATE TRIGGER reject_restored_review BEFORE INSERT ON jobs WHEN NEW.owner='rollback-target' AND NEW.kind LIKE 'project-review:%' BEGIN SELECT RAISE(ABORT, 'injected restore failure'); END",
  );
  expect(() => store.importBackup("rollback-target", file)).toThrow();
  expect(store.progress("rollback-target")).toEqual({});
  expect(await store.queries.learning.all("rollback-target")).toEqual([]);
  expect(await store.queries.projectChecks.list("rollback-target")).toEqual([]);
  expect(
    store.db
      .prepare("SELECT COUNT(*) AS n FROM restored_problems WHERE owner='rollback-target'")
      .get()?.n,
  ).toBe(0);
});

it("export accepts the exact byte limit but rejects the next byte", () => {
  store.archiveLegacy("owner", "한글");
  const overhead = Buffer.byteLength(JSON.stringify(store.exportBackup("owner")));
  store.db
    .prepare("UPDATE legacy SET content=? WHERE owner=?")
    .run(JSON.stringify("한글" + "a".repeat(BACKUP_MAX_BYTES - overhead)), "owner");
  expect(Buffer.byteLength(JSON.stringify(store.exportBackup("owner")))).toBe(BACKUP_MAX_BYTES);
  store.db
    .prepare("UPDATE legacy SET content=? WHERE owner=?")
    .run(JSON.stringify("한글" + "a".repeat(BACKUP_MAX_BYTES - overhead + 1)), "owner");
  expect(() => store.exportBackup("owner")).toThrow(/4 MB/);
});
