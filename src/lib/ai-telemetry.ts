export interface AiRun {
  id: string;
  operation: "generate" | "review";
  model: string;
  promptVersion: string;
  outcome: "success" | "error";
  latencyMs: number;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  createdAt: string;
}
export interface AiUsage {
  canGenerate: boolean;
  allowance: { generate: number; review: number };
  remaining: { generate: number; review: number };
  resetsAt: { generate: string | null; review: string | null };
  last30Days: {
    requests: number;
    failures: number;
    inputTokens: number;
    outputTokens: number;
    averageLatencyMs: number;
    estimatedCostUsd: number;
    unmeteredRequests: number;
  };
}
// Standard text-token prices per million. Unknown models remain unpriced.
// https://developers.openai.com/api/docs/models/gpt-5.4-mini
const PRICING = {
  model: "gpt-5.4-mini",
  input: 0.75,
  cachedInput: 0.075,
  output: 4.5,
  checkedAt: "2026-09-13",
};
export function estimateCost(
  model: string,
  input: number,
  cached: number,
  output: number,
): number | null {
  const alias = model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const pricing = Object.hasOwn(MODEL_PRICING, alias) ? MODEL_PRICING[alias] : null;
  if (!pricing) return null;
  return (
    (Math.max(0, input - cached) * pricing.input +
      cached * pricing.cachedInput +
      output * pricing.output) /
    1_000_000
  );
}

// Standard context (<=272K input), checked against each official model page 2026-09-14.
// https://developers.openai.com/api/docs/models/gpt-5.6-luna
// https://developers.openai.com/api/docs/models/gpt-5.6-terra
// https://developers.openai.com/api/docs/models/gpt-5.6-sol (promotional prices)
export const MODEL_PRICING: Record<string, { input: number; cachedInput: number; output: number }> =
  {
    "gpt-5.4-mini": PRICING,
    "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
    "gpt-5.6-terra": { input: 2, cachedInput: 0.2, output: 12 },
    "gpt-5.6-sol": { input: 4, cachedInput: 0.4, output: 20 },
  };
