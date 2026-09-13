import { createHash } from "node:crypto";
import type { Progress } from "../problem";
import type { JobClaim, JobLease, ProgressPatch } from "./store-contract";

export class CodeConflict extends Error {
  constructor(public current: Progress) {
    super("다른 곳에서 저장한 코드가 있습니다. 내 초안을 비교한 뒤 저장해 주세요.");
  }
}
export class RevisionRequired extends Error {}
export class RequestMismatch extends Error {}
export class StaleJob extends Error {}

export function checkCodeRevision(current: Progress, patch: ProgressPatch) {
  if (patch.code === undefined) return;
  if (!Number.isSafeInteger(patch.baseRevision) || patch.baseRevision! < 0)
    throw new RevisionRequired();
  // An identical retry after a lost acknowledgement is safe, even with an old revision.
  if (current.codeRevision !== patch.baseRevision && current.code !== patch.code)
    throw new CodeConflict(current);
}

/** Callers pass explicit, normalized scalar fields; request IDs are not content. */
export function requestFingerprint(...fields: string[]) {
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}
type Row = Record<string, unknown>;
export function existingClaim(
  row: Row | undefined,
  owner: string,
  kind: string,
  fingerprint: string,
): Exclude<JobClaim, { state: "new" }> | null {
  if (!fingerprint) throw new RequestMismatch();
  if (!row) return null;
  if (row.owner !== owner || row.kind !== kind || row.fingerprint !== fingerprint)
    throw new RequestMismatch();
  if (row.state === "done") return { state: "done", result: String(row.result) };
  if (row.state === "pending" && Number(row.expires) > Date.now()) return { state: "pending" };
  return null;
}
export function ownsJob(row: Row | undefined, lease: JobLease) {
  return (
    !!row &&
    row.state === "pending" &&
    row.token === lease.token &&
    row.owner === lease.owner &&
    row.kind === lease.kind &&
    Number(row.expires) > Date.now()
  );
}
