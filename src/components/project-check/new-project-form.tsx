"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { ArrowRight, CircleAlert, WifiOff } from "lucide-react";
import {
  AppLink,
  Button,
  Card,
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Input,
  NativeSelect,
  Status,
  Textarea,
} from "@/components/ui/primitives";
import { VoiceInput } from "@/components/ui/voice-input";
import { dateLabel, errorMessage } from "@/lib/client-api";
import {
  analysisServerSnapshot,
  analysisSnapshot,
  analysisState,
  refreshAnalysis,
  resumeProjectAnalysis,
  showAnalysisOnPage,
  startProjectAnalysis,
  subscribeAnalysis,
} from "@/lib/project-analysis-tasks";
import { detectSource } from "@/lib/project-check/display";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import type { useProjectDraft } from "@/hooks/use-project-draft";
import { AllowanceCost } from "./allowance-cost";
import { CancelAnalysis } from "./cancel-analysis";
import { ProjectExample } from "./project-example";
import { RequestStatus } from "./request-status";

/**
 * New analysis: the address first, one optional description, the cost before the button and
 * everything else in one "자세히" panel. The current request's state is shown here (and not
 * repeated by the floating activity) with one action per state.
 */
export function NewProjectForm({
  data,
  draftApi,
  headingRef,
  onOpen,
  onSelect,
}: {
  data: CheckOverview;
  draftApi: ReturnType<typeof useProjectDraft>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onOpen: (check: Check) => void;
  onSelect: (id: string) => void;
}) {
  const { draft, saveDraft, storageError } = draftApi;
  const { url, description, requestId } = draft;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const tasks = useSyncExternalStore(subscribeAnalysis, analysisSnapshot, analysisServerSnapshot);
  // An analysis keeps running after leaving this page; never start a second paid run meanwhile.
  const pendingTask = tasks.find((task) => task.scope === data.scope && task.status === "pending");
  const currentTask = requestId
    ? tasks.find((task) => task.scope === data.scope && task.id === requestId)
    : undefined;
  const currentState = currentTask ? analysisState(currentTask) : undefined;
  const analyzing = sending || !!pendingTask;
  const shown = [pendingTask?.id, currentTask?.id].filter(Boolean).join(",");
  useEffect(() => showAnalysisOnPage(shown ? shown.split(",") : []), [shown]);
  const exhausted = data.usage.analysis.remaining === 0;
  const resetLabel = data.usage.analysis.resetsAt
    ? `${dateLabel(data.usage.analysis.resetsAt)}에 분석 횟수가 다시 채워집니다.`
    : "초기화 시각을 확인하려면 기록 새로고침을 눌러 주세요.";
  const detected = draft.source ?? detectSource(url);
  const blocked = !data.aiReady
    ? "지금은 새 AI 분석을 시작할 수 없습니다. 저장된 질문과 평가 기록은 계속 볼 수 있습니다."
    : exhausted
      ? `분석 횟수를 모두 사용했습니다. ${resetLabel} 입력한 초안은 유지됩니다.`
      : "";
  async function create(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current || blocked || pendingTask) return;
    active.current = true;
    setSending(true);
    setError("");
    const id = requestId || crypto.randomUUID();
    saveDraft((value) => ({ ...value, requestId: id }));
    try {
      const result = await startProjectAnalysis(
        { requestId: id, url, description, ...(draft.source ? { source: draft.source } : {}) },
        data.scope,
      );
      if (alive.current) onOpen(result);
    } catch {
      // The request's task carries the reason and its one action; nothing to repeat here.
    } finally {
      active.current = false;
      if (alive.current) setSending(false);
    }
  }
  /** Reads the status of an earlier request without calling AI again. */
  function recheck() {
    if (!requestId) return;
    setError("");
    if (currentTask) refreshAnalysis(currentTask);
    else
      void resumeProjectAnalysis(requestId, data.scope, url)
        .then((result) => alive.current && onOpen(result))
        .catch((e) => {
          if (alive.current && !tasks.some((task) => task.id === requestId))
            setError(errorMessage(e));
        });
  }
  const edit = (patch: Partial<typeof draft>) =>
    saveDraft((value) => ({ ...value, ...patch, requestId: null }));
  return (
    <>
      <form className="project-panel project-form" onSubmit={create}>
        <h2 id="project-register" ref={headingRef} tabIndex={-1}>
          어떤 프로젝트를 살펴볼까요?
        </h2>
        {!data.signedIn && (
          <Disclosure className="project-example-disclosure">
            <DisclosureSummary>입력 전에 질문과 피드백 예시 살펴보기</DisclosureSummary>
            <ProjectExample />
          </Disclosure>
        )}
        {exhausted && (
          <Card as="section" className="project-quota-notice" aria-label="분석 횟수 안내">
            <h3>지금은 새 프로젝트를 분석할 수 없습니다</h3>
            <p>
              분석, 실습 생성, AI 워크숍 생성이 함께 쓰는 분석 횟수 {data.usage.analysis.limit}회를
              모두 사용했습니다. {resetLabel} 주소와 설명은 미리 작성해 둘 수 있습니다.
            </p>
            <p>
              {data.usage.review.remaining > 0
                ? `평가 횟수는 ${data.usage.review.remaining}회 남아 있습니다. 기존 질문에 답하거나 보완 답변을 평가받을 수 있습니다.`
                : "기존 질문과 평가 결과는 계속 볼 수 있습니다."}
            </p>
            <div className="project-quota-actions">
              {data.checks[0] && (
                <Button
                  type="button"
                  className="secondary-button"
                  onClick={() => onSelect(data.checks[0].id)}
                >
                  {data.usage.review.remaining > 0
                    ? "최근 점검에서 답변 이어가기"
                    : "최근 점검 기록 보기"}
                </Button>
              )}
              <AppLink href="/learn?source=sample">로그인 없이 서비스 원리 연습하기 →</AppLink>
            </div>
          </Card>
        )}
        <FieldLabel htmlFor="project-url">서비스 또는 공개 저장소 링크</FieldLabel>
        <Input
          id="project-url"
          type="url"
          required
          maxLength={1500}
          value={url}
          onChange={(e) => edit({ url: e.target.value })}
          placeholder="https://my-service.com 또는 https://github.com/owner/repository"
          disabled={analyzing}
          aria-describedby="project-url-help"
        />
        <p id="project-url-help" className="project-help">
          공개 서비스나 공개 저장소만 분석합니다. 비밀키, 로그인 토큰과 사용자 데이터는 넣지 마세요.{" "}
          {detected === "repository"
            ? `${draft.source ? "선택한" : "자동 확인한"} 유형: 공개 저장소 — 코드와 파일 관계를 읽습니다.`
            : detected === "website"
              ? `${draft.source ? "선택한" : "자동 확인한"} 유형: 서비스 웹사이트 — 로그인 없이 보이는 화면을 읽습니다.`
              : ""}
        </p>
        <FieldLabel htmlFor="project-description">
          서비스와 구현 방식 설명 <span>(선택)</span>
        </FieldLabel>
        <Textarea
          id="project-description"
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => edit({ description: e.target.value })}
          disabled={analyzing}
          aria-describedby="project-description-help"
          placeholder="어떤 문제를 해결하나요? 주요 기능, 사용한 도구, 직접 결정한 설계가 있다면 알려주세요."
        />
        <VoiceInput
          targetId="project-description"
          disabled={analyzing}
          onTranscript={(text) =>
            saveDraft((value) => ({
              ...value,
              description: `${value.description}${value.description ? " " : ""}${text}`.slice(
                0,
                2000,
              ),
              requestId: null,
            }))
          }
        />
        <p id="project-description-help" className="project-help">
          화면에서 알 수 없는 구현을 설명하면 더 구체적인 질문을 받습니다. {description.length} /
          2000자
        </p>
        <Disclosure className="project-form-details">
          <DisclosureSummary>자세히: 주소 유형, AI 전송 범위와 보관</DisclosureSummary>
          <FieldLabel htmlFor="project-source">어떤 주소인가요?</FieldLabel>
          <NativeSelect
            id="project-source"
            value={draft.source || "auto"}
            disabled={analyzing}
            onChange={(e) => {
              const source = e.target.value as "repository" | "website" | "auto";
              edit({ source: source === "auto" ? undefined : source });
            }}
          >
            <option value="auto">주소에서 자동으로 확인</option>
            <option value="repository">공개 소스 저장소 — 자체 호스팅 포함</option>
            <option value="website">서비스 웹사이트</option>
          </NativeSelect>
          <ul className="project-help">
            <li>
              자체 호스팅 저장소처럼 자동으로 알아보지 못하는 주소는 위에서 유형을 직접 고르세요.
            </li>
            <li>
              공개 화면 또는 코드 발췌와 입력한 내용을 OpenAI로 보내 분석합니다. 공개 코드 분석은
              TypeSafe AI로 먼저 읽을 코드 구간을 추천할 수 있습니다. 분석할 권한이 있는 프로젝트만
              입력하세요.
            </li>
            <li>비공개 저장소와 로그인이 필요한 화면은 지원하지 않습니다.</li>
            <li>
              코드 이해 훈련과 서비스 동작 실습을 만들 때, AI 워크숍을 만들 때 분석 횟수를 1회씩 더
              사용합니다. 저장된 결과를 보거나 답안을 저장할 때는 차감하지 않습니다.
            </li>
            <li>AI 호출을 시작한 뒤 응답을 받지 못해도 분석 횟수가 차감될 수 있습니다.</li>
            <li>주소와 설명은 현재 브라우저의 이 탭에 보관됩니다.</li>
          </ul>
        </Disclosure>
        {storageError && (
          <Status role="alert">
            브라우저에 초안을 보관하지 못했습니다. 화면을 닫기 전에 작성한 내용을 복사해 주세요.
          </Status>
        )}
        {requestId && !analyzing && currentState !== "done" && currentState !== "cancelled" && (
          <div className="project-recovery" data-state={currentState ?? "unknown"}>
            {currentState === "input" || currentState === "failed" ? (
              <Status role="alert" className="project-error">
                <CircleAlert size={18} aria-hidden="true" />
                <span>
                  <strong>
                    {currentState === "input" ? "입력을 확인해 주세요" : "분석하지 못했어요"}
                  </strong>{" "}
                  {currentTask?.message}{" "}
                  {currentState === "input"
                    ? "주소나 설명을 고친 뒤 다시 요청하세요."
                    : "같은 내용으로 다시 요청하거나 주소를 바꿔 새로 요청할 수 있습니다."}
                </span>
              </Status>
            ) : (
              <>
                <p className="project-help">
                  <WifiOff size={16} aria-hidden="true" />{" "}
                  {currentState === "disconnected"
                    ? "앞선 분석의 응답을 받지 못했습니다. 서버에서는 분석이 계속될 수 있습니다."
                    : "앞선 분석 요청의 결과를 아직 확인하지 않았습니다."}{" "}
                  상태 확인은 AI를 다시 호출하거나 분석 횟수를 차감하지 않습니다.
                </p>
                <Button type="button" className="secondary-button" onClick={recheck}>
                  분석 상태 다시 확인
                </Button>
              </>
            )}
          </div>
        )}
        {error && (
          <Status role="alert" className="project-error">
            {error}
          </Status>
        )}
        <AllowanceCost
          id="project-analysis-cost"
          label="분석 횟수"
          cost={1}
          remaining={data.usage.analysis.remaining}
          resetsAt={data.usage.analysis.resetsAt}
        />
        <Button
          className="primary-button"
          type="submit"
          disabled={analyzing || !!blocked}
          aria-describedby={`project-analysis-cost${blocked ? " project-analysis-limit" : ""}`}
        >
          {analyzing
            ? "프로젝트 자료를 읽고 질문을 준비하고 있습니다…"
            : exhausted
              ? "분석 횟수를 모두 사용했습니다"
              : "내 프로젝트 질문 받기"}
          <ArrowRight size={17} aria-hidden="true" />
        </Button>
        {blocked && (
          <p id="project-analysis-limit" className="project-help">
            {blocked}
          </p>
        )}
      </form>
      {pendingTask && (
        // Outside the form: the confirmation dialog's buttons must not submit it.
        <Card as="section" className="project-panel project-analysis-progress">
          <RequestStatus
            label={`${pendingTask.label} 분석이 진행 중입니다`}
            startedAt={pendingTask.startedAt}
          />
          <p className="project-help">
            다른 화면을 이용해도 분석은 계속되며, 이 화면에 돌아오면 결과를 엽니다.
          </p>
          <CancelAnalysis task={pendingTask} />
        </Card>
      )}
    </>
  );
}
