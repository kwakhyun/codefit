import { PRACTICE_GENERATION_TIMEOUT_MS } from "../../src/lib/project-check/practice-generation-policy";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  analyzeProject,
  generateProjectExercises,
  generateProjectWorkshop,
} from "../../src/lib/server/ai-project-check";
import { withAiCallContext } from "../../src/lib/server/ai-telemetry";
import { ContentQualityError } from "../../src/lib/server/project-content-quality";
import { HttpError } from "../../src/lib/server/http";
import { analysisSchema, captureSchema, type StoredCheck } from "../../src/lib/project-check/types";
import { repositorySnapshotSchema } from "../../src/lib/project-check/repository";
import { projectExercisesSchema } from "../../src/lib/project-check/generated-practice";
import { workshopPlanSchema } from "../../src/lib/ai-learning/project-workshop";
import type { AiRun } from "../../src/lib/ai-telemetry";

export const CONTENT_STAGES = ["analysis", "code", "service", "observed", "proposed"] as const;
type Stage = (typeof CONTENT_STAGES)[number];
const dependencies: Record<Stage, Stage[]> = {
  analysis: [],
  code: ["analysis"],
  service: ["analysis", "code"],
  observed: ["analysis"],
  proposed: ["analysis", "observed"],
};
const schemas = {
  analysis: analysisSchema,
  code: projectExercisesSchema.shape.code,
  service: projectExercisesSchema.shape.service,
  observed: workshopPlanSchema,
  proposed: workshopPlanSchema,
};
const pageSchema = z.object({
  url: z.url(),
  title: z.string(),
  text: z.string(),
  fetchedAt: z.iso.datetime(),
  limited: z.boolean(),
  source: z.literal("repository"),
  repository: repositorySnapshotSchema,
  collectionNote: z.string().optional(),
  captures: z.array(captureSchema).optional(),
});
export function parseContentStages(value?: string): Stage[] {
  if (value === undefined) return [...CONTENT_STAGES];
  const names = value.split(",").map((name) => name.trim());
  if (!names.length || names.some((name) => !CONTENT_STAGES.includes(name as Stage)))
    throw new Error(`Stages must be a comma-separated selection of ${CONTENT_STAGES.join(", ")}.`);
  return CONTENT_STAGES.filter((name) => names.includes(name));
}
export function parseContentSnapshot(value: unknown) {
  const snapshot = z.record(z.string(), z.unknown()).parse(value);
  return { page: pageSchema.parse(snapshot.page ?? snapshot), cached: snapshot };
}
function redact(text: string) {
  for (const key of [process.env.OPENAI_API_KEY, process.env.TYPESAFE_API_KEY])
    if (key) text = text.split(key).join("[redacted]");
  return text.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]").slice(0, 800);
}
/** Never serialize arbitrary exception messages, provider bodies, headers or stacks. */
export function safeContentFailure(error: unknown) {
  if (error instanceof ContentQualityError)
    return {
      errorType: "ContentQualityError",
      status: error.status,
      reason: "Independent content review rejected the result after its bounded repair.",
      findings: error.findings.map(
        ({ id, issue, reason, supportedChoices, answerLeakQuote, serviceOutcome }) => ({
          id,
          issue,
          reason: redact(reason),
          supportedChoices,
          answerLeakQuote: answerLeakQuote === null ? null : redact(answerLeakQuote),
          serviceOutcome,
        }),
      ),
    };
  if (error instanceof OpenAI.APIConnectionTimeoutError)
    return { errorType: "TimeoutError", reason: "The provider request exceeded its time limit." };
  if (error instanceof OpenAI.APIUserAbortError)
    return {
      errorType: "AbortError",
      reason: "The provider request was cancelled by the stage signal.",
    };
  if (error instanceof OpenAI.APIError)
    return {
      errorType: "ProviderError",
      status: error.status ?? null,
      reason:
        error.status === 429
          ? "Provider rate or usage limit rejected the request."
          : error.status === 401 || error.status === 403
            ? "Provider authentication or access was rejected."
            : "Provider request failed; its response body was not retained.",
    };
  if (error instanceof HttpError)
    return { errorType: "HttpError", status: error.status, reason: redact(error.message) };
  if (error instanceof z.ZodError)
    return { errorType: "ValidationError", reason: "Input or output did not match its schema." };
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))
    return { errorType: error.name, reason: "The stage exceeded its time limit or was cancelled." };
  return {
    errorType: "UnexpectedError",
    reason: "The stage failed; no raw error body was retained.",
  };
}
function usage(runs: AiRun[]) {
  const knownEstimatedCostUsd = runs.reduce((sum, run) => sum + (run.estimatedCostUsd ?? 0), 0);
  const unpricedRequests = runs.filter((run) => run.estimatedCostUsd === null).length;
  return {
    requests: runs.length,
    failedRequests: runs.filter((run) => run.outcome === "error").length,
    qualityRejections: runs.filter((run) => run.contentQuality?.verdict === "rejected").length,
    models: [...new Set(runs.map((run) => run.model))],
    inputTokens: runs.reduce((sum, run) => sum + (run.inputTokens ?? 0), 0),
    outputTokens: runs.reduce((sum, run) => sum + (run.outputTokens ?? 0), 0),
    unknownTokenRequests: runs.filter(
      (run) => run.inputTokens === null || run.outputTokens === null,
    ).length,
    estimatedCostUsd: unpricedRequests ? null : knownEstimatedCostUsd,
    knownEstimatedCostUsd,
    unpricedRequests,
    providerLatencyMs: runs.reduce((sum, run) => sum + run.latencyMs, 0),
  };
}
type Draft = { model: string; usage: unknown; output: unknown[] };
/** Harness-only observer: clone successful JSON output, never failed bodies or request headers. */
export async function captureContentDrafts<T>(drafts: Draft[], task: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await original(input, init);
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input : input.url,
    );
    if (
      response.ok &&
      url.origin === "https://api.openai.com" &&
      url.pathname === "/v1/responses"
    ) {
      try {
        const body = await response.clone().json();
        const output: unknown[] = [];
        for (const item of body.output ?? [])
          for (const content of item.content ?? [])
            if (content.type === "output_text" && typeof content.text === "string") {
              try {
                output.push(JSON.parse(content.text));
              } catch {}
            }
        if (output.length)
          drafts.push({
            model: typeof body.model === "string" ? body.model : "unknown",
            usage: {
              inputTokens: body.usage?.input_tokens ?? null,
              outputTokens: body.usage?.output_tokens ?? null,
            },
            output,
          });
      } catch {
        /* Observation must not change the original response. */
      }
    }
    return response;
  };
  try {
    return await task();
  } finally {
    globalThis.fetch = original;
  }
}
type StageReport = {
  status: "running" | "passed" | "failed" | "skipped" | "reused";
  requestId?: string;
  elapsedMs: number;
  reason?: string;
  failure?: ReturnType<typeof safeContentFailure>;
  runs: AiRun[];
  drafts: Draft[];
  usage: ReturnType<typeof usage>;
};
const providers = { analyzeProject, generateProjectExercises, generateProjectWorkshop };
type Outputs = {
  analysis: z.infer<typeof analysisSchema>;
  code: z.infer<typeof projectExercisesSchema>["code"];
  service: z.infer<typeof projectExercisesSchema>["service"];
  observed: z.infer<typeof workshopPlanSchema>;
  proposed: z.infer<typeof workshopPlanSchema>;
};
type Report = Partial<Outputs> & {
  version: 2;
  startedAt: string;
  completedAt?: string;
  selectedStages: Stage[];
  page: z.infer<typeof pageSchema>;
  stages: Partial<Record<Stage, StageReport>>;
  usage: ReturnType<typeof usage>;
  passed: boolean;
};
export async function evaluateProjectContent(
  input: ReturnType<typeof parseContentSnapshot>,
  selected: Stage[],
  save: (report: Report) => Promise<void>,
  ai = providers,
  notify: (name: Stage, status: StageReport["status"]) => void = () => {},
) {
  const report: Report = {
    version: 2,
    startedAt: new Date().toISOString(),
    selectedStages: selected,
    page: input.page,
    stages: {},
    usage: usage([]),
    passed: false,
  };
  const needed = new Set(selected.flatMap((stage) => dependencies[stage]));
  const results: Partial<Outputs> = {};
  const allRuns: AiRun[] = [];
  const persist = async () => {
    report.usage = usage(allRuns);
    await save(report);
  };
  for (const name of CONTENT_STAGES) {
    if (!selected.includes(name) && !needed.has(name)) continue;
    const entry: StageReport = {
      status: "running",
      elapsedMs: 0,
      runs: [],
      drafts: [],
      usage: usage([]),
    };
    report.stages[name] = entry;
    if (!selected.includes(name)) {
      const cached = schemas[name].safeParse(input.cached[name]);
      if (cached.success) {
        Object.assign(results, { [name]: cached.data });
        Object.assign(report, { [name]: cached.data });
        entry.status = "reused";
        entry.reason = "Reused from the pinned report; not generated or reviewed in this run.";
      } else {
        entry.status = "skipped";
        entry.reason = `No valid saved ${name} result. Select that stage to regenerate it.`;
      }
      await persist();
      continue;
    }
    const missing = dependencies[name].filter((dependency) => results[dependency] === undefined);
    if (missing.length) {
      entry.status = "skipped";
      entry.reason = `Required stages unavailable: ${missing.join(", ")}. No provider call made.`;
      await persist();
      notify(name, entry.status);
      continue;
    }
    const started = performance.now();
    const signal = AbortSignal.timeout(
      name === "code" || name === "service" ? PRACTICE_GENERATION_TIMEOUT_MS : 105_000,
    );
    entry.requestId = randomUUID();
    await persist();
    try {
      const value = await withAiCallContext(
        {
          requestId: entry.requestId,
          beforeCall: async () => signal.throwIfAborted(),
          record: async (run) => {
            entry.runs.push(run);
            allRuns.push(run);
            entry.usage = usage(entry.runs);
            await persist();
          },
        },
        () =>
          captureContentDrafts(entry.drafts, async () => {
            if (name === "analysis") return ai.analyzeProject(input.page, "", signal);
            const check: StoredCheck = {
              id: randomUUID(),
              createdAt: report.startedAt,
              description: "",
              page: input.page,
              analysis: results.analysis!,
            };
            if (name === "code" || name === "service")
              return (
                await ai.generateProjectExercises(
                  check,
                  signal,
                  name,
                  name === "service"
                    ? results.code!.map(({ title, situation, question }) => ({
                        title,
                        situation,
                        question,
                      }))
                    : undefined,
                )
              )[name];
            return ai.generateProjectWorkshop(
              check,
              signal,
              name,
              name === "proposed"
                ? results.observed!.topics.map((topic) => topic.title)
                : undefined,
            );
          }),
      );
      Object.assign(results, { [name]: value });
      Object.assign(report, { [name]: value });
      entry.status = "passed";
    } catch (error) {
      entry.status = "failed";
      entry.failure = safeContentFailure(error);
    }
    entry.elapsedMs = Math.round(performance.now() - started);
    entry.usage = usage(entry.runs);
    await persist();
    notify(name, entry.status);
  }
  report.passed = selected.every((name) => report.stages[name]?.status === "passed");
  report.completedAt = new Date().toISOString();
  await persist();
  return report;
}
