import { z } from "zod";
import { withAiTelemetry } from "./ai-telemetry";

type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};
export type JevQuestion =
  | ChoiceQuestion
  | {
      type: "noul";
      instructions: string;
      criteria?: { true: string; false: string };
    };
const choiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
});
const answerSchema = z.discriminatedUnion("type", [
  choiceAnswerSchema,
  z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
]);
type Answer<Q> = Q extends ChoiceQuestion
  ? z.infer<typeof choiceAnswerSchema>
  : Q extends { type: "noul" }
    ? { type: "noul"; noul: number }
    : z.infer<typeof answerSchema>;
const responseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), answerSchema),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});
const telemetrySchema = responseSchema.pick({ model: true, usage: true });
/** No source, generated text, credentials or provider error bodies in logs. */
export async function jevDecide<Q extends Record<string, JevQuestion>>(
  state: unknown,
  questions: Q,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const key = process.env.TYPESAFE_API_KEY;
  if (!key || process.env.TYPESAFE_ENABLED === "false" || !Object.keys(questions).length)
    return null;
  const model = process.env.TYPESAFE_MODEL || "jev-1.13.0";
  const body = JSON.stringify({
    model,
    state,
    questions,
  });
  // Conservative UTF-8 budget, including Korean; do not truncate evidence mid-branch.
  if (Buffer.byteLength(body) > 70_000) {
    console.info("Jev skipped", { reason: "input_budget", bytes: Buffer.byteLength(body) });
    return null;
  }
  const started = performance.now();
  let status = "not_started";
  try {
    return await withAiTelemetry(
      "project",
      "2026-10-15.project.code-guide.persistence-v2",
      async (capture) => {
        status = "unavailable";
        const response = await fetch("https://api.typesafe.ai/v1/systemone", {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body,
          signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
        });
        if (!response.ok) {
          status = `http_${response.status}`;
          throw new Error("Jev request failed");
        }
        status = "invalid_response";
        const raw: unknown = await response.json();
        // Preserve reported usage even when the answers fail validation. TypeSafe
        // reports token totals, without OpenAI-specific cache/reasoning details.
        const metadata = telemetrySchema.safeParse(raw);
        if (metadata.success) {
          const { model, usage } = metadata.data;
          capture({
            model,
            usage: {
              ...usage,
              input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
              total_tokens: usage.input_tokens + usage.output_tokens,
            },
          });
        }
        const parsed = responseSchema.safeParse(raw);
        if (!parsed.success) throw new Error("Invalid Jev response");
        for (const [id, question] of Object.entries(questions)) {
          const answer = parsed.data.answers[id];
          if (!answer || answer.type !== question.type) throw new Error("Invalid Jev answer");
          if (question.type === "noul") continue;
          if (answer.type !== "choice") throw new Error("Invalid Jev answer");
          const options = Object.keys(question.criteria);
          if (
            !Object.hasOwn(question.criteria, answer.choice) ||
            Object.keys(answer.probabilities).length !== options.length ||
            answer.probabilities[answer.choice] <
              Math.max(...Object.values(answer.probabilities)) ||
            options.some((option) => !Object.hasOwn(answer.probabilities, option)) ||
            Math.abs(Object.values(answer.probabilities).reduce((a, b) => a + b, 0) - 1) > 0.02
          )
            throw new Error("Invalid Jev answer");
        }
        status = "success";
        console.info("Jev decision", {
          model: parsed.data.model,
          questions: Object.keys(questions).length,
          inputTokens: parsed.data.usage.input_tokens,
          outputTokens: parsed.data.usage.output_tokens,
          latencyMs: Math.round(performance.now() - started),
        });
        return Object.fromEntries(
          Object.keys(questions).map((id) => [id, parsed.data.answers[id]]),
        ) as { [K in keyof Q]: Answer<Q[K]> };
      },
      undefined,
      model,
    );
  } catch {
    signal.throwIfAborted();
    return null;
  } finally {
    if (status !== "success")
      console.warn("Jev fallback", { status, latencyMs: Math.round(performance.now() - started) });
  }
}
