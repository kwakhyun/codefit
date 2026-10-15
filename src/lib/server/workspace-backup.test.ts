import { afterEach, beforeEach, expect, it } from "vitest";
import { BACKUP_MAX_BYTES } from "../backup-limits";
import { SqliteStore } from "./sqlite-store";
import { workspaceBackupContract } from "./workspace-backup-contract.test-helper";
import { seedProblems } from "../../data/problems";
import { fixtureVerificationRecord } from "../project-check/fixtures";
import { validateReview } from "../problem";
import { digest } from "./backup-transfer";
let store: SqliteStore;
beforeEach(() => {
  store = new SqliteStore(":memory:");
});
afterEach(() => store.db.close());
workspaceBackupContract(() => store);
it("backup retries charge only new attempts and a volume rejection rolls back records and allowances", () => {
  const problem = seedProblems[0];
  const review = validateReview(
    {
      summary: "요구사항별로 코드를 검토했습니다.",
      criteria: problem.requirements.map((_, requirementIndex) => ({
        requirementIndex,
        passed: true,
        feedback: "코드의 동작을 확인했습니다.",
      })),
      strengths: [],
      improvements: [],
    },
    problem,
  );
  store.saveAttempt("source", problem.id, "original submission", review);
  const { parts, manifest } = store.exportBackupParts("source", new Date().toISOString());
  const input = { version: 4 as const, manifest, index: 0, backup: parts[0] };
  expect(store.importBackupPart("target", input, "test").attempts).toBe(1);
  expect(
    store.consumeLimits([
      { key: "import:attempts", max: 1_000_000, cost: 999_999, windowMs: 86400000 },
    ]),
  ).toBe(true);
  expect(store.importBackupPart("target", input, "test").attempts).toBe(0);
  const backup = structuredClone(parts[0]);
  backup.attempts[0].id = "second-submission";
  const hashes = [digest(backup)];
  const next = { ...input, backup, manifest: { id: digest(hashes), hashes } };
  expect(() => store.importBackupPart("target", next, "test")).toThrow(/한도/);
  expect(store.attempts("target")).toHaveLength(1);
  expect(store.db.prepare("SELECT count FROM limits WHERE key='import:target'").get()?.count).toBe(
    1,
  );
  expect(
    store.db.prepare("SELECT count FROM limits WHERE key='import:parts:target'").get()?.count,
  ).toBe(2);
  expect(
    store.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind='backup-import'").get()?.n,
  ).toBe(1);
  // After the next window opens, retry the same file and continue past its restored prefix.
  store.db.prepare("UPDATE limits SET expires=0 WHERE key='import:attempts'").run();
  expect(store.importBackupPart("target", input, "test").attempts).toBe(0);
  expect(store.importBackupPart("target", next, "test").attempts).toBe(1);
  expect(store.attempts("target")).toHaveLength(2);
});
it("backup excludes over 2500 unrelated public problems instead of creating an unimportable file", () => {
  const insert = store.db.prepare("INSERT INTO problems (id,content,created_at) VALUES (?,?,?)");
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

it("round-trips captured screens, project evidence and previous answers without changing their scores", async () => {
  const { learningFixture } = await import("./project-learning-contract.test-helper");
  const { restoredProjectId } = await import("./workspace-backup");
  const { owner, id } = await learningFixture(store);
  const file = store.exportBackup(owner);
  if (file.version !== 3) throw Error();
  const check = file.projects[0].check as import("../project-check/types").StoredCheck;
  const review = file.projects[0].review as NonNullable<
    import("../project-check/types").Check["review"]
  >;
  const { fixtureVerificationPlan } = await import("../project-check/fixtures");
  review.assessment.feedback[0].verificationPlan = fixtureVerificationPlan;
  check.page.source = "rendered";
  check.page.captures = [
    { url: "https://example.com/", title: "화면", text: "직접 수집한 본문", screenshot: "YWJj" },
  ];
  check.previousReview = {
    answers: [...review.answers],
    assessment: structuredClone(review.assessment),
  };
  check.revisionNumber = 1;
  review.practice = {
    revision: 1,
    tasks: Array.from({ length: 5 }, (_, questionIndex) => ({
      questionIndex,
      status: "observed" as const,
      result: "조건을 바꾸고 차단 문구를 확인했습니다.",
      ...(questionIndex === 0 ? { verification: fixtureVerificationRecord } : {}),
    })),
  };
  store.importBackup("target", file);
  const detail = await store.queries.projectChecks.detail(
    "target",
    restoredProjectId("target", id),
  );
  expect(detail?.previousReview).toEqual(check.previousReview);
  expect(detail?.review?.practice).toEqual(review.practice);
  expect(detail?.review?.assessment.feedback[0].verificationPlan).toEqual(fixtureVerificationPlan);
  const stored = await store.queries.projectChecks.get("target", restoredProjectId("target", id));
  expect(stored?.page.captures).toEqual(check.page.captures);
  check.previousReview.assessment.score = 99;
  expect(() => store.importBackup("bad-target", file)).toThrow("Invalid assessment score");
});
