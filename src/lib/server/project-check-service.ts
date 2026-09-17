import type { z } from "zod";
import {
  createCheckSchema,
  reviewCheckSchema,
  PROJECT_LIMITS,
  type StoredCheck,
} from "../project-check/types";
import type { ProblemStore } from "./store-contract";
import { analyzeProject, assessProject } from "./ai-project-check";
import { readPublicPage, publicUrl } from "./project-page";
import { requestFingerprint } from "./write-conflicts";
import { publicCheck } from "./project-check-store";
import { HttpError } from "./http";
const defaults = { readPage: readPublicPage, analyze: analyzeProject, assess: assessProject };
export class ProjectCheckService {
  constructor(
    private store: ProblemStore,
    private ai = defaults,
  ) {}
  private async consume(owner: string, network: string, kind: "analysis" | "review") {
    const allowed = await this.store.consumeLimits([
      {
        key: `project:${kind}:${owner}`,
        max: PROJECT_LIMITS[kind],
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
      if (
        !(await this.store.consumeLimits([
          { key: `project:fetch:${owner}`, max: 5, windowMs: 60_000 },
          { key: `project:fetch-network:${network}`, max: 20, windowMs: 60_000 },
        ]))
      )
        throw new HttpError(429, "주소 확인 요청이 많습니다. 1분 후 다시 시도해 주세요.");
      const page = await this.ai.readPage(url, signal);
      if (page.limited && input.description.length < 120)
        throw new HttpError(
          422,
          "이 페이지는 공개 HTML에 서비스 내용이 거의 없습니다. 로그인 없이 읽을 수 있는 소개 페이지를 사용하거나, 주요 기능과 사용 기술을 120자 이상 설명해 주세요. AI 분석 횟수는 차감되지 않았습니다.",
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
    if (claim.state === "done") return JSON.parse(claim.result);
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
