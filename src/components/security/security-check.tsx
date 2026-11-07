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
import { useEffect, useId, useRef, useState } from "react";
import { AppLink as Link } from "@/components/ui/primitives";
import { SecurityAudit } from "./security-audit";
import { api, dateLabel, errorMessage } from "@/lib/client-api";
import { SECURITY_HISTORY_LIMIT, useSecurityDraft } from "@/hooks/use-security-draft";
import { AllowanceCost } from "@/components/project-check/allowance-cost";
import { ExportButtons } from "@/components/project-check/export-buttons";
import type { ZapFinding } from "@/lib/zap-report";
import {
  compareSecurityReports,
  securityExercises,
  securityNotesMarkdown,
  securityNotesText,
  securityOrigin,
  securityReportRoute,
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
        // The guide status endpoint only resolves the session; the workspace read model is heavy.
        const value = await api<{ scope: string }>("/api/guide", {
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
  const history = draft.history ?? [];
  const [filter, setFilter] = useState<"all" | "observed" | "review" | "unknown">("all");
  const fade = useFadeTransition<HTMLElement>(`${filter}:${report?.checkedAt || "empty"}`);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<{
    window: string;
    limit: number;
    remaining: number;
    resetsAt: string | null;
  }>();
  // A ZAP import stays when the address changes; its own origin is shown with it.
  const [zap, setZap] = useState<{ origin: string; findings: ZapFinding[] } | null>(null);
  const costId = useId();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function loadUsage() {
    api<NonNullable<typeof usage>>("/api/security-check", { scope, track: false })
      .then((value) => {
        if (typeof value?.remaining === "number" && typeof value.limit === "number")
          setUsage(value);
      })
      .catch(() => {});
  }
  useEffect(loadUsage, [scope]);
  const checkedInput = draft.checkedInput ?? report?.url ?? "";
  const stale = !!report && checkedInput.trim() !== url.trim();
  const previous = report
    ? history.find(
        (item) =>
          securityOrigin(item.report.url) === securityOrigin(report.url) &&
          item.report.checkedAt !== report.checkedAt,
      )
    : undefined;
  const diff = report && previous ? compareSecurityReports(previous.report, report) : null;
  /** Shows a kept result; the current one goes back to the history so nothing is lost. */
  function showResult(index: number) {
    saveDraft((value) => {
      const kept = value.history ?? [];
      const chosen = kept[index];
      if (!chosen) return value;
      const rest = kept.filter((_, i) => i !== index);
      return {
        ...value,
        report: chosen.report,
        checkedInput: chosen.input,
        history: value.report
          ? [
              { input: value.checkedInput ?? value.report.url, report: value.report },
              ...rest,
            ].slice(0, SECURITY_HISTORY_LIMIT)
          : rest,
      };
    });
    setFilter("all");
  }
  const exhausted = !!usage && usage.remaining < 1;
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
          const input = url.trim();
          try {
            const result = await api<SecurityReport>("/api/security-check", {
              method: "POST",
              scope,
              body: { url: input, authorized },
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
            });
            if (!controller.signal.aborted)
              // The previous result moves into this tab's history for comparison.
              saveDraft((value) => ({
                ...value,
                report: result,
                checkedInput: input,
                history: value.report
                  ? [
                      { input: value.checkedInput ?? value.report.url, report: value.report },
                      ...(value.history ?? []),
                    ].slice(0, SECURITY_HISTORY_LIMIT)
                  : (value.history ?? []),
              }));
          } catch (e) {
            if (!controller.signal.aborted) setError(errorMessage(e));
          } finally {
            request.current = null;
            setBusy(false);
            loadUsage();
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
            saveDraft((value) => ({ ...value, url: e.target.value }));
          }}
          required
          maxLength={2000}
          disabled={busy}
          aria-describedby="security-scope"
        />
        <p id="security-scope">
          로그인 없이 이용할 수 있습니다. 주소에 토큰과 개인정보를 넣지 마세요.
          {usage
            ? ` ${usage.window} 기준 ${usage.limit}회까지 점검할 수 있으며, 요청이 많으면 더 제한될 수 있습니다.`
            : ""}
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
        {usage && (
          <AllowanceCost
            id={costId}
            label="점검 횟수"
            cost={1}
            remaining={usage.remaining}
            resetsAt={usage.resetsAt}
          />
        )}
        <Button
          className="primary-button"
          disabled={!authorized || busy || !url.trim() || exhausted}
          aria-describedby={usage ? costId : undefined}
        >
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
          {stale && (
            <p className="security-stale-notice">
              <strong>이전 주소 기준 결과입니다.</strong> 아래 결과는 {checkedInput}을(를) 점검한
              것입니다. 지금 입력한 주소는 아직 점검하지 않았습니다.
            </p>
          )}
          <div className="section-heading">
            <div>
              <h2>관찰한 설정과 다음 행동</h2>
              <p>{report.url}</p>
              {securityReportRoute(report).map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>{new Date(report.checkedAt).toLocaleString("ko-KR")} 기준</p>
            </div>
          </div>
          {diff && previous && (
            <Disclosure className="security-compare" open>
              <DisclosureSummary>
                같은 주소의 이전 점검과 비교 ({dateLabel(previous.report.checkedAt)} →{" "}
                {dateLabel(report.checkedAt)})
              </DisclosureSummary>
              {diff.changed.length ? (
                <ul>
                  {diff.changed.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>: {securityStatus[item.before]} →{" "}
                      {securityStatus[item.after]}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>상태가 바뀐 항목이 없습니다.</p>
              )}
              {!!diff.added.length && (
                <p>새로 관찰한 항목: {diff.added.map((item) => item.title).join(", ")}</p>
              )}
              {!!diff.removed.length && (
                <p>
                  이번에 나타나지 않은 항목: {diff.removed.map((item) => item.title).join(", ")}
                </p>
              )}
              <p className="project-help">
                같은 상태로 남은 항목 {diff.unchanged}개. 응답 헤더의 차이이며 취약점의 해결이나
                발생을 확정하지 않습니다.
              </p>
            </Disclosure>
          )}
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
      {history.length > 0 && (
        <section className="security-history" aria-labelledby="security-history-title">
          <h2 id="security-history-title">이 탭의 최근 점검 결과</h2>
          <p className="project-help">
            최근 {SECURITY_HISTORY_LIMIT}개까지 현재 탭에 보관합니다. 결과를 열면 지금 결과와 자리를
            바꿉니다.
          </p>
          <ul>
            {history.map((item, index) => (
              <li key={`${item.report.checkedAt}:${index}`}>
                <span>
                  <strong>{securityOrigin(item.report.url) || item.report.url}</strong>{" "}
                  {dateLabel(item.report.checkedAt)} · 보완 검토{" "}
                  {item.report.findings.filter((f) => f.status === "review").length}개
                </span>
                <Button className="text-button" disabled={busy} onClick={() => showResult(index)}>
                  이 결과 보기
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SecurityAudit key={securityOrigin(url)} scope={scope} url={url} zap={zap} onZap={setZap} />
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
          <ExportButtons
            label="확인 기록 파일로 저장"
            fileName="codefit-security-check"
            markdown={() => securityNotesMarkdown(notes, url, report)}
            text={() => securityNotesText(notes, url, report)}
            note="주소, 지금 보이는 점검 결과와 AI 수정 요청, 작성 중인 메모(서버에 저장되지 않는 초안)를 함께 저장합니다."
          />
          <Button
            className="text-button"
            disabled={busy}
            onClick={async (event) => {
              event.currentTarget.focus();
              if (
                await confirm("이 탭에 보관한 보안 점검 기록을 모두 지웁니다.", {
                  title: "임시 기록 지우기",
                  confirmLabel: "모두 지우기",
                  details: [
                    "입력한 주소",
                    `점검 결과 ${(report ? 1 : 0) + history.length}개`,
                    "확인 메모",
                  ],
                })
              ) {
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
