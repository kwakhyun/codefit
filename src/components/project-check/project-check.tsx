"use client";
import { GuestLogin } from "@/components/account/guest-login";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Globe2, RefreshCw, ShieldCheck } from "lucide-react";
import { api, dateLabel, errorMessage } from "@/lib/client-api";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import { ProjectQuestions } from "./project-questions";
export function ProjectCheckApp() {
  const [data, setData] = useState<CheckOverview>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const refreshAccount = () => {
      setChecking(true);
      setRefresh((n) => n + 1);
    };
    window.addEventListener("focus", refreshAccount);
    return () => window.removeEventListener("focus", refreshAccount);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api<CheckOverview>("/api/project-check", { signal: controller.signal })
      .then((value) => {
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
              onChange={(value) =>
                setData((current) => (current?.scope === value.scope ? value : current))
              }
            />
          ) : (
            <section className="project-panel project-signin">
              <ShieldCheck size={32} />
              <h2>내 프로젝트로 질문을 받아보세요</h2>
              <p>
                가입하면 24시간에 2개의 프로젝트를 분석할 수 있습니다. 질문과 평가 기록은 본인만 볼
                수 있습니다.
              </p>
              <GuestLogin returnTo="/project-check" />
              <Link href="/learn">로그인 없이 서비스 원리 배우기 →</Link>
            </section>
          )}
        </div>
      )}
    </>
  );
}
function MemberWorkspace({
  data,
  onChange,
}: {
  data: CheckOverview;
  onChange: (data: CheckOverview) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ payload: string; id: string } | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const check = data.checks.find((c) => c.id === selected);
  useEffect(() => {
    if (selected) resultHeading.current?.focus();
  }, [selected]);
  async function reload() {
    const result = await api<CheckOverview>("/api/project-check", { scope: data.scope });
    onChange(result);
  }
  async function create(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const payload = JSON.stringify([url.trim(), description.trim()]);
    if (request.current?.payload !== payload)
      request.current = { payload, id: crypto.randomUUID() };
    try {
      const result = await api<Check>("/api/project-check", {
        method: "POST",
        scope: data.scope,
        body: { requestId: request.current!.id, url, description, consent },
      });
      onChange({ ...data, checks: [result, ...data.checks.filter((c) => c.id !== result.id)] });
      setSelected(result.id);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
      await reload().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!check || !window.confirm("이 프로젝트의 질문과 평가 기록을 삭제할까요?")) return;
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
      } catch {}
      onChange({ ...data, checks: data.checks.filter((c) => c.id !== check.id) });
      setSelected(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
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
          disabled={busy}
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
      {!data.aiReady && (
        <p role="status" className="project-panel">
          AI 연결을 준비 중입니다. 저장된 질문과 평가 기록은 계속 볼 수 있습니다.
        </p>
      )}
      <div className="project-layout">
        <aside className="project-history" aria-label="내 프로젝트 점검 기록">
          <button className="secondary-button" disabled={busy} onClick={() => setSelected(null)}>
            + 새 프로젝트 점검
          </button>
          <h2>
            최근 점검 <small>(최대 20개)</small>
          </h2>
          {data.checks.length === 0 ? (
            <p>첫 분석을 마치면 여기에 기록이 쌓입니다.</p>
          ) : (
            data.checks.map((c) => (
              <button
                key={c.id}
                aria-pressed={selected === c.id}
                disabled={busy}
                onClick={() => setSelected(c.id)}
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
        </aside>
        <div className="project-main">
          {!check ? (
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
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://my-service.com"
                disabled={busy}
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
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
                placeholder="어떤 문제를 해결하나요? 주요 기능, 사용한 도구, 직접 결정한 설계가 있다면 알려주세요."
              />
              <p className="project-help">
                화면에서 알 수 없는 구현을 설명하면 더 구체적인 질문을 받을 수 있습니다. 비밀키와
                사용자 데이터는 입력하지 마세요.
              </p>
              <label className="project-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                  disabled={busy}
                />
                <span>
                  내가 만든 서비스이며, 공개 페이지 내용과 작성한 설명·답변을 OpenAI에 전송해
                  분석하는 데 동의합니다.
                </span>
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={busy || !data.aiReady || data.usage.analysis.remaining === 0}
              >
                {busy ? "페이지를 읽고 질문을 준비하고 있습니다…" : "내 프로젝트 질문 받기"}
                <ArrowRight size={17} />
              </button>
              <p className="project-help">
                새 분석 1회가 사용됩니다. AI 호출 후 응답을 받지 못한 경우에도 횟수가 차감될 수
                있습니다. 한도는 기존 코딩 문제 생성과 별개입니다.
              </p>
              {busy && (
                <p role="status">
                  보통 1분 안팎이 걸릴 수 있습니다. 화면을 닫았다면 최근 점검에서 결과를 확인하세요.
                </p>
              )}
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
                  {dateLabel(check.page.fetchedAt)}에 공개 페이지 한 곳의 텍스트를 읽었습니다.{" "}
                  {check.page.limited ? "화면 정보가 적어 작성한 설명을 주로 참고했습니다. " : ""}
                  로그인 후 화면, 소스 코드와 실제 서버 구성은 확인하지 않았습니다.
                </p>
                <button className="text-button" disabled={busy} onClick={remove}>
                  이 점검 기록 삭제
                </button>
              </section>
              <ProjectQuestions
                key={check.id}
                check={check}
                scope={data.scope}
                enabled={data.aiReady && data.usage.review.remaining > 0}
                onReviewed={async (review) => {
                  onChange({
                    ...data,
                    checks: data.checks.map((c) => (c.id === check.id ? { ...c, review } : c)),
                  });
                  await reload();
                }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
