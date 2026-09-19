import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { UsageLimit } from "./store-contract";
import { DAILY_GENERATIONS } from "./generation-quota";
import { BACKUP_MAX_PROBLEMS } from "../backup-limits";

export const AI_ALLOWANCE = { generate: DAILY_GENERATIONS, review: 20 } as const;
const day = 86_400_000;

/** Vercel supplies this header at its edge. Never trust client IP headers on other hosts. */
export function networkIdentity(
  request: Request,
  env: Record<string, string | undefined> = process.env,
) {
  if (!env.VERCEL) return "local";
  if (!env.RATE_LIMIT_SALT) throw new Error("RATE_LIMIT_SALT is required on Vercel");
  const ip = request.headers.get("x-vercel-forwarded-for")?.trim();
  // Unknown clients share a bucket; malformed or absent headers cannot bypass the limit.
  return createHmac("sha256", env.RATE_LIMIT_SALT)
    .update(ip && isIP(ip) ? ip : "unknown")
    .digest("hex");
}

export function aiLimits(
  owner: string,
  network: string,
  kind: keyof typeof AI_ALLOWANCE,
): UsageLimit[] {
  return [
    ...(kind === "review"
      ? [{ key: `ai:${kind}:${owner}`, max: AI_ALLOWANCE[kind], windowMs: day }]
      : []),
    { key: `ai:network:${kind}:${network}`, max: kind === "generate" ? 30 : 40, windowMs: day },
    { key: "ai:global:hour", max: 40, windowMs: 3_600_000 },
    { key: "ai:global:day", max: 100, windowMs: day },
  ];
}

export function importLimits(
  owner: string,
  network: string,
  newProblems: number,
  attempts: number,
): UsageLimit[] {
  return [
    { key: `import:${owner}`, max: 5, windowMs: day },
    { key: `import:network:${network}`, max: 10, windowMs: day },
    { key: "import:global", max: 20, windowMs: day },
    { key: "import:problems", max: BACKUP_MAX_PROBLEMS, cost: newProblems, windowMs: day },
    { key: "import:attempts", max: 10_000, cost: attempts, windowMs: day },
  ];
}

export function validateLimits(entries: UsageLimit[]) {
  const keys = new Set<string>();
  for (const entry of entries) {
    if (
      keys.has(entry.key) ||
      !Number.isSafeInteger(entry.cost ?? 1) ||
      (entry.cost ?? 1) < 0 ||
      !Number.isSafeInteger(entry.max) ||
      entry.max < 1 ||
      !Number.isSafeInteger(entry.windowMs) ||
      entry.windowMs < 1
    )
      throw new Error("Invalid usage limit");
    keys.add(entry.key);
  }
}
