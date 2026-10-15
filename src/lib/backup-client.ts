import { api, ApiError, errorMessage } from "./client-api";
import { backupSchema, type Backup, type BackupImportResult } from "./backup";
import { type BackupBundle, type BackupPartResponse, validateBackupBundle } from "./backup-bundle";
import { BACKUP_MAX_BYTES, BACKUP_MAX_SIZE_LABEL } from "./backup-limits";

type Notice = (message: string) => void;
export async function downloadBackup(
  scope: string,
  notice: Notice,
  request = api,
): Promise<Backup | BackupBundle> {
  try {
    return await request<Backup>("/api/export", { scope });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 413)) throw error;
  }
  const first = await request<BackupPartResponse>("/api/export?part=0", { scope });
  const parts = [first.backup];
  const total = first.manifest.hashes.length;
  notice(`큰 백업을 준비하고 있습니다. 1 / ${total} 조각을 받았습니다.`);
  for (let index = 1; index < total; index++) {
    const params = new URLSearchParams({
      part: String(index),
      exportedAt: first.exportedAt,
      snapshot: first.manifest.id,
    });
    const next = await request<BackupPartResponse>(`/api/export?${params}`, { scope });
    if (next.index !== index || next.manifest.id !== first.manifest.id)
      throw new Error("백업 조각이 일치하지 않아 내보내기를 중단했습니다. 다시 시도해 주세요.");
    parts.push(next.backup);
    notice(`큰 백업을 준비하고 있습니다. ${index + 1} / ${total} 조각을 받았습니다.`);
  }
  return validateBackupBundle({
    version: 4,
    exportedAt: first.exportedAt,
    manifest: first.manifest,
    parts,
  });
}

export async function restoreBackup(
  value: unknown,
  scope: string,
  notice: Notice,
  request = api,
): Promise<BackupImportResult> {
  if (!(value && typeof value === "object" && "version" in value && value.version === 4)) {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > BACKUP_MAX_BYTES)
      throw new Error(
        `기존 단일 백업은 ${BACKUP_MAX_SIZE_LABEL}까지 가져올 수 있습니다. 큰 기록은 새 묶음 백업으로 내보내 주세요.`,
      );
    return request<BackupImportResult>("/api/import", {
      method: "POST",
      scope,
      body: backupSchema.parse(value),
    });
  }
  const bundle = await validateBackupBundle(value);
  const total = { problems: 0, attempts: 0, learning: 0, projects: 0 };
  for (const [index, backup] of bundle.parts.entries()) {
    notice(`백업을 가져오고 있습니다. ${index + 1} / ${bundle.parts.length} 조각 처리 중입니다.`);
    try {
      const result = await request<BackupImportResult>("/api/import", {
        method: "POST",
        scope,
        body: { version: 4, manifest: bundle.manifest, index, backup },
      });
      for (const key of ["problems", "attempts", "learning", "projects"] as const)
        total[key] += result[key] ?? 0;
    } catch (error) {
      throw new Error(
        `${index + 1} / ${bundle.parts.length} 조각을 가져오지 못했습니다. 완료된 ${index}개 조각과 기존 기록은 유지됩니다. 같은 파일을 다시 선택하면 중복 없이 이어서 복원합니다. ${errorMessage(error)}`,
      );
    }
  }
  return total;
}
