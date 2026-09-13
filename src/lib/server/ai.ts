import { withAiTelemetry, type RunRecorder } from "./ai-telemetry";
import { aiModel } from "./ai-models";
import { GENERATION_PROMPT, REVIEW_PROMPT, PROMPT_VERSION, REVIEW_REASONING } from "./ai-prompts";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { KIND_LABELS, LANGUAGES, domainLabel } from "../catalog";
import {
  problemContentSchema,
  reviewSchema,
  validateReview,
  type Problem,
  type generationSchema,
} from "../problem";
import { HttpError } from "./http";

function client() {
  if (!process.env.OPENAI_API_KEY)
    throw new HttpError(
      503,
      "AI 연결이 설정되지 않았습니다. 서버에 OPENAI_API_KEY를 설정하면 생성과 풀이 검토를 사용할 수 있습니다.",
    );
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90_000, maxRetries: 0 });
}
export async function generateProblem(
  input: z.infer<typeof generationSchema>,
  existingTitles: string[],
  record?: RunRecorder,
) {
  return withAiTelemetry(
    "generate",
    PROMPT_VERSION,
    async (capture) => {
      const response = await client().responses.parse({
        model: aiModel("generate"),
        store: false,
        max_output_tokens: 10000,
        input: [
          {
            role: "developer",
            content: GENERATION_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify({
              domain: domainLabel(input.domain),
              language: LANGUAGES[input.language].label,
              difficulty: input.difficulty,
              kind: KIND_LABELS[input.kind],
              topic: input.topic,
              existingTitles: existingTitles.slice(0, 50),
            }),
          },
        ],
        text: { format: zodTextFormat(problemContentSchema, "coding_challenge") },
      });
      capture(response);
      if (!response.output_parsed)
        throw new HttpError(
          502,
          "AI가 완전한 문제를 만들지 못했습니다. 주제를 조금 바꿔 다시 시도해 주세요.",
        );
      const content = problemContentSchema.parse(response.output_parsed);
      if (content.starterCode.trim() === content.solution.trim())
        throw new HttpError(
          502,
          "문제의 시작 코드와 정답이 같아 저장하지 않았습니다. 다시 생성해 주세요.",
        );
      return content;
    },
    record,
  );
}
export async function reviewCode(problem: Problem, code: string, record?: RunRecorder) {
  return withAiTelemetry(
    "review",
    PROMPT_VERSION,
    async (capture) => {
      const response = await client().responses.parse({
        model: aiModel("review"),
        store: false,
        max_output_tokens: 6500,
        reasoning: { effort: REVIEW_REASONING },
        input: [
          {
            role: "developer",
            content: REVIEW_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify({
              language: problem.language,
              scenario: problem.scenario,
              requirements: problem.requirements,
              examples: problem.examples,
              starterCode: problem.starterCode,
              referenceSolution: problem.solution,
              submittedCode: code,
            }),
          },
        ],
        text: { format: zodTextFormat(reviewSchema, "challenge_review") },
      });
      capture(response);
      if (!response.output_parsed)
        throw new HttpError(502, "AI 검토가 완료되지 않았습니다. 다시 시도해 주세요.");
      return validateReview(response.output_parsed, problem);
    },
    record,
  );
}
