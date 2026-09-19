import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { SqliteStore } from "../src/lib/server/sqlite-store";
import { ProjectCheckService } from "../src/lib/server/project-check-service";
import { analyzeProject, assessProject } from "../src/lib/server/ai-project-check";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { emptyLearning } from "../src/lib/learn/progress";
import { backupSchema } from "../src/lib/backup";
import { restoredProjectId } from "../src/lib/server/workspace-backup";
if (!process.argv.includes("--live")) {
  console.log(
    JSON.stringify({
      mode: "dry-run",
      calls: 2,
      input: "Synthetic reservation project page and five authored answers",
      scope:
        "Live analysis and assessment through the service, durable storage, idempotent retries, curriculum and backup restore into an independent SQLite database",
    }),
  );
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY required");
const runId = randomUUID();
mkdirSync("artifacts", { recursive: true });
mkdirSync("reports", { recursive: true });
const source = new SqliteStore(`artifacts/project-recovery-live-${runId}.sqlite`);
const target = new SqliteStore(`artifacts/project-recovery-restored-${runId}.sqlite`);
const owner = `user:${randomUUID()}`,
  restoredOwner = `user:${randomUUID()}`;
const input = {
  requestId: randomUUID(),
  url: fixtureCheck.page.url,
  description: fixtureCheck.description,
  consent: true as const,
};
const answers = [
  "사용자가 회의실과 시간을 고르면 서버가 로그인과 빈 시간을 확인한 뒤 예약을 저장합니다. 저장에 성공한 응답을 받은 후에만 화면에서 예약 완료로 표시합니다. 응답을 잃으면 같은 요청 번호로 다시 확인해 중복 생성하지 않습니다. 네트워크를 끊었다 다시 연결해 예약이 한 개이고 화면과 저장 값이 같은지 확인합니다.",
  "예약은 브라우저가 아니라 서버 데이터베이스에 저장합니다. 다른 기기에서도 같은 예약을 보려는 목적입니다. 같은 회의실과 시간대에 두 요청이 동시에 오면 트랜잭션과 충돌을 막는 제약으로 하나만 성공하게 합니다. 두 계정이 동시에 예약하고 저장된 예약 수를 조회해 한 개인지 확인합니다. 브라우저 저장은 간단하지만 여러 기기의 충돌을 해결하지 못합니다.",
  "서버가 요청마다 세션의 사용자와 예약 소유자를 조회해서 취소 권한을 판단합니다. 화면에서 버튼을 숨기는 것만으로는 다른 사람의 예약 번호를 보내는 요청을 막을 수 없습니다. 관리자도 현재 권한을 확인합니다. 일반 계정으로 다른 사람의 예약을 취소하는 요청을 직접 보내 거절되고 데이터가 바뀌지 않는지 확인합니다.",
  "저장이 끝났는데 응답이 유실될 수 있으므로 응답 실패를 저장 실패와 동일하게 보지 않습니다. 요청 번호에 유일성 제약을 두고 재시도에서도 같은 번호를 사용합니다. 이미 처리했다면 기존 결과를 반환합니다. 무조건 새 요청을 만들면 예약이 중복될 수 있습니다. 저장 직후 응답을 차단해 재시도하고 결과가 한 번만 반영되는지 확인합니다.",
  "동시 예약에서 먼저 조회하고 나중에 저장하는 방식은 두 요청이 모두 빈 시간으로 볼 수 있습니다. 데이터베이스에서 충돌을 차단하는 제약과 짧은 트랜잭션을 선택합니다. 애플리케이션 메모리 잠금보다 여러 서버에서 일관되게 적용할 수 있지만 경합과 실패 처리가 필요합니다. 두 연결의 요청을 겹쳐 실행해 하나만 성공하고 실패한 사용자가 다른 시간을 선택할 수 있는지 확인합니다.",
];
const service = new ProjectCheckService(source, {
  readPage: async () => ({ ...fixtureCheck.page, fetchedAt: new Date().toISOString() }),
  analyze: analyzeProject,
  assess: assessProject,
});
let status = "failed";
let failureType: string | undefined;
try {
  const check = await service.create(owner, "live-synthetic", input, AbortSignal.timeout(65_000));
  console.log("Live analysis saved");
  assert.equal(check.analysis.questions.length, 5);
  assert.equal(
    (await service.create(owner, "live-synthetic", input, AbortSignal.timeout(5000))).id,
    check.id,
  );
  const review = await service.review(
    owner,
    "live-synthetic",
    { id: check.id, answers },
    AbortSignal.timeout(65_000),
  );
  console.log("Live assessment saved");
  assert.equal(review.assessment.rubricVersion, "evidence-v2");
  assert.deepEqual(
    await service.review(
      owner,
      "live-synthetic",
      { id: check.id, answers },
      AbortSignal.timeout(5000),
    ),
    review,
  );
  await source.queries.projectLearning.submit(owner, {
    id: check.id,
    moduleId: "storage",
    phase: "baseline",
    revision: 0,
    answers: [0, 1],
    confidence: "unsure",
    assisted: false,
  });
  await source.queries.learning.save(
    owner,
    "where-data-lives",
    JSON.stringify({
      ...emptyLearning(),
      reason: "서버에 저장하면 다른 기기에서 다시 조회할 수 있습니다.",
    }),
    0,
  );
  const before = await source.queries.projectLearning.get(owner, check.id);
  const file = backupSchema.parse(JSON.parse(JSON.stringify(source.exportBackup(owner))));
  const imported = target.importBackup(restoredOwner, file);
  assert.equal(imported.projects, 1);
  assert.equal(imported.learning, 1);
  const restored = restoredProjectId(restoredOwner, check.id);
  assert.deepEqual(await target.queries.projectChecks.review(restoredOwner, restored), review);
  assert.deepEqual(await target.queries.projectLearning.get(restoredOwner, restored), before);
  assert.equal(target.importBackup(restoredOwner, file).projects, 0);
  assert.equal(await target.queries.projectChecks.get("another-account", restored), null);
  // Even restored review retries must not consume another paid call.
  assert.deepEqual(
    await new ProjectCheckService(target).review(
      restoredOwner,
      "unused",
      { id: restored, answers },
      AbortSignal.timeout(5000),
    ),
    review,
  );
  assert.equal(target.db.prepare("SELECT count(*) AS n FROM ai_runs").get()?.n, 0);
  assert.equal(source.db.prepare("SELECT count(*) AS n FROM ai_runs").get()?.n, 2);
  status = "passed";
} catch (error) {
  failureType = error instanceof Error ? error.constructor.name : "unknown";
  // Provider error bodies can include input data; report only the type.
  console.error(`Live integration failed: ${failureType}`);
  process.exitCode = 1;
} finally {
  const runs = source.db
    .prepare("SELECT content FROM ai_runs ORDER BY created_at")
    .all()
    .map((r) => JSON.parse(String(r.content)));
  const report = {
    date: new Date().toISOString(),
    status,
    failureType,
    calls: runs.length,
    estimatedCostUsd: runs.reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0),
    runs,
    sourceHash: createHash("sha256")
      .update(readFileSync("src/lib/server/ai-project-check.ts"))
      .update(readFileSync("src/lib/server/workspace-backup.ts"))
      .digest("hex"),
    fixtureHash: createHash("sha256")
      .update(JSON.stringify({ page: fixtureCheck.page, description: input.description, answers }))
      .digest("hex"),
    limitations:
      "Synthetic page snapshot (no public URL fetch), two actual provider calls, local service and two isolated SQLite databases. Functional integration only, not independent scoring accuracy, real-user learning benefit or SOTA evidence.",
  };
  const path = `reports/project-recovery-live-${runId}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      status,
      calls: runs.length,
      estimatedCostUsd: report.estimatedCostUsd,
      report: path,
    }),
  );
  source.db.close();
  target.db.close();
}
