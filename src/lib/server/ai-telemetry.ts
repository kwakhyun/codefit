import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { aiModel } from "./ai-models";
import { estimateCost, type AiRun } from "../ai-telemetry";
import type { Response } from "openai/resources/responses/responses";
export type RunRecorder = (run: AiRun) => Promise<void> | void;
const callContext = new AsyncLocalStorage<{
  requestId: string;
  beforeCall: () => Promise<void>;
  record: RunRecorder;
}>();

/** Propagate budget and ownership through nested generation/review/repair calls. */
export function withAiCallContext<T>(
  context: NonNullable<ReturnType<typeof callContext.getStore>>,
  task: () => Promise<T>,
) {
  return callContext.run(context, task);
}

export async function withAiTelemetry<T>(
  operation: AiRun["operation"],
  promptVersion: string,
  task: (
    capture: (
      response: Pick<Response, "usage" | "model">,
      quality?: AiRun["contentQuality"],
    ) => void,
  ) => Promise<T>,
  record?: RunRecorder,
  model = aiModel(operation),
): Promise<T> {
  const context = callContext.getStore();
  // A rejected budget check is not a provider attempt and must not be recorded as one.
  await context?.beforeCall();
  const started = performance.now();
  const run: AiRun = {
    id: randomUUID(),
    ...(context ? { requestId: context.requestId } : {}),
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
    const result = await task((response, quality) => {
      run.model = response.model;
      if (quality) run.contentQuality = quality;
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
    if (run.contentQuality?.verdict === "rejected")
      console.warn("Project content quality rejected", {
        runId: run.id,
        requestId: run.requestId,
        issues: run.contentQuality.issues,
      });
    try {
      await (record ?? context?.record)?.(run);
    } catch {
      console.error("AI telemetry persistence failed", { runId: run.id });
    }
  }
}
