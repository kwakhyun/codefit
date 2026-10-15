import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { ProblemStore } from "./store-contract";
import { fixtureCheck } from "../project-check/fixtures";
import { restoredProjectId } from "./workspace-backup";
import { BACKUP_MAX_BYTES } from "../backup-limits";
import { digest } from "./backup-transfer";

export function backupTransferContract(getStore: () => ProblemStore) {
  it("backup: exports every project beyond the old 500-record snapshot limit", async () => {
    const store = getStore(),
      owner = `user:${randomUUID()}`;
    const empty = await store.exportBackup(owner);
    if (empty.version !== 3) throw Error();
    for (const count of [500, 1])
      await store.importBackup(owner, {
        ...empty,
        projects: Array.from({ length: count }, () => ({
          check: { ...fixtureCheck, id: randomUUID() },
        })),
      });
    const result = await store.exportBackupParts(owner, new Date().toISOString());
    expect(result.parts.flatMap((part) => part.projects)).toHaveLength(501);
    expect(
      new Set(
        result.parts.flatMap((part) => part.projects.map((p) => (p.check as { id: string }).id)),
      ).size,
    ).toBe(501);
    expect(result.parts.every((part) => part.projects.length <= 500)).toBe(true);
  }, 30000);
  it("backup: splits large project histories, restores every image, and allows repeat restore after deletion", async () => {
    const store = getStore(),
      owner = `user:${randomUUID()}`,
      target = `user:${randomUUID()}`;
    const ids: string[] = [];
    for (let index = 0; index < 5; index++) {
      const id = randomUUID();
      ids.push(id);
      const claim = await store.startJob(owner, id, "project-analysis", id);
      if (claim.state !== "new") throw Error();
      await store.queries.projectChecks.complete(claim.lease, {
        ...fixtureCheck,
        id,
        page: {
          ...fixtureCheck.page,
          captures: Array.from({ length: 3 }, () => ({
            url: "https://example.com/",
            title: "Fixture",
            text: "Synthetic image bytes",
            screenshot: "A".repeat(270000),
          })),
        },
      });
    }
    await expect(Promise.resolve().then(() => store.exportBackup(owner))).rejects.toMatchObject({
      status: 413,
    });
    const exportedAt = new Date().toISOString();
    const bundle = await store.exportBackupParts(owner, exportedAt);
    expect(bundle.parts).toHaveLength(2);
    expect(await store.exportBackupParts(owner, exportedAt)).toEqual(bundle);
    expect(
      (await store.exportBackupParts(`user:${randomUUID()}`, exportedAt)).parts[0].projects,
    ).toEqual([]);
    let restored = 0;
    for (const [index, backup] of bundle.parts.entries()) {
      const input = { version: 4 as const, manifest: bundle.manifest, index, backup };
      expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(BACKUP_MAX_BYTES);
      restored += (await store.importBackupPart(target, input, "transfer-test")).projects ?? 0;
      expect((await store.importBackupPart(target, input, "transfer-test")).projects).toBe(0);
    }
    expect(restored).toBe(5);
    for (const id of ids) {
      const restored = await store.queries.projectChecks.get(target, restoredProjectId(target, id));
      expect(restored?.page.captures?.[2].screenshot).toHaveLength(270000);
    }
    await store.queries.projectChecks.remove(target, restoredProjectId(target, ids[0]));
    for (const [index, backup] of bundle.parts.entries())
      await store.importBackupPart(
        target,
        { version: 4, manifest: bundle.manifest, index, backup },
        "transfer-test",
      );
    expect(
      await store.queries.projectChecks.get(target, restoredProjectId(target, ids[0])),
    ).not.toBeNull();
  }, 30000);
  it("backup: charges one bundle allowance for more than five parts and concurrent retries", async () => {
    const store = getStore(),
      owner = `user:${randomUUID()}`;
    const empty = await store.exportBackup(owner);
    const parts = Array.from({ length: 7 }, (_, index) => ({ ...empty, legacy: { part: index } }));
    const hashes = parts.map(digest),
      manifest = { id: digest(hashes), hashes };
    for (const [index, backup] of parts.entries())
      await Promise.all(
        [0, 1].map(() =>
          store.importBackupPart(owner, { version: 4, manifest, index, backup }, `net:${owner}`),
        ),
      );
    expect(
      await store.consumeLimits([{ key: `import:${owner}`, max: 5, cost: 4, windowMs: 86400000 }]),
    ).toBe(true);
    const otherHashes = [digest({ ...empty, legacy: "other bundle" })];
    await expect(
      Promise.resolve().then(() =>
        store.importBackupPart(
          owner,
          {
            version: 4,
            manifest: { id: digest(otherHashes), hashes: otherHashes },
            index: 0,
            backup: { ...empty, legacy: "other bundle" },
          },
          `net:${owner}`,
        ),
      ),
    ).rejects.toMatchObject({ status: 429 });
  });
}
