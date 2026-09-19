// Leave headroom below Vercel Functions’ 4.5 MB request/response payload limit.
// Keep serializer, download, parser and import allowance on the same boundaries.
export const BACKUP_MAX_BYTES = 4_000_000;
export const BACKUP_MAX_SIZE_LABEL = "4 MB";
export const BACKUP_MAX_PROBLEMS = 2500;
