import type { LearningGeneration, LearningKind } from "../project-check/learning-generation";
import { projectExercisesSchema, validProjectExercises } from "../project-check/generated-practice";
import { workshopPlanSchema, validWorkshop } from "../ai-learning/project-workshop";
import type { JobLease } from "./store-contract";
import { readPublicGitRepository, looksLikeRepository } from "./public-git-repository";
import { generateProjectWorkshop } from "./ai-project-check";
import type { ProjectWorkshop } from "../ai-learning/project-workshop";
import { generateProjectExercises } from "./ai-project-check";
import type { GeneratedPractice } from "../project-check/generated-practice";
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
  readPage: (url: string, signal: AbortSignal, source?: "repository" | "website") =>
    source === "website"
      ? readProjectPages(url, signal)
      : githubTarget(url)
        ? readProjectRepository(url, signal)
        : source === "repository" || looksLikeRepository(url)
          ? readPublicGitRepository(url, signal)
          : readProjectPages(url, signal),
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
              max: kind === "analysis" ? allowanceFor(owner).analysis : 2,
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
  async generatePractice(owner: string, network: string, checkId: string, signal: AbortSignal) {
    const check = await this.store.queries.projectChecks.get(owner, checkId);
    if (!check) throw new HttpError(404, "점검 기록을 찾지 못했습니다.");
    if (!check.page.repository) throw new HttpError(422, "공개 소스 저장소를 먼저 분석해 주세요.");
    const claim = await this.store.startJob(
      owner,
      `${checkId}:practice`,
      `project-practice:${checkId}`,
      requestFingerprint(check.page.repository.commit),
    );
    if (claim.state === "done") return JSON.parse(claim.result) as GeneratedPractice;
    if (claim.state === "pending")
      throw new HttpError(409, "실습을 만들고 있습니다. 잠시 후 저장된 실습을 다시 불러와 주세요.");
    let charges: { key: string; expires: number }[] = [];
    try {
      await this.consume(owner, network, "analysis");
      charges = await this.store.queries.projectChecks.practiceCharges(owner, network);
      const exercises = await generateProjectExercises(check, signal);
      signal.throwIfAborted();
      const result: GeneratedPractice = {
        exercises,
        progress: { code: [], service: [] },
        revision: 0,
        createdAt: new Date().toISOString(),
      };
      await this.store.queries.projectChecks.completePractice(claim.lease, checkId, result);
      return result;
    } catch (error) {
      if (await this.store.failJob(claim.lease))
        await this.store.queries.projectChecks.refundPractice(claim.lease, charges);
      throw error;
    }
  }
  async generateWorkshop(owner: string, network: string, checkId: string, signal: AbortSignal) {
    const check = await this.store.queries.projectChecks.get(owner, checkId);
    if (!check) throw new HttpError(404, "점검 기록을 찾지 못했습니다.");
    if (!check.page.repository) throw new HttpError(422, "공개 소스 저장소를 먼저 분석해 주세요.");
    const claim = await this.store.startJob(
      owner,
      `${checkId}:workshop`,
      `project-workshop:${checkId}`,
      requestFingerprint(check.page.repository.commit),
    );
    if (claim.state === "done") return JSON.parse(claim.result) as ProjectWorkshop;
    if (claim.state === "pending")
      throw new HttpError(409, "프로젝트 AI 학습을 준비하고 있습니다. 잠시 후 다시 불러와 주세요.");
    let charges: { key: string; expires: number }[] = [];
    try {
      await this.consume(owner, network, "analysis");
      charges = await this.store.queries.projectChecks.practiceCharges(owner, network);
      const plan = await generateProjectWorkshop(check, signal);
      signal.throwIfAborted();
      const result: ProjectWorkshop = {
        plan,
        responses: [],
        revision: 0,
        createdAt: new Date().toISOString(),
      };
      await this.store.queries.projectChecks.completeWorkshop(claim.lease, checkId, result);
      return result;
    } catch (error) {
      if (await this.store.failJob(claim.lease))
        await this.store.queries.projectChecks.refundPractice(claim.lease, charges);
      throw error;
    }
  }
  /** One provider call per HTTP request. Completed stages survive retries and navigation. */
  async advanceLearning(
    owner: string,
    network: string,
    id: string,
    kind: LearningKind,
    signal: AbortSignal,
  ): Promise<LearningGeneration<GeneratedPractice | ProjectWorkshop>> {
    const q = this.store.queries.projectChecks;
    const check = await q.get(owner, id);
    if (!check?.page.repository) throw new HttpError(404, "분석한 공개 저장소를 찾지 못했습니다.");
    const saved =
      kind === "practice" ? await q.generatedPractice(owner, id) : await q.workshop(owner, id);
    if (saved) return { status: "done", result: saved };
    const claim = await this.store.startJob(
      owner,
      `${id}:${kind}`,
      `project-${kind}:${id}`,
      requestFingerprint(check.page.repository.commit),
    );
    if (claim.state === "done") return { status: "done", result: JSON.parse(claim.result) };
    if (claim.state === "pending")
      throw new HttpError(
        409,
        "다른 요청에서 학습을 만들고 있습니다. 잠시 후 이어서 생성해 주세요.",
      );
    const stages =
      kind === "practice" ? (["code", "service"] as const) : (["observed", "proposed"] as const);
    let stageLease: JobLease | undefined;
    let charges: { key: string; expires: number }[] = [];
    let persisted = false;
    try {
      const parts = await Promise.all(
        stages.map((stage) => q.learningStage(owner, id, kind, stage)),
      );
      const index = parts.findIndex((part) => part === null);
      if (index >= 0) {
        if (index === 1) {
          await this.consume(owner, network, "analysis");
          charges = await q.practiceCharges(owner, network);
        } else {
          if ((await q.usage(owner)).analysis.remaining < 1)
            throw new HttpError(
              429,
              "학습 생성에 사용할 횟수가 없습니다. 한도 초기화 후 이어서 진행해 주세요.",
            );
          // The two-stage bundle consumes one personal credit at its final stage.
          // Every provider attempt still counts toward global and network cost limits.
          if (
            !(await this.store.consumeLimits([
              {
                key: `project:learning-stage:${network}`,
                max: 10,
                windowMs: PROJECT_LIMITS.windowMs,
              },
              { key: "ai:global:hour", max: 40, windowMs: 3_600_000 },
              { key: "ai:global:day", max: 100, windowMs: PROJECT_LIMITS.windowMs },
            ]))
          )
            throw new HttpError(429, "잠시 후 학습 생성을 다시 시도해 주세요.");
        }
        const stage = stages[index];
        const stageClaim = await this.store.startJob(
          owner,
          `${id}:${kind}:${stage}`,
          `project-learning-stage:${id}`,
          requestFingerprint(check.page.repository.commit, "learning-stages-v1", stage),
        );
        if (stageClaim.state === "pending")
          throw new HttpError(409, "이 단계를 생성하고 있습니다. 잠시 후 이어서 진행해 주세요.");
        if (stageClaim.state === "done") parts[index] = JSON.parse(stageClaim.result);
        else {
          stageLease = stageClaim.lease;
          const part =
            kind === "practice"
              ? await generateProjectExercises(
                  check,
                  signal,
                  stage as "code" | "service",
                  index
                    ? (parts[0] as GeneratedPractice["exercises"]).code.map(
                        ({ title, situation, question }) => ({ title, situation, question }),
                      )
                    : undefined,
                )
              : await generateProjectWorkshop(
                  check,
                  signal,
                  stage as "observed" | "proposed",
                  index ? workshopPlanSchema.parse(parts[0]).topics.map((t) => t.title) : undefined,
                );
          signal.throwIfAborted();
          // Validate before storing a durable checkpoint, including mocked/injected generators.
          if (kind === "practice") {
            const mode = stage as "code" | "service";
            const tasks = projectExercisesSchema.shape[mode].parse(
              (part as GeneratedPractice["exercises"])[mode],
            );
            if (
              !validProjectExercises(
                { code: mode === "code" ? tasks : [], service: mode === "service" ? tasks : [] },
                check.page.repository,
              )
            )
              throw new HttpError(502, "실습 근거를 확인하지 못했습니다.");
          } else if (!validWorkshop(workshopPlanSchema.parse(part), check.page.repository))
            throw new HttpError(502, "학습 근거를 확인하지 못했습니다.");
          await q.completeLearningStage(stageLease, id, part);
          parts[index] = part;
        }
        persisted = true;
        if (index === 0) {
          await this.store.failJob(claim.lease); // Release the request lease; keep the completed stage.
          return {
            status: "pending",
            completed: 1,
            total: 2,
            label:
              kind === "practice"
                ? "코드 이해 실습을 저장했습니다. 서비스 동작 실습을 만들고 있습니다."
                : "현재 AI 활용 학습을 저장했습니다. 새로운 활용 방법을 정리하고 있습니다.",
          };
        }
      }
      const createdAt = new Date().toISOString();
      if (kind === "practice") {
        const a = parts[0] as GeneratedPractice["exercises"],
          b = parts[1] as GeneratedPractice["exercises"];
        const result: GeneratedPractice = {
          exercises: projectExercisesSchema.parse({ code: a.code, service: b.service }),
          progress: { code: [], service: [] },
          revision: 0,
          createdAt,
        };
        await q.completePractice(claim.lease, id, result);
        return { status: "done", result };
      }
      const a = workshopPlanSchema.parse(parts[0]),
        b = workshopPlanSchema.parse(parts[1]);
      const result: ProjectWorkshop = {
        plan: workshopPlanSchema.parse({ ...a, topics: [...a.topics, ...b.topics] }),
        responses: [],
        revision: 0,
        createdAt,
      };
      await q.completeWorkshop(claim.lease, id, result);
      return { status: "done", result };
    } catch (error) {
      if (stageLease) await this.store.failJob(stageLease);
      if ((await this.store.failJob(claim.lease)) && !persisted)
        await q.refundPractice(claim.lease, charges);
      throw error;
    }
  }
  beginAnalysis(owner: string, input: z.infer<typeof createCheckSchema>) {
    const url = publicUrl(input.url).href;
    return this.store.startJob(
      owner,
      input.requestId,
      "project-analysis",
      input.source
        ? requestFingerprint(url, input.description, input.source)
        : requestFingerprint(url, input.description),
    );
  }
  async create(
    owner: string,
    network: string,
    input: z.infer<typeof createCheckSchema>,
    signal: AbortSignal,
    reserved?: JobLease,
  ) {
    const url = publicUrl(input.url).href;
    const claim = reserved
      ? { state: "new" as const, lease: reserved }
      : await this.beginAnalysis(owner, input);
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
      const page = await this.ai.readPage(url, signal, input.source);
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
