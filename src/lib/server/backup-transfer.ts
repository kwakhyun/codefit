import { createHash } from "node:crypto";
import type { Backup } from "../backup";
import { backupSchema } from "../backup";
import { BACKUP_MAX_PROBLEMS } from "../backup-limits";
import {
  BACKUP_PART_BYTES,
  BACKUP_MAX_PARTS,
  backupFingerprintText,
  type BackupManifest,
  type BackupPartRequest,
} from "../backup-bundle";
import { backupData, prepareBackup } from "./workspace-backup";
import { HttpError } from "./http";
import { importLimits } from "./usage-policy";

type Part = Extract<Backup, { version: 3 }>;
export const digest = (value: unknown) =>
  createHash("sha256").update(backupFingerprintText(value)).digest("hex");

/** Each part is independently restorable, with definitions for all referenced coding problems. */
export function buildBackupParts(rows: Record<string, unknown>[][], exportedAt: string) {
  const raw = backupData(rows, exportedAt);
  const problems = new Map(raw.problems.map((p) => [p.id, p]));
  if (Object.keys(raw.progress).some((id) => !problems.has(id)))
    throw new HttpError(500, "진도가 참조하는 문제를 찾지 못해 백업을 중단했습니다.");
  const empty = (): Part => ({
    version: 3,
    exportedAt,
    problems: [],
    progress: {},
    attempts: [],
    learning: [],
    projects: [],
  });
  let current = empty();
  const emptyBytes = Buffer.byteLength(JSON.stringify(current));
  let currentBytes = emptyBytes;
  const problemIds = new Set<string>();
  const parts: Part[] = [];
  const finish = () => {
    const parsed = backupSchema.parse(current) as Part;
    prepareBackup(parsed);
    if (Buffer.byteLength(JSON.stringify(parsed)) > BACKUP_PART_BYTES)
      throw new HttpError(413, "백업 조각의 전송 한도를 초과했습니다. 기존 기록은 유지됩니다.");
    parts.push(parsed);
    if (parts.length > BACKUP_MAX_PARTS)
      throw new HttpError(
        413,
        "백업 조각 수가 한도를 넘었습니다. 운영자에게 기록 이관을 요청해 주세요.",
      );
    current = empty();
    currentBytes = emptyBytes;
    problemIds.clear();
  };
  // Conservative per-unit accounting avoids serializing the growing part for
  // every record. Each unit's repeated envelope is counted as extra headroom.
  const add = (unit: Partial<Part>) => {
    let included = {
      ...unit,
      ...(unit.problems ? { problems: unit.problems.filter((p) => !problemIds.has(p.id)) } : {}),
    };
    let bytes = Buffer.byteLength(JSON.stringify(included)) + 16;
    if (
      currentBytes + bytes > BACKUP_PART_BYTES ||
      current.problems.length + (included.problems?.length ?? 0) > BACKUP_MAX_PROBLEMS ||
      current.attempts.length + (unit.attempts?.length ?? 0) > 10000 ||
      current.learning.length + (unit.learning?.length ?? 0) > 500 ||
      current.projects.length + (unit.projects?.length ?? 0) > 500
    ) {
      included = unit;
      bytes = Buffer.byteLength(JSON.stringify(unit)) + 16;
      if (emptyBytes + bytes > BACKUP_PART_BYTES)
        throw new HttpError(
          413,
          "개별 기록 하나가 전송 한도를 넘었습니다. 이전 버전 원본 등 큰 기록은 운영자에게 별도 이관을 요청해 주세요. 기존 기록은 유지됩니다.",
        );
      finish();
    }
    for (const problem of included.problems ?? []) {
      current.problems.push(problem);
      problemIds.add(problem.id);
    }
    Object.assign(current.progress, included.progress);
    current.attempts.push(...(included.attempts ?? []));
    current.learning.push(...(included.learning ?? []));
    current.projects.push(...(included.projects ?? []));
    if ("legacy" in included) current.legacy = included.legacy;
    currentBytes += bytes;
  };
  for (const problem of raw.problems)
    add({
      problems: [problem],
      ...(raw.progress[problem.id] ? { progress: { [problem.id]: raw.progress[problem.id] } } : {}),
    });
  for (const attempt of raw.attempts) {
    const problem = problems.get(attempt.problemId);
    if (!problem) throw new HttpError(500, "풀이가 참조하는 문제를 찾지 못해 백업을 중단했습니다.");
    add({ problems: [problem], attempts: [attempt] });
  }
  for (const learning of raw.learning) add({ learning: [learning] });
  for (const project of raw.projects) add({ projects: [project] });
  if (raw.legacy != null) add({ legacy: raw.legacy });
  finish();
  const hashes = parts.map(digest);
  return { parts, manifest: { id: digest(hashes), hashes } satisfies BackupManifest };
}

export function validateBackupPart(input: BackupPartRequest) {
  if (
    input.index >= input.manifest.hashes.length ||
    digest(input.manifest.hashes) !== input.manifest.id ||
    digest(input.backup) !== input.manifest.hashes[input.index] ||
    Buffer.byteLength(JSON.stringify(input.backup)) > BACKUP_PART_BYTES
  )
    throw new HttpError(400, "백업 조각과 묶음 정보가 일치하지 않습니다.");
  prepareBackup(input.backup);
}

export function bundleReceipt(owner: string, input: BackupPartRequest) {
  return { id: `backup-import:${digest([owner, input.manifest.id])}`, kind: "backup-import" };
}

export function bundleImportLimits(owner: string, network: string, fresh: boolean) {
  return [
    ...importLimits(owner, network, 0, 0).filter(
      (limit) => fresh && !["import:problems", "import:attempts"].includes(limit.key),
    ),
    { key: `import:parts:${owner}`, max: 5000, windowMs: 86_400_000 },
    { key: "import:parts:global", max: 100_000, windowMs: 86_400_000 },
  ];
}
/** Count inserted records, not repeated input, so large restores can resume across daily windows. */
export function backupVolumeLimits(
  owner: string,
  network: string,
  result: { problems: number; attempts: number },
) {
  return importLimits(owner, network, result.problems, result.attempts).filter((limit) =>
    ["import:problems", "import:attempts"].includes(limit.key),
  );
}
export const importLimited = () =>
  new HttpError(
    429,
    "백업 가져오기 한도에 도달했습니다. 완료된 조각은 보관됩니다. 최대 24시간 후 같은 파일로 이어서 가져오세요.",
    86400,
  );
