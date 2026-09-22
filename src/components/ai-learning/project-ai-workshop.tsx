"use client";
import { startProjectAnalysis } from "@/lib/project-analysis-tasks";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { LearningStatus } from "@/lib/project-check/learning-generation";
import { generateLearning } from "@/lib/project-check/generate-learning";
import { RenewProject } from "@/components/project-check/renew-project";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import type { ProjectWorkshop } from "@/lib/ai-learning/project-workshop";
import { useProjectDraft } from "@/hooks/use-project-draft";
import {
  AppLink,
  Button,
  Card,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from "@/components/ui/primitives";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { RequestStatus } from "@/components/project-check/request-status";
import { WorkshopTopics } from "./workshop-topics";
export function ProjectAiWorkshop() {
  const params = useSearchParams();
  const [overview, setOverview] = useState<CheckOverview>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    api<CheckOverview>("/api/project-check", { scope: null, signal: abort.signal })
      .then((v) => {
        setOverview(v);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorMessage(e));
      });
    return () => abort.abort();
  }, [revision]);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  return (
    <>
      {error && (
        <Card role="alert">
          <p>{error}</p>
          <Button onClick={() => setRevision((n) => n + 1)}>다시 불러오기</Button>
        </Card>
      )}
      {!overview && !error && <ScreenSkeleton variant="lesson" label="프로젝트 기록 불러오는 중" />}
      {overview && (
        <Workspace
          key={`${overview.scope}:${params.get("check") || "new"}`}
          overview={overview}
          id={params.get("check")}
          refresh={() => setRevision((n) => n + 1)}
        />
      )}
    </>
  );
}
function Workspace({
  overview,
  id,
  refresh,
}: {
  overview: CheckOverview;
  id: string | null;
  refresh: () => void;
}) {
  const { draft, saveDraft, storageError } = useProjectDraft(overview.scope, "ai-workshop");
  const router = useRouter();
  const [check, setCheck] = useState<Check>();
  const [saved, setSaved] = useState<ProjectWorkshop | null>();
  const [progress, setProgress] = useState({ completed: 0, canRecover: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reload, setReload] = useState(0);
  const [checks, setChecks] = useState(overview.checks);
  const [cursor, setCursor] = useState(overview.nextCursor);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();
    Promise.all([
      api<Check>(`/api/project-check/${id}`, { scope: overview.scope, signal: abort.signal }),
      api<LearningStatus<ProjectWorkshop>>(`/api/project-check/${id}/workshop?stepwise=true`, {
        scope: overview.scope,
        signal: abort.signal,
      }),
    ])
      .then(([c, w]) => {
        setCheck(c);
        if (abort.signal.aborted) return;
        setSaved(w.result);
        setProgress(w);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorMessage(e));
      });
    return () => abort.abort();
  }, [id, overview.scope, reload]);
  async function analyze(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setError("");
    setBusy("저장소에서 학습할 근거를 읽고 있습니다");
    const requestId = draft.requestId || crypto.randomUUID();
    saveDraft((d) => ({ ...d, requestId }));
    try {
      // Restore the analysis stage before considering new paid work.
      let record: Check | undefined;
      try {
        record = await api<Check>(`/api/project-check/${requestId}`, { scope: overview.scope });
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
      if (!record) {
        if (overview.usage.analysis.remaining < 2)
          throw new Error(
            "새 저장소 분석과 AI 학습 준비에는 분석 2회가 필요합니다. 기존 프로젝트를 선택하거나 한도 초기화 후 이용해 주세요.",
          );
        record = await startProjectAnalysis(
          { requestId, url: draft.url, description: draft.description, source: "repository" },
          overview.scope,
          `/learn/ai/project?check=${requestId}`,
        );
      }
      if (!alive.current) return;
      router.replace(`/learn/ai/project?check=${record.id}`);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function generate() {
    if (lock.current || !id) return;
    lock.current = true;
    setBusy("코드 근거와 연결할 AI 수업을 정리하고 있습니다");
    setError("");
    try {
      setSaved(
        await generateLearning<ProjectWorkshop>(
          `/api/project-check/${id}/workshop`,
          overview.scope,
          setBusy,
        ),
      );
      refresh();
    } catch (e) {
      setError(errorMessage(e));
      try {
        const status = await api<LearningStatus<ProjectWorkshop>>(
          `/api/project-check/${id}/workshop?stepwise=true`,
          { scope: overview.scope },
        );
        setProgress(status);
        if (status.result) setSaved(status.result);
      } catch {
        /* Preserve the generation error. */
      }
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function more() {
    if (!cursor || lock.current) return;
    lock.current = true;
    setBusy("이전 기록 불러오는 중");
    try {
      const next = await api<CheckOverview>(
        `/api/project-check?cursor=${encodeURIComponent(cursor)}`,
        { scope: overview.scope },
      );
      setChecks((v) => [...v, ...next.checks.filter((c) => !v.some((p) => p.id === c.id))]);
      setCursor(next.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  return (
    <div className="project-ai-workspace">
      {error && (
        <Card role="alert">
          <p>{error}</p>
          {id && <Button onClick={() => setReload((n) => n + 1)}>저장된 학습 다시 불러오기</Button>}
        </Card>
      )}
      {busy && <RequestStatus label={busy} />}
      {!id ? (
        <Card className="project-ai-connect">
          <h2>어떤 프로젝트로 배울까요?</h2>
          <p>공개 저장소에서 이미 쓰는 AI의 역할과 새로운 활용 방법을 찾아봅니다.</p>
          <FieldLabel htmlFor="workshop-existing">분석한 프로젝트 선택</FieldLabel>
          <NativeSelect
            id="workshop-existing"
            value=""
            disabled={!!busy}
            onChange={(e) => router.push(`/learn/ai/project?check=${e.target.value}`)}
          >
            <option value="" disabled>
              기존 저장소 분석 선택
            </option>
            {checks
              .filter((c) => c.page.source === "repository")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.analysis.title}
                </option>
              ))}
          </NativeSelect>
          {cursor && (
            <Button disabled={!!busy} onClick={more}>
              이전 기록 더 보기
            </Button>
          )}
          <form onSubmit={analyze}>
            <FieldLabel htmlFor="workshop-url">새 공개 소스 저장소 링크</FieldLabel>
            <Input
              id="workshop-url"
              type="url"
              required
              maxLength={1500}
              disabled={!!busy}
              value={draft.url}
              onChange={(e) => {
                const url = e.target.value;
                saveDraft((d) => ({ ...d, url, requestId: null }));
              }}
            />
            <FieldLabel htmlFor="workshop-goal">
              만들고 싶은 기능 또는 궁금한 점 <span className="muted">선택</span>
            </FieldLabel>
            <Textarea
              id="workshop-goal"
              maxLength={2000}
              rows={3}
              value={draft.description}
              disabled={!!busy}
              onChange={(e) => {
                const description = e.target.value;
                saveDraft((d) => ({ ...d, description, requestId: null }));
              }}
              placeholder="예: 고객 문의를 분류하고 싶어요. 이미 연결한 AI의 오류 처리도 이해하고 싶어요."
            />
            <p className="muted">
              공개 코드 일부와 설명을 OpenAI로 보내 분석합니다. 새 분석 1회와 다음 단계의 학습 생성
              1회를 사용합니다. 현재 {overview.usage.analysis.remaining}회 남음. 비공개 저장소는
              지원하지 않습니다.
            </p>
            {storageError && <p role="status">입력 내용을 브라우저에 보관하지 못했습니다.</p>}
            <Button className="primary-button" disabled={!!busy || !overview.aiReady} type="submit">
              저장소 분석하고 다음으로 →
            </Button>
            {!overview.aiReady && (
              <p role="status">AI 연결을 준비 중입니다. 기존 학습이나 일반 수업을 이용해 주세요.</p>
            )}
          </form>
        </Card>
      ) : !check || saved === undefined ? (
        !error && <ScreenSkeleton variant="lesson" label="프로젝트 학습 불러오는 중" />
      ) : (
        <>
          <div className="project-ai-source">
            <div>
              <strong>{check.page.repository?.name || check.analysis.title}</strong>
              <p>
                분석한 코드 기준 {check.page.repository?.commit.slice(0, 7)} ·{" "}
                {check.page.repository?.files.length}개 파일 일부
              </p>
            </div>
            <AppLink href={`/projects?class=${id}`}>내 프로젝트 관리</AppLink>
            <AppLink href="/learn/ai/project">프로젝트 변경</AppLink>
          </div>
          {!check.page.repository ? (
            <Card>
              <p>AI 기술 학습에는 소스 저장소 분석이 필요합니다. 공개 저장소를 연결해 주세요.</p>
            </Card>
          ) : saved ? (
            <>
              <WorkshopTopics
                check={check}
                saved={saved}
                scope={overview.scope}
                onSaved={setSaved}
              />
              <RenewProject
                check={check}
                scope={overview.scope}
                destination="/learn/ai/project"
                disabled={!!busy}
              />
            </>
          ) : (
            <Card className="project-ai-connect">
              <h2>이 코드에 맞는 AI 학습을 준비해요</h2>
              {progress.completed > 0 && (
                <p role="status">
                  {progress.completed}/2단계 저장됨
                  {progress.canRecover
                    ? " · AI 호출 없이 결과를 복구할 수 있어요."
                    : " · 남은 단계부터 이어갑니다."}
                </p>
              )}
              <p>
                사용 중인 AI는 코드 근거로 설명하고, 새 도구는 적용 아이디어로 구분합니다. 관련
                수업과 작은 실험 계획까지 함께 준비합니다.
              </p>
              <p>
                현재 쓰는 기술과 새로운 활용 방법을 나눠 준비합니다. 완료한 단계는 저장되며 다시
                누르면 남은 단계만 생성합니다.
              </p>
              <p className="muted">
                수집한 공개 코드를 OpenAI로 보냅니다. 분석 1회 사용 ·{" "}
                {overview.usage.analysis.remaining}회 남음. 생성 후에는 추가 호출 없이 학습합니다.
              </p>
              <Button
                className="primary-button"
                disabled={
                  !!busy ||
                  (!progress.canRecover &&
                    (!overview.aiReady || overview.usage.analysis.remaining < 1))
                }
                onClick={generate}
              >
                {progress.canRecover
                  ? "저장된 결과 복구"
                  : error || progress.completed
                    ? "저장된 단계부터 이어서 생성"
                    : "AI 활용 학습 만들기"}
              </Button>
              {!progress.canRecover &&
                (!overview.aiReady || overview.usage.analysis.remaining < 1) && (
                  <p role="status">
                    지금은 새 학습을 생성할 수 없습니다. 저장된 학습이나 일반 수업을 이용해 주세요.
                  </p>
                )}
              <Button disabled={!!busy} onClick={() => setReload((n) => n + 1)}>
                저장된 학습 다시 불러오기
              </Button>
            </Card>
          )}
        </>
      )}
      <AppLink href="/learn/ai#ai-catalog">프로젝트 연결 없이 전체 수업 보기 →</AppLink>
    </div>
  );
}
