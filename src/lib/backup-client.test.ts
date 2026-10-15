import { expect, it, vi } from "vitest";
import { downloadBackup, restoreBackup } from "./backup-client";
import { ApiError, type api } from "./client-api";
import { backupDigest, type BackupBundle } from "./backup-bundle";
import type { Backup } from "./backup";
const part: Extract<Backup, { version: 3 }> = {
  version: 3,
  exportedAt: "2026-10-15T00:00:00.000Z",
  problems: [],
  progress: {},
  attempts: [],
  learning: [],
  projects: [],
};
async function bundle(): Promise<BackupBundle> {
  const parts = [part, { ...part, legacy: "second" }];
  const hashes = await Promise.all(parts.map(backupDigest));
  return {
    version: 4,
    exportedAt: part.exportedAt,
    manifest: { id: await backupDigest(hashes), hashes },
    parts,
  };
}
it("falls back only for oversize export and pins every part to the starting account", async () => {
  const data = await bundle();
  const request = vi.fn().mockRejectedValueOnce(new ApiError("too large", 413));
  for (const [index, backup] of data.parts.entries())
    request.mockResolvedValueOnce({
      index,
      backup,
      manifest: data.manifest,
      exportedAt: data.exportedAt,
    });
  const notice = vi.fn();
  expect(await downloadBackup("user:a", notice, request as typeof api)).toEqual(data);
  expect(request).toHaveBeenCalledTimes(3);
  for (const call of request.mock.calls) expect(call[1].scope).toBe("user:a");
  expect(request.mock.calls[2][0]).toContain(`snapshot=${data.manifest.id}`);
  expect(notice).toHaveBeenLastCalledWith(expect.stringContaining("2 / 2"));
});
it("rejects missing or corrupted parts before writing any records", async () => {
  const original = await bundle();
  for (const data of [
    { ...original, parts: original.parts.slice(0, 1) },
    { ...original, parts: [part, { ...part, legacy: "tampered" }] },
  ]) {
    const request = vi.fn();
    await expect(restoreBackup(data, "user:a", vi.fn(), request as typeof api)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  }
});
it("reports partial completion and retries the same immutable parts without changing scope", async () => {
  const data = await bundle();
  const request = vi
    .fn()
    .mockResolvedValueOnce({ problems: 1, attempts: 0 })
    .mockRejectedValueOnce(new Error("offline"));
  await expect(restoreBackup(data, "user:a", vi.fn(), request as typeof api)).rejects.toThrow(
    "2 / 2 조각",
  );
  request
    .mockResolvedValueOnce({ problems: 0, attempts: 0 })
    .mockResolvedValueOnce({ problems: 0, attempts: 2 });
  expect(await restoreBackup(data, "user:a", vi.fn(), request as typeof api)).toEqual({
    problems: 0,
    attempts: 2,
    projects: 0,
    learning: 0,
  });
  expect(request.mock.calls[0]).toEqual(request.mock.calls[2]);
  expect(request.mock.calls[1]).toEqual(request.mock.calls[3]);
});
it("keeps small v2/v3 exports and restores unchanged", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(part)
    .mockResolvedValueOnce({ problems: 0, attempts: 0 });
  expect(await downloadBackup("user:a", vi.fn(), request as typeof api)).toEqual(part);
  expect(await restoreBackup(part, "user:a", vi.fn(), request as typeof api)).toEqual({
    problems: 0,
    attempts: 0,
  });
  expect(request.mock.calls[1][1].body).toEqual(part);
});
