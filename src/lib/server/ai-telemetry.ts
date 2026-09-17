import { randomUUID } from "node:crypto";
import { aiModel } from "./ai-models";
import { estimateCost, type AiRun } from "../ai-telemetry";
import type { Response } from "openai/resources/responses/responses";
export type RunRecorder = (run: AiRun) => Promise<void> | void;

export async function withAiTelemetry<T>(
  operation: AiRun["operation"],
  promptVersion: string,
  task: (capture: (response: Pick<Response, "usage" | "model">) => void) => Promise<T>,
  record?: RunRecorder,
  model = aiModel(operation),
): Promise<T> {
  const started = performance.now();
  const run: AiRun = {
    id: randomUUID(),
    operation,
    promptVersion,
    model,
    outcome: "error",
    latencyMs: 0,
    inputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
    estimatedCostUsd: null,
    createdAt: new Date().toISOString(),
  };
  try {
    const result = await task((response) => {
      run.model = response.model;
      if (response.usage) {
        run.inputTokens = response.usage.input_tokens;
        run.cachedInputTokens = response.usage.input_tokens_details.cached_tokens;
        run.outputTokens = response.usage.output_tokens;
        run.estimatedCostUsd = estimateCost(
          run.model,
          run.inputTokens,
          run.cachedInputTokens,
          run.outputTokens,
        );
      }
    });
    run.outcome = "success";
    return result;
  } finally {
    run.latencyMs = Math.round(performance.now() - started);
    try {
      await record?.(run);
    } catch {
      console.error("AI telemetry persistence failed", { runId: run.id });
    }
  }
}
