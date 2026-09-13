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
// Standard text-token prices per million, verified 2026-09-13. Unknown models remain unpriced.
// https://developers.openai.com/api/docs/models/gpt-5.4-mini
export const PRICING = {
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
  if (model !== PRICING.model && !/^gpt-5\.4-mini-\d{4}-\d{2}-\d{2}$/.test(model)) return null;
  return (
    (Math.max(0, input - cached) * PRICING.input +
      cached * PRICING.cachedInput +
      output * PRICING.output) /
    1_000_000
  );
}
