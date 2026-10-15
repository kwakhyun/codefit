import { z } from "zod";
import { backupSchema, type Backup } from "./backup";

// Leave room for the transfer manifest below the unchanged 4 MB HTTP limit.
export const BACKUP_PART_BYTES = 3_700_000;
export const BACKUP_MAX_PARTS = 1000;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const backupManifestSchema = z
  .object({
    id: digest,
    hashes: z.array(digest).min(1).max(BACKUP_MAX_PARTS),
  })
  .strict();
export const backupPartRequestSchema = z
  .object({
    version: z.literal(4),
    manifest: backupManifestSchema,
    index: z
      .number()
      .int()
      .min(0)
      .max(BACKUP_MAX_PARTS - 1),
    backup: backupSchema,
  })
  .strict();
const backupBundleSchema = z
  .object({
    version: z.literal(4),
    exportedAt: z.iso.datetime(),
    manifest: backupManifestSchema,
    parts: z.array(backupSchema).min(1).max(BACKUP_MAX_PARTS),
  })
  .strict();
export type BackupManifest = z.infer<typeof backupManifestSchema>;
export type BackupPartRequest = z.infer<typeof backupPartRequestSchema>;
export type BackupBundle = z.infer<typeof backupBundleSchema>;
export type BackupPartResponse = {
  exportedAt: string;
  manifest: BackupManifest;
  index: number;
  backup: Backup;
};

export function backupFingerprintText(value: unknown) {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}
export async function backupDigest(value: unknown) {
  const bytes = new TextEncoder().encode(backupFingerprintText(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Check the complete file before the first restore request. Hashes detect damage, not authorship. */
export async function validateBackupBundle(value: unknown): Promise<BackupBundle> {
  const bundle = backupBundleSchema.parse(value);
  if (
    bundle.parts.length !== bundle.manifest.hashes.length ||
    (await backupDigest(bundle.manifest.hashes)) !== bundle.manifest.id
  )
    throw new Error("백업 묶음의 조각 정보가 일치하지 않습니다. 원본 파일을 다시 선택해 주세요.");
  for (const [index, part] of bundle.parts.entries()) {
    if (
      new TextEncoder().encode(JSON.stringify(part)).byteLength > BACKUP_PART_BYTES ||
      (await backupDigest(part)) !== bundle.manifest.hashes[index]
    )
      throw new Error(`백업 ${index + 1}번 조각이 손상되었거나 용량을 초과했습니다.`);
  }
  return bundle;
}
