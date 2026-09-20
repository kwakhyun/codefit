"use client";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { useFadeTransition } from "@/components/ui/use-fade-transition";
import { useConfirmation } from "@/components/ui/use-confirmation";
import {
  Status,
  Button,
  FieldLabel,
  Input,
  ToggleButton,
  Progress,
  Disclosure,
  DisclosureSummary,
  Textarea,
} from "@/components/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { AppLink as Link } from "@/components/ui/primitives";
import { SecurityAudit } from "./security-audit";
import { api, errorMessage } from "@/lib/client-api";
import { useSecurityDraft } from "@/hooks/use-security-draft";
import {
  securityExercises,
  securityNotesText,
  securityStatus,
  type SecurityReport,
} from "@/lib/security-check";
export function SecurityCheck() {
  const [scope, setScope] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let revision = 0;
    async function sync() {
      const current = ++revision;
      setChecking(true);
      setError("");
      try {
        const value = await api<{ scope: string }>("/api/workspace", {
          scope: null,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (controller.signal.aborted || revision !== current) return;
        setScope(value.scope);
      } catch (e) {
        if (controller.signal.aborted || revision !== current) return;
        setError(errorMessage(e));
      }
      setChecking(false);
    }
    void sync();
    const visible = () => {
      if (!document.hidden) void sync();
    };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [retry]);
  return (
    <>
      {checking && (
        <ScreenSkeleton variant="form" label="현재 계정의 임시 기록을 확인하고 있습니다…" />
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button className="secondary-button" onClick={() => setRetry((n) => n + 1)}>
            기록 다시 불러오기
          </Button>
        </div>
      )}
      {scope && (
        <div hidden={checking || !!error}>
          <SecurityWorkspace key={scope} scope={scope} />
        </div>
      )}
    </>
  );
}

function SecurityWorkspace({ scope }: { scope: string }) {
  const { confirm, confirmation } = useConfirmation();
  const { draft, saveDraft, storageError, clear } = useSecurityDraft(scope);
  const { url, report, notes } = draft;
  const [filter, setFilter] = useState<"all" | "observed" | "review" | "unknown">("all");
  const fade = useFadeTransition<HTMLElement>(`${filter}:${report?.checkedAt || "empty"}`);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function download() {
    const objectUrl = URL.createObjectURL(
      new Blob([securityNotesText(notes, url, report)], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "codefit-security-check.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  return (
    <div className="security-workspace">
      {confirmation}
      <form
        className="security-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (request.current) return;
          const controller = new AbortController();
          request.current = controller;
          setBusy(true);
          setFilter("all");
          setError("");
          saveDraft((value) => ({ ...value, report: null }));
          try {
            const result = await api<SecurityReport>("/api/security-check", {
              method: "POST",
              scope,
              body: { url: url.trim(), authorized },
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
            });
            if (!controller.signal.aborted) saveDraft((value) => ({ ...value, report: result }));
          } catch (e) {
            if (!controller.signal.aborted) setError(errorMessage(e));
          } finally {
            request.current = null;
            setBusy(false);
          }
        }}
      >
        <FieldLabel htmlFor="security-url">점검할 공개 서비스 링크</FieldLabel>
        <Input
          id="security-url"
          type="url"
          placeholder="https://my-service.com/"
          value={url}
          onChange={(e) => {
            saveDraft((value) => ({ ...value, url: e.target.value, report: null }));
          }}
          required
          maxLength={2000}
          disabled={busy}
          aria-describedby="security-scope"
        />
        <p id="security-scope">
          로그인 없이 이용할 수 있습니다. 주소에 토큰과 개인정보를 넣지 마세요. 한 시간에 최대
          5회이며 요청이 많으면 더 제한될 수 있습니다.
        </p>
        <FieldLabel className="security-consent">
          <Input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            required
            disabled={busy}
          />
          본인이 관리하거나 점검 허락을 받은 서비스입니다.
        </FieldLabel>
        <Button className="primary-button" disabled={!authorized || busy || !url.trim()}>
          {busy ? "공개 응답 확인 중… 최대 20초" : "공개 페이지 보안 점검"}
        </Button>
        {busy && <Status role="status">입력한 페이지의 응답 헤더와 HTML을 읽고 있습니다.</Status>}
        {error && (
          <Status role="alert" className="security-error">
            {error}
          </Status>
        )}
      </form>
      {report && (
        <section ref={fade} className="security-results" aria-label="보안 점검 결과">
          <div className="section-heading">
            <div>
              <h2>관찰한 설정과 다음 행동</h2>
              <p>{report.url}</p>
              <p>{new Date(report.checkedAt).toLocaleString("ko-KR")} 기준</p>
            </div>
            <Button className="secondary-button" onClick={download}>
              결과와 AI 수정 요청 저장
            </Button>
          </div>
          <Status role="status">
            설정 관찰 {report.findings.filter((f) => f.status === "observed").length}개 / 보완 검토{" "}
            {report.findings.filter((f) => f.status === "review").length}개 / 추가 확인{" "}
            {report.findings.filter((f) => f.status === "unknown").length}개
          </Status>
          <p>
            설정이 있다는 사실만으로 안전하다고 판정하지 않습니다. 보완 검토는 취약점 확정이나 공격
            성공을 의미하지 않습니다.
          </p>
          <div className="result-filter" role="group" aria-label="점검 결과 필터">
            {(["all", "review", "unknown", "observed"] as const).map((status) => (
              <ToggleButton
                type="button"
                key={status}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {status === "all" ? "전체" : securityStatus[status]}{" "}
                <span>
                  {status === "all"
                    ? report.findings.length
                    : report.findings.filter((f) => f.status === status).length}
                </span>
              </ToggleButton>
            ))}
          </div>
          <Status className="result-filter-status" role="status">
            {filter === "all" ? "전체" : securityStatus[filter]} 항목{" "}
            {report.findings.filter((f) => filter === "all" || f.status === filter).length}개 표시
          </Status>
          <div className="security-grid">
            {report.findings
              .filter((f) => filter === "all" || f.status === filter)
              .map((f) => (
                <article key={f.id} className={`security-finding security-${f.status}`}>
                  <span className="eyebrow">{securityStatus[f.status]}</span>
                  <h3>{f.title}</h3>
                  <p>{f.evidence}</p>
                  <strong>다음 행동</strong>
                  <p>{f.action}</p>
                </article>
              ))}
          </div>
        </section>
      )}
      <SecurityAudit key={url} scope={scope} url={url} />
      <section className="security-exercises">
        <h2>내 테스트 환경에서 이어가는 모의해킹 준비</h2>
        <div className="notes-progress">
          <FieldLabel htmlFor="security-notes-progress">
            확인 메모 작성 {notes.filter((note) => note.trim()).length} / {securityExercises.length}
          </FieldLabel>
          <Progress
            id="security-notes-progress"
            max={securityExercises.length}
            value={notes.filter((note) => note.trim()).length}
          />
          <small>메모 작성 현황이며, 검증 완료나 안전 판정이 아닙니다.</small>
        </div>
        <p>
          공개 링크만으로 확인하지 못한 항목입니다. 운영 데이터 대신 테스트 계정과 테스트 자료로
          확인하세요.
        </p>
        <p id="security-draft-help">
          주소, 점검 결과와 메모는 현재 탭에 계정별로 임시 보관됩니다. 관련 실습에서 돌아오거나
          새로고침해도 복원되며 다른 계정, 탭이나 기기와는 공유되지 않습니다. 영구 보관하려면 확인
          기록을 파일로 저장하세요. 비밀키, 비밀번호와 실제 사용자 정보는 적지 마세요.
        </p>
        {storageError && (
          <Status role="alert" className="security-error">
            브라우저에 임시 보관하지 못했습니다. 화면을 떠나기 전에 확인 기록을 파일로 저장하세요.
          </Status>
        )}
        <div className="security-record-actions">
          <Button className="secondary-button" onClick={download}>
            확인 기록 파일로 저장
          </Button>
          <Button
            className="text-button"
            disabled={busy}
            onClick={async (event) => {
              event.currentTarget.focus();
              if (await confirm("이 탭에 보관한 주소, 점검 결과와 메모를 모두 지울까요?")) {
                clear();
                setAuthorized(false);
                setError("");
              }
            }}
          >
            임시 기록 지우기
          </Button>
        </div>
        {securityExercises.map((item, index) => (
          <Disclosure key={item.title}>
            <DisclosureSummary>{item.title}</DisclosureSummary>
            <p>{item.steps}</p>
            <p>
              <strong>기대 결과: </strong>
              {item.expected}
            </p>
            <FieldLabel>
              내 확인 결과
              <Textarea
                placeholder="사용한 테스트 계정, 예상 결과, 실제 결과와 남은 문제를 기록하세요. 비밀번호나 실제 사용자 정보는 제외하세요."
                maxLength={2000}
                value={notes[index]}
                aria-describedby="security-draft-help"
                onChange={(event) =>
                  saveDraft((value) => ({
                    ...value,
                    notes: value.notes.map((note, i) => (i === index ? event.target.value : note)),
                  }))
                }
              />
            </FieldLabel>
            <Link href={item.href}>{item.linkLabel} →</Link>
          </Disclosure>
        ))}
      </section>
    </div>
  );
}
