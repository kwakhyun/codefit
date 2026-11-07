"use client";
import { analysisSnapshot, dismissAnalysis, subscribeAnalysis } from "@/lib/project-analysis-tasks";
import { forgetProjects } from "@/lib/project-cleanup";
import { useFadeTransition } from "@/components/ui/use-fade-transition";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { LoadingState } from "@/components/ui/loading-state";
import { Status, Card, Button } from "@/components/ui/primitives";
import { GuestLogin } from "@/components/account/guest-login";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, CircleAlert } from "lucide-react";
import { useProjectHistory } from "@/hooks/use-project-history";
import { useProjectDraft } from "@/hooks/use-project-draft";
import { useProjectOverview } from "@/hooks/use-project-overview";
import { allowanceWindow, guestAllowance, memberAllowance } from "@/lib/ai-access";
import { api, dateLabel, errorMessage } from "@/lib/client-api";
import { displayName, projectDeletion } from "@/lib/project-check/display";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import { NewProjectForm } from "./new-project-form";
import { ProjectDetail } from "./project-detail";
import { ProjectHistoryList } from "./project-history-list";

export function ProjectCheckApp() {
  const overview = useProjectOverview();
  const { data, error, loading } = overview;
  const knownScope = useRef<string | undefined>(undefined);
  const scope = data?.scope;
  useEffect(() => {
    if (!scope) return;
    // Another account's record must not stay selected after switching accounts.
    if (knownScope.current && knownScope.current !== scope) {
      const url = new URL(window.location.href);
      url.searchParams.delete("check");
      url.hash = "";
      window.history.replaceState(null, "", url);
    }
    knownScope.current = scope;
  }, [scope]);
  return (
    <>
      {loading && !data && <LoadingState variant="form">점검 기록 불러오는 중…</LoadingState>}
      {error && !data && (
        <Card as="div" className="project-panel" role="alert">
          <p>{error}</p>
          <Button className="secondary-button" onClick={overview.refresh}>
            다시 불러오기
          </Button>
        </Card>
      )}
      {data && (
        <div>
          <MemberWorkspace key={data.scope} data={data} overview={overview} />
          {!data.signedIn && (
            <Card as="aside" className="guest-trial-notice">
              <strong>로그인 없이 실제 프로젝트를 점검해 보세요</strong>
              <p>
                {allowanceWindow("analysis")} 기준 분석 횟수 {guestAllowance("analysis")}회와 평가
                횟수 {guestAllowance("projectReview")}회를 사용할 수 있습니다. 분석, 실습 생성, AI
                워크숍 생성이 분석 횟수를 함께 씁니다. 로그인하면 분석 횟수{" "}
                {memberAllowance("analysis")}회, 평가 횟수 {memberAllowance("projectReview")}회를
                사용할 수 있습니다.
              </p>
              <p className="guest-records-notice">
                <strong>기록은 이 브라우저에 남습니다.</strong> 로그인해도 지금 만든 기록이 계정으로
                자동으로 옮겨지지 않습니다. 계정에서 이어가려면 로그인 전에 환경 설정 → 백업
                내보내기로 파일을 저장하고, 로그인한 뒤 백업 가져오기를 이용하세요.
              </p>
              <GuestLogin returnTo="/project-check" compact />
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function MemberWorkspace({
  data,
  overview,
}: {
  data: CheckOverview;
  overview: ReturnType<typeof useProjectOverview>;
}) {
  const onChange = overview.update;
  const { confirm, confirmation } = useConfirmation();
  const history = useProjectHistory(data);
  const { selected, check, select } = history;
  const newProject = useSearchParams().get("new") === "1";
  const fade = useFadeTransition<HTMLDivElement>(selected || "new");
  const alive = useRef(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const draftApi = useProjectDraft(data.scope);
  // The follow effect below outlives renders; it reads the current draft through this ref.
  const finishDraft = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    finishDraft.current = (id) => {
      if (draftApi.draft.requestId !== id) return;
      draftApi.saveDraft((value) => ({ ...value, requestId: null }));
      draftApi.clearSavedDraft();
    };
  });
  useEffect(() => {
    const watched = new Set<string>();
    const follow = () => {
      for (const task of analysisSnapshot()) {
        if (task.scope !== data.scope) continue;
        if (task.status === "pending") watched.add(task.id);
        else if (watched.delete(task.id) && task.status === "done") {
          const url = new URL(window.location.href);
          // Open a finished analysis only while the new-analysis form is shown.
          if (url.searchParams.get("check")) continue;
          url.searchParams.set("check", task.id);
          url.hash = "";
          window.history.pushState(null, "", url);
          dismissAnalysis(task.id);
          finishDraft.current(task.id);
        }
      }
    };
    follow();
    return subscribeAnalysis(follow);
  }, [data.scope]);
  const registrationHeading = useRef<HTMLHeadingElement>(null);
  const historyPanel = useRef<HTMLDetailsElement>(null);
  function focusRegistration() {
    registrationHeading.current?.focus({ preventScroll: true });
    registrationHeading.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }
  useEffect(() => {
    if (!selected && newProject) focusRegistration();
  }, [selected, newProject]);
  useEffect(() => {
    if (selected && historyPanel.current) historyPanel.current.open = false;
  }, [selected]);
  async function reload() {
    const result = await api<CheckOverview>("/api/project-check", {
      scope: data.scope,
      signal: AbortSignal.timeout(15_000),
    });
    if (alive.current) onChange(() => result);
  }
  /** Opens a submitted analysis; only then is the new-project draft finished. */
  function showCheck(result: Check) {
    if (!alive.current) return;
    draftApi.saveDraft((value) => ({ ...value, requestId: null }));
    draftApi.clearSavedDraft();
    onChange((current) => ({
      ...current,
      checks: [result, ...current.checks.filter((c) => c.id !== result.id)],
    }));
    history.updateDetail(result);
    select(result.id);
    void refreshUsage();
  }
  async function refreshUsage() {
    // A delayed overview must not overwrite a result just received from POST/PATCH/detail.
    await api<CheckOverview>("/api/project-check", {
      scope: data.scope,
      track: false,
      signal: AbortSignal.timeout(15_000),
    })
      .then((value) => {
        if (alive.current)
          onChange((current) => ({ ...current, usage: value.usage, aiReady: value.aiReady }));
      })
      .catch(() => {
        if (alive.current)
          setNotice(
            "결과는 저장됐지만 남은 이용 횟수를 갱신하지 못했습니다. 기록 새로고침을 눌러 주세요.",
          );
      });
  }
  /** A revision belongs to its root project, so it is opened without joining the history list. */
  function showRevision(result: Check) {
    if (!alive.current) return;
    history.updateDetail(result);
    select(result.id);
  }
  async function remove() {
    if (deleting || !check) return;
    // "프로젝트 삭제" removes the whole project, also from a revision screen.
    const rootId =
      check.revisionOf && check.revisionTimeline?.some((item) => item.id === check.revisionOf)
        ? check.revisionOf
        : check.id;
    const { message, options } = projectDeletion(displayName(check));
    if (!(await confirm(message, options))) return;
    setDeleting(true);
    setError("");
    try {
      const { ids } = await api<{ ids?: string[] }>("/api/project-check", {
        method: "DELETE",
        scope: data.scope,
        body: { id: rootId },
      });
      forgetProjects(data.scope, ids ?? [rootId]);
      if (!alive.current) return;
      onChange((current) => ({
        ...current,
        checks: current.checks.filter((c) => !(ids ?? [rootId]).includes(c.id)),
      }));
      select(null, true);
      await reload();
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      if (alive.current) setDeleting(false);
    }
  }
  const first = data.checks.length === 0 && !selected && !data.nextCursor;
  return (
    <>
      {confirmation}
      <div className="project-usage">
        <span>
          <strong>
            분석 횟수 {data.usage.analysis.remaining} / {data.usage.analysis.limit}회
          </strong>{" "}
          남음
        </span>
        <span>
          평가 횟수 {data.usage.review.remaining} / {data.usage.review.limit}회 남음
        </span>
        <span>
          {data.usage.analysis.resetsAt
            ? `${dateLabel(data.usage.analysis.resetsAt)} 분석 횟수 초기화`
            : "첫 사용부터 24시간 기준"}
        </span>
        {data.usage.review.resetsAt && (
          <span>{dateLabel(data.usage.review.resetsAt)} 평가 횟수 초기화</span>
        )}
        <Button
          className="text-button"
          disabled={deleting}
          onClick={() => reload().catch((e) => setError(errorMessage(e)))}
        >
          <RefreshCw size={15} aria-hidden="true" /> 기록 새로고침
        </Button>
      </div>
      {error && (
        <Status role="alert" className="project-error">
          {error}
        </Status>
      )}
      {notice && (
        <Status role="status" className="project-panel">
          {notice}
        </Status>
      )}
      {history.missing && (
        <Status role="status" className="project-panel">
          선택한 점검 기록을 찾지 못했습니다. 삭제된 기록일 수 있어 점검 기록 목록을 표시합니다.
        </Status>
      )}
      {!data.aiReady && (
        <Status role="status" className="ui-notice">
          <CircleAlert size={18} aria-hidden="true" />
          현재 새 AI 분석을 시작할 수 없습니다. 저장된 질문과 평가 기록은 계속 볼 수 있습니다.
        </Status>
      )}
      <div ref={fade} className={`project-layout ${first ? "project-layout-first" : ""}`}>
        <ProjectHistoryList
          data={data}
          selected={selected}
          rootId={check?.revisionOf}
          panelRef={historyPanel}
          open={history.missing}
          disabled={deleting}
          paging={overview.paging}
          pageError={overview.pageError}
          onMore={() => void overview.loadMore()}
          onNew={() => {
            draftApi.saveDraft((value) => ({ ...value, requestId: null }));
            setError("");
            setNotice("");
            select(null);
            if (historyPanel.current) historyPanel.current.open = false;
            if (!selected) focusRegistration();
          }}
          onSelect={(id) => {
            if (historyPanel.current) historyPanel.current.open = false;
            select(id);
          }}
        />
        <div className="project-main">
          {selected && !check ? (
            <Card as="section" className="project-panel">
              {history.detailError ? (
                <>
                  <Status role="alert">{history.detailError}</Status>
                  <Button className="secondary-button" onClick={history.reloadDetail}>
                    기록 다시 불러오기
                  </Button>
                </>
              ) : (
                <LoadingState variant="form">선택한 점검 기록 불러오는 중…</LoadingState>
              )}
            </Card>
          ) : !check ? (
            <NewProjectForm
              data={data}
              draftApi={draftApi}
              headingRef={registrationHeading}
              onOpen={showCheck}
              onSelect={(id) => select(id)}
            />
          ) : (
            <ProjectDetail
              check={check}
              data={data}
              busy={deleting}
              onSelect={(id) => select(id)}
              onDelete={() => void remove()}
              onUsage={refreshUsage}
              onRevised={showRevision}
              onReviewed={async (review) => {
                history.updateDetail({ ...check, review });
                onChange((current) => ({
                  ...current,
                  checks: current.checks.map((c) =>
                    c.id === check.id
                      ? { ...c, review: { assessment: { score: review.assessment.score } } }
                      : c,
                  ),
                }));
                await refreshUsage();
              }}
              onPracticeSaved={(practice) => {
                history.updateDetail({ ...check, review: { ...check.review!, practice } });
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
