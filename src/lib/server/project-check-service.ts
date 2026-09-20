import { allowanceFor } from "../ai-access";
import type { z } from "zod";
import {
  createCheckSchema,
  reviewCheckSchema,
  PROJECT_LIMITS,
  type StoredCheck,
} from "../project-check/types";
import type { ProblemStore } from "./store-contract";
import { dialogueInputSchema, type ProjectDialogue } from "../project-check/dialogue";
import { discussProjectCode, analyzeProject, assessProject } from "./ai-project-check";
import { publicUrl } from "./project-page";
import { requestFingerprint } from "./write-conflicts";
import { publicCheck, publicReview } from "./project-check-store";
import { HttpError } from "./http";
import { readProjectPages } from "./project-browser";
import { githubTarget, readProjectRepository } from "./project-repository";
const defaults = {
  readPage: (url: string, signal: AbortSignal) =>
    githubTarget(url) ? readProjectRepository(url, signal) : readProjectPages(url, signal),
  analyze: analyzeProject,
  assess: assessProject,
};
export class ProjectCheckService {
  constructor(
    private store: ProblemStore,
    private ai = defaults,
  ) {}
  private async consume(owner: string, network: string, kind: "analysis" | "review") {
    const allowed = await this.store.consumeLimits([
      ...(!owner.startsWith("user:")
        ? [
            {
              key: `project:guest-network:${kind}:${network}`,
              max: 2,
              windowMs: PROJECT_LIMITS.windowMs,
            },
          ]
        : []),
      {
        key: `project:${kind}:${owner}`,
        max: allowanceFor(owner)[kind === "analysis" ? "analysis" : "projectReview"],
        windowMs: PROJECT_LIMITS.windowMs,
      },
      {
        key: `project:network:${kind}:${network}`,
        max: kind === "analysis" ? 10 : 20,
        windowMs: PROJECT_LIMITS.windowMs,
      },
      { key: "ai:global:hour", max: 40, windowMs: 3_600_000 },
      { key: "ai:global:day", max: 100, windowMs: PROJECT_LIMITS.windowMs },
    ]);
    if (!allowed)
      throw new HttpError(
        429,
        "프로젝트 점검 이용 한도에 도달했습니다. 남은 횟수와 초기화 시간을 확인해 주세요.",
      );
  }
  async create(
    owner: string,
    network: string,
    input: z.infer<typeof createCheckSchema>,
    signal: AbortSignal,
  ) {
    const url = publicUrl(input.url).href;
    const claim = await this.store.startJob(
      owner,
      input.requestId,
      "project-analysis",
      requestFingerprint(url, input.description),
    );
    if (claim.state === "done") return publicCheck(JSON.parse(claim.result));
    if (claim.state === "pending")
      throw new HttpError(409, "같은 분석이 진행 중입니다. 잠시 후 기록을 새로고침해 주세요.");
    try {
      if ((await this.store.queries.projectChecks.usage(owner)).analysis.remaining === 0)
        throw new HttpError(429, "새 분석 이용 한도에 도달했습니다. 초기화 시간을 확인해 주세요.");
      if (
        !(await this.store.consumeLimits([
          { key: `project:fetch:${owner}`, max: 5, windowMs: 60_000 },
          { key: `project:fetch-day:${owner}`, max: 8, windowMs: 86_400_000 },
          { key: "project:fetch-global:day", max: 150, windowMs: 86_400_000 },
          { key: `project:fetch-network:${network}`, max: 20, windowMs: 60_000 },
        ]))
      )
        throw new HttpError(
          429,
          "주소 확인 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요. 계속되면 하루 뒤에 다시 확인해 주세요.",
        );
      const page = await this.ai.readPage(url, signal);
      if (
        page.limited &&
        !["metadata", "rendered", "repository"].includes(page.source || "html") &&
        input.description.trim().length < 120
      )
        throw new HttpError(
          422,
          "로그인 문제로 판단한 것은 아닙니다. 이 페이지는 자바스크립트 실행 후 내용을 보여주거나 공개 소개 정보가 부족해, 현재 수집 방식으로 서비스 내용을 충분히 읽지 못했습니다. 아래에 주요 기능과 구현 방식을 120자 이상 적고 다시 분석해 주세요. AI 분석 횟수는 차감되지 않았습니다.",
        );
      signal.throwIfAborted();
      await this.consume(owner, network, "analysis");
      const analysis = await this.ai.analyze(page, input.description, signal, (run) =>
        this.store.queries.recordAiRun(owner, run),
      );
      const result: StoredCheck = {
        id: input.requestId,
        page,
        description: input.description,
        analysis,
        createdAt: new Date().toISOString(),
      };
      await this.store.queries.projectChecks.complete(claim.lease, result);
      return publicCheck(result);
    } catch (error) {
      await this.store.failJob(claim.lease);
      throw error;
    }
  }
  async revise(owner: string, id: string, requestId: string) {
    const check = await this.store.queries.projectChecks.get(owner, id);
    const review = await this.store.queries.projectChecks.review(owner, id);
    if (!check || !review) throw new HttpError(404, "보완할 평가 기록을 찾지 못했습니다.");
    if ((check.revisionNumber ?? 0) >= 3)
      throw new HttpError(
        422,
        "같은 질문은 3번까지 보완할 수 있습니다. 최신 화면으로 새 점검을 시작해 주세요.",
      );
    const claim = await this.store.startJob(
      owner,
      requestId,
      "project-analysis",
      requestFingerprint("revision", id),
    );
    if (claim.state === "done") return publicCheck(JSON.parse(claim.result));
    if (claim.state === "pending")
      throw new HttpError(409, "보완 답변을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.");
    try {
      if (
        !(await this.store.consumeLimits([
          { key: `project:revision:${owner}`, max: 5, windowMs: 60_000 },
          { key: `project:revision-day:${owner}`, max: 12, windowMs: 86_400_000 },
        ]))
      )
        throw new HttpError(429, "잠시 후 다시 시도해 주세요.");
      const result: StoredCheck = {
        ...check,
        id: requestId,
        createdAt: new Date().toISOString(),
        revisionNumber: (check.revisionNumber ?? 0) + 1,
        previousReview: { answers: review.answers, assessment: review.assessment },
      };
      await this.store.queries.projectChecks.complete(claim.lease, result, id);
      return publicCheck(result);
    } catch (error) {
      await this.store.failJob(claim.lease);
      throw error;
    }
  }
  async discuss(
    owner: string,
    network: string,
    checkId: string,
    input: z.infer<typeof dialogueInputSchema>,
    signal: AbortSignal,
  ) {
    const check = await this.store.queries.projectChecks.get(owner, checkId);
    if (!check?.page.repository)
      throw new HttpError(404, "이 계정의 코드 점검 기록을 찾지 못했습니다.");
    const previous = input.previousId
      ? await this.store.queries.projectChecks.dialogue(
          owner,
          checkId,
          input.questionIndex,
          input.previousId,
        )
      : null;
    if (input.previousId && !previous) throw new HttpError(409, "이전 대화를 다시 불러와 주세요.");
    if (previous && (previous.turns.length >= 3 || !previous.turns.at(-1)?.reply.nextQuestion))
      throw new HttpError(
        409,
        "이 질문의 대화를 마쳤습니다. 확인한 내용을 설계 답변에 반영해 주세요.",
      );
    const id = `${checkId}:dialogue:${input.questionIndex}:${previous?.turns.length ?? 0}`;
    const claim = await this.store.startJob(
      owner,
      id,
      `project-dialogue:${checkId}:${input.questionIndex}`,
      requestFingerprint(input.answer, input.previousId ?? ""),
    );
    if (claim.state === "done") return JSON.parse(claim.result) as ProjectDialogue;
    if (claim.state === "pending")
      throw new HttpError(
        409,
        "코드와 설명을 비교하고 있습니다. 잠시 후 대화를 새로고침해 주세요.",
      );
    try {
      await this.consume(owner, network, "review");
      const reply = await discussProjectCode(
        check,
        input.questionIndex,
        input.answer,
        previous,
        signal,
        (run) => this.store.queries.recordAiRun(owner, run),
      );
      const result: ProjectDialogue = {
        id,
        questionIndex: input.questionIndex,
        turns: [...(previous?.turns ?? []), { answer: input.answer, reply }],
      };
      await this.store.queries.projectChecks.completeDialogue(claim.lease, checkId, result);
      return result;
    } catch (error) {
      await this.store.failJob(claim.lease);
      throw error;
    }
  }
  async review(
    owner: string,
    network: string,
    input: z.infer<typeof reviewCheckSchema>,
    signal: AbortSignal,
  ) {
    const check = await this.store.queries.projectChecks.get(owner, input.id);
    if (!check) throw new HttpError(404, "이 계정의 분석 기록을 찾지 못했습니다.");
    if (!input.answers.some((answer) => answer.trim()))
      throw new HttpError(400, "한 질문 이상 답변하거나 모르는 이유를 적어 주세요.");
    const claim = await this.store.startJob(
      owner,
      `project-review-${input.id}`,
      `project-review:${input.id}`,
      requestFingerprint(...input.answers),
    );
    if (claim.state === "done") return publicReview(claim.result);
    if (claim.state === "pending")
      throw new HttpError(409, "답변을 검토하고 있습니다. 잠시 후 기록을 새로고침해 주세요.");
    try {
      await this.consume(owner, network, "review");
      const assessment = await this.ai.assess(check, input.answers, signal, (run) =>
        this.store.queries.recordAiRun(owner, run),
      );
      const result = { answers: input.answers, assessment };
      await this.store.queries.projectChecks.complete(claim.lease, result);
      return result;
    } catch (error) {
      await this.store.failJob(claim.lease);
      throw error;
    }
  }
}
