"use client";
import { ProjectExample } from "./project-example";
import { ProjectLearning } from "@/components/project-learning/project-learning";
import { GuestLogin } from "@/components/account/guest-login";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Globe2, RefreshCw, ShieldCheck } from "lucide-react";
import { useProjectHistory, type UpdateOverview } from "@/hooks/use-project-history";
import { useProjectDraft } from "@/hooks/use-project-draft";
import { VoiceInput } from "@/components/ui/voice-input";
import { api, ApiError, dateLabel, errorMessage, setWorkspaceScope } from "@/lib/client-api";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import { ProjectQuestions } from "./project-questions";
import { RequestStatus } from "./request-status";
export function ProjectCheckApp() {
  const [data, setData] = useState<CheckOverview>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState(true);
  const knownScope = useRef<string | undefined>(undefined);
  useEffect(() => {
    const refreshAccount = () => {
      setChecking(true);
      setRefresh((n) => n + 1);
    };
    window.addEventListener("focus", refreshAccount);
    window.addEventListener("codefit:backup-imported", refreshAccount);
    return () => {
      window.removeEventListener("focus", refreshAccount);
      window.removeEventListener("codefit:backup-imported", refreshAccount);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api<CheckOverview>("/api/project-check", {
      scope: null,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        if (knownScope.current && knownScope.current !== value.scope) {
          const url = new URL(window.location.href);
          url.searchParams.delete("check");
          url.hash = "";
          window.history.replaceState(null, "", url);
        }
        knownScope.current = value.scope;
        setWorkspaceScope(value.scope);
        setData(value);
        setError("");
        setChecking(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(e));
          setChecking(false);
        }
      });
    return () => controller.abort();
  }, [refresh]);
  return (
    <>
      {checking && (
        <p role="status" className="project-panel">
          점검 기록 불러오는 중…
        </p>
      )}
      {error && (
        <div className="project-panel" role="alert">
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => {
              setChecking(true);
              setRefresh((n) => n + 1);
            }}
          >
            다시 불러오기
          </button>
        </div>
      )}
      {data && (
        <div hidden={checking || !!error}>
          {data.signedIn ? (
            <MemberWorkspace
              key={data.scope}
              data={data}
              onChange={(update) =>
                setData((current) => (current?.scope === data.scope ? update(current) : current))
              }
            />
          ) : (
            <>
              <ProjectExample />
              <section className="project-panel project-signin">
                <ShieldCheck size={32} />
                <h2>내 프로젝트로 질문을 받아보세요</h2>
                <p>
                  가입하면 24시간에 2개의 프로젝트를 분석할 수 있습니다. 질문과 평가 기록은 본인만
                  볼 수 있습니다.
                </p>
                <GuestLogin returnTo="/project-check" />
                <Link href="/learn">로그인 없이 서비스 원리 배우기 →</Link>
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}
function MemberWorkspace({ data, onChange }: { data: CheckOverview; onChange: UpdateOverview }) {
  const history = useProjectHistory(data, onChange);
  const { selected, check, select } = history;
  const alive = useRef(true);
  const activeMutation = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const { draft, saveDraft, clearSavedDraft, storageError } = useProjectDraft(data.scope);
  const { url, description, requestId } = draft;
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recovering, setRecovering] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const historyPanel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (selected && historyPanel.current) historyPanel.current.open = false;
  }, [selected]);
  const checkId = check?.id;
  useEffect(() => {
    if (checkId) resultHeading.current?.focus();
  }, [checkId]);
  async function reload() {
    const result = await api<CheckOverview>("/api/project-check", {
      scope: data.scope,
      signal: AbortSignal.timeout(15_000),
    });
    if (alive.current) onChange(() => result);
  }
  function showCheck(result: Check) {
    if (!alive.current) return;
    saveDraft((value) => ({ ...value, requestId: null }));
    clearSavedDraft();
    onChange((current) => ({
      ...current,
      checks: [result, ...current.checks.filter((c) => c.id !== result.id)],
    }));
    select(result.id);
  }
  async function refreshUsage() {
    // A delayed overview must not overwrite a result just received from POST/PATCH/detail.
    await api<CheckOverview>("/api/project-check", {
      scope: data.scope,
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
  async function recover() {
    if (!requestId || activeMutation.current) return;
    activeMutation.current = true;
    setRecovering(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Check>(`/api/project-check/${requestId}`, {
        scope: data.scope,
        signal: AbortSignal.timeout(15_000),
      });
      if (!alive.current) return;
      showCheck(result);
      await refreshUsage();
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && e.status === 404)
        setNotice(
          "아직 저장된 결과를 찾지 못했습니다. 처리가 끝나지 않았을 수 있으니 잠시 후 다시 확인해 주세요.",
        );
      else setError(errorMessage(e));
    } finally {
      activeMutation.current = false;
      if (alive.current) setRecovering(false);
    }
  }
  async function create(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeMutation.current) return;
    activeMutation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const id = requestId || crypto.randomUUID();
    saveDraft((value) => ({ ...value, requestId: id }));
    try {
      const result = await api<Check>("/api/project-check", {
        method: "POST",
        scope: data.scope,
        body: { requestId: id, url, description, consent },
      });
      if (!alive.current) return;
      showCheck(result);
      await refreshUsage();
    } catch (e) {
      if (!alive.current) return;
      setError(errorMessage(e));
      await reload().catch(() => {});
    } finally {
      activeMutation.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function remove() {
    if (
      activeMutation.current ||
      !check ||
      !window.confirm("이 프로젝트의 질문과 평가 기록을 삭제할까요?")
    )
      return;
    activeMutation.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/api/project-check", {
        method: "DELETE",
        scope: data.scope,
        body: { id: check.id },
      });
      try {
        sessionStorage.removeItem(`codefit-project:${data.scope}:${check.id}`);
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith(`codefit-training:${data.scope}:${check.id}:`))
            sessionStorage.removeItem(key);
        }
      } catch {}
      if (!alive.current) return;
      onChange((current) => ({
        ...current,
        checks: current.checks.filter((c) => c.id !== check.id),
      }));
      select(null, true);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      activeMutation.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="project-usage">
        <span>
          <strong>
            새 분석 {data.usage.analysis.remaining} / {data.usage.analysis.limit}회
          </strong>{" "}
          남음
        </span>
        <span>
          답변 평가 {data.usage.review.remaining} / {data.usage.review.limit}회 남음
        </span>
        <span>
          {data.usage.analysis.resetsAt
            ? `${dateLabel(data.usage.analysis.resetsAt)} 분석 한도 초기화`
            : "첫 사용부터 24시간 기준"}
        </span>
        {data.usage.review.resetsAt && (
          <span>{dateLabel(data.usage.review.resetsAt)} 평가 한도 초기화</span>
        )}
        <button
          className="text-button"
          disabled={busy || recovering}
          onClick={() => reload().catch((e) => setError(errorMessage(e)))}
        >
          <RefreshCw size={15} /> 기록 새로고침
        </button>
      </div>
      {error && (
        <p role="alert" className="project-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="project-panel">
          {notice}
        </p>
      )}
      {!data.aiReady && (
        <p role="status" className="project-panel">
          AI 연결을 준비 중입니다. 저장된 질문과 평가 기록은 계속 볼 수 있습니다.
        </p>
      )}
      <div className="project-layout">
        <aside className="project-history" aria-label="내 프로젝트 점검 기록">
          <button
            className="secondary-button"
            disabled={busy || recovering}
            onClick={() => {
              saveDraft((value) => ({ ...value, requestId: null }));
              setError("");
              setNotice("");
              select(null);
            }}
          >
            + 새 프로젝트 점검
          </button>
          <details ref={historyPanel} className="project-history-list" open={!selected}>
            <summary>
              {selected ? "다른 점검 기록 보기" : "점검 기록"}{" "}
              <small>({data.checks.length}개 불러옴)</small>
            </summary>
            <div className="project-history-items">
              {data.checks.length === 0 ? (
                <p>첫 분석을 마치면 여기에 기록이 쌓입니다.</p>
              ) : (
                data.checks.map((c) => (
                  <button
                    key={c.id}
                    aria-pressed={selected === c.id}
                    disabled={busy || recovering}
                    onClick={() => select(c.id)}
                  >
                    <strong>{c.analysis.title}</strong>
                    <span>{new URL(c.page.url).hostname}</span>
                    <small>
                      {c.review ? `평가 완료 ${c.review.assessment.score}점` : "질문에 답변하기"} ·{" "}
                      {dateLabel(c.createdAt)}
                    </small>
                  </button>
                ))
              )}
              {data.nextCursor && (
                <button
                  className="secondary-button"
                  disabled={busy || recovering || history.paging}
                  onClick={() => void history.loadMore()}
                >
                  {history.paging ? "이전 기록 불러오는 중…" : "이전 기록 더 보기"}
                </button>
              )}
              {history.pageError && <p role="alert">{history.pageError}</p>}
            </div>
          </details>
        </aside>
        <div className="project-main">
          {selected && !check ? (
            <section className="project-panel">
              {history.detailError ? (
                <>
                  <p role="alert">{history.detailError}</p>
                  <button className="secondary-button" onClick={history.reloadDetail}>
                    기록 다시 불러오기
                  </button>
                </>
              ) : (
                <p role="status">선택한 점검 기록 불러오는 중…</p>
              )}
            </section>
          ) : !check ? (
            <form className="project-panel project-form" onSubmit={create}>
              <Globe2 size={28} />
              <h2>어떤 서비스를 만드셨나요?</h2>
              <p>
                공개 페이지에서 확인한 기능을 바탕으로, 설계를 얼마나 이해하고 있는지 질문합니다.
              </p>
              <label htmlFor="project-url">서비스 링크</label>
              <input
                id="project-url"
                type="url"
                required
                maxLength={1500}
                value={url}
                onChange={(e) =>
                  saveDraft((value) => ({ ...value, url: e.target.value, requestId: null }))
                }
                placeholder="https://my-service.com"
                disabled={busy || recovering}
                aria-describedby="project-url-help"
              />
              <p id="project-url-help" className="project-help">
                로그인 없이 열리는 HTTPS 주소를 입력하세요. 주소에 로그인 토큰이나 개인 정보가 들어
                있으면 안 됩니다.
              </p>
              <label htmlFor="project-description">
                서비스와 구현 방식 설명 <span>(선택)</span>
              </label>
              <textarea
                id="project-description"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) =>
                  saveDraft((value) => ({ ...value, description: e.target.value, requestId: null }))
                }
                disabled={busy || recovering}
                placeholder="어떤 문제를 해결하나요? 주요 기능, 사용한 도구, 직접 결정한 설계가 있다면 알려주세요."
              />
              <VoiceInput
                targetId="project-description"
                disabled={busy || recovering}
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
              <p className="project-help">
                화면에서 알 수 없는 구현을 설명하면 더 구체적인 질문을 받을 수 있습니다. 비밀키와
                사용자 데이터는 입력하지 마세요.
              </p>
              <p className="project-help">
                {description.length} / 2000자 · 주소와 설명은 이 계정의 현재 탭에 보관됩니다.
              </p>
              {storageError && (
                <p role="alert">
                  브라우저에 초안을 보관하지 못했습니다. 화면을 닫기 전에 작성한 내용을 복사해
                  주세요.
                </p>
              )}
              {requestId && !busy && (
                <div className="project-recovery">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={recovering}
                    onClick={() => void recover()}
                  >
                    {recovering ? "저장된 결과 확인 중…" : "저장된 분석 결과 확인"}
                  </button>
                  <p className="project-help">
                    앞선 요청의 결과만 조회합니다. AI를 다시 호출하거나 이용 횟수를 차감하지
                    않습니다.
                  </p>
                </div>
              )}
              <label className="project-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                  disabled={busy || recovering}
                />
                <span>
                  내가 만든 서비스이며, 공개 페이지 내용과 작성한 설명·답변을 OpenAI에 전송해
                  분석하는 데 동의합니다.
                </span>
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  busy || recovering || !data.aiReady || data.usage.analysis.remaining === 0
                }
              >
                {busy ? "페이지를 읽고 질문을 준비하고 있습니다…" : "내 프로젝트 질문 받기"}
                <ArrowRight size={17} />
              </button>
              <p className="project-help">
                새 분석 1회가 사용됩니다. AI 호출 후 응답을 받지 못한 경우에도 횟수가 차감될 수
                있습니다. 한도는 기존 코딩 문제 생성과 별개입니다.
              </p>
              {busy && <RequestStatus label="프로젝트 질문을 준비하고 있습니다" />}
            </form>
          ) : (
            <>
              <section className="project-panel project-summary">
                <span className="eyebrow">내 프로젝트 이해도 점검</span>
                <h2 ref={resultHeading} tabIndex={-1}>
                  {check.analysis.title}
                </h2>
                <a href={check.page.url} target="_blank" rel="noreferrer">
                  {new URL(check.page.url).hostname}
                  <ExternalLink size={14} />
                </a>
                <p>{check.analysis.summary}</p>
                <p className="project-help">
                  {dateLabel(check.page.fetchedAt)}에 공개 페이지 한 곳의 정보를 읽었습니다.{" "}
                  {check.page.source === "metadata"
                    ? "화면 본문을 충분히 읽지 못해 사이트에 등록된 공개 소개 정보를 참고했습니다. 자바스크립트 실행 후 나타나는 화면은 확인하지 않았습니다. "
                    : check.page.limited
                      ? "화면 정보가 적어 작성한 설명을 주로 참고했습니다. "
                      : ""}
                  로그인 후 화면, 소스 코드와 실제 서버 구성은 확인하지 않았습니다.
                </p>
                <button className="text-button" disabled={busy || recovering} onClick={remove}>
                  이 점검 기록 삭제
                </button>
              </section>
              <ProjectQuestions
                key={check.id}
                check={check}
                scope={data.scope}
                enabled={data.aiReady && data.usage.review.remaining > 0}
                onReviewed={async (review) => {
                  history.updateDetail({ ...check, review });
                  onChange((current) => ({
                    ...current,
                    checks: current.checks.map((c) => (c.id === check.id ? { ...c, review } : c)),
                  }));
                  await refreshUsage();
                }}
              />
              {check.review && (
                <ProjectLearning key={`training:${check.id}`} id={check.id} scope={data.scope} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
