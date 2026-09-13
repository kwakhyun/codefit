"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Check, CheckCircle2, ChevronRight, Clock3, Code2, Copy, FileText, History, Lightbulb, LoaderCircle, Maximize2, Minimize2, RotateCcw, Save, Sparkles, Terminal, AlertCircle, Eye } from "lucide-react";
import { domainLabel, LANGUAGES } from "@/lib/catalog";
import { api, errorMessage, dateLabel } from "@/lib/client-api";
import type { Attempt, Progress, PublicProblem } from "@/lib/problem";
import { DifficultyBadge, KindBadge, Modal } from "./ui";
const CodeEditor = dynamic(() => import("@/components/code-editor").then(m => m.CodeEditor), { ssr: false, loading: () => <div className="editor-loading"><span className="blink">▋</span> 코드 편집기 준비 중…</div> });
type Detail = { problem: PublicProblem; progress: Progress | null; hints: string[]; solution: { code: string; explanation: string } | null; attempts: Attempt[] };
type Tab = "problem" | "hints" | "solution" | "history";
export function ProblemWorkspace({ id, onProgress, fontSize, focus, setFocus, aiReady }: { id: string; onProgress: (p: Progress, attempt?: Attempt) => void; fontSize: number; focus: boolean; setFocus: (value: boolean) => void; aiReady: boolean }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<Tab>("problem");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "local" | "failed">("saved");
  const [busy, setBusy] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [confirm, setConfirm] = useState<"solution" | "reset" | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);
  const reviewRequest = useRef<{ code: string; id: string } | null>(null);
  const changeVersion = useRef(0);
  const mounted = useRef(true);
  const latest = useRef({ code: "", dirty: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const load = useCallback(async () => {
    try {
      const next = await api<Detail>(`/api/problems/${encodeURIComponent(id)}`);
      if (!mounted.current) return;
      setLoadError("");
      let draft = next.progress?.code ?? next.problem.starterCode;
      let localNewer = false;
      try {
        const local = JSON.parse(localStorage.getItem(`recode-draft:${id}`) || "null");
        if (local && typeof local.code === "string" && local.code.length <= 30000 && local.at > Date.parse(next.progress?.updatedAt || "1970-01-01")) { draft = local.code; localNewer = draft !== next.progress?.code; }
      } catch { /* Server remains the source of truth when browser storage is unavailable. */ }
      latest.current = { code: draft, dirty: localNewer };
      setCode(draft); setDetail(next); setSelectedAttempt(next.attempts[0] || null); setSaveState(localNewer ? "local" : "saved");
    } catch (e) { if (mounted.current) setLoadError(errorMessage(e)); }
    finally { if (mounted.current) setLoading(false); }
  }, [id]);
  const save = useCallback((value: string, version: number) => {
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (mounted.current) setSaveState("saving");
      try {
        const response = await api<{ progress: Progress }>(`/api/progress/${encodeURIComponent(id)}`, { method: "PUT", body: { code: value }, keepalive: new TextEncoder().encode(value).length < 45000 });
        if (!mounted.current) return;
        if (version === changeVersion.current) { latest.current.dirty = false; setSaveState("saved"); }
        onProgress(response.progress);
      } catch { if (mounted.current) setSaveState("failed"); }
    });
    return queue.current;
  }, [id, onProgress]);
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(load);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (latest.current.dirty) void save(latest.current.code, changeVersion.current);
    };
  }, [load, save]);
  useEffect(() => {
    const flush = () => { if (latest.current.dirty) { if (timer.current) clearTimeout(timer.current); void save(latest.current.code, changeVersion.current); } };
    const hide = () => { if (document.visibilityState === "hidden") flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (latest.current.dirty) { flush(); event.preventDefault(); } };
    window.addEventListener("online", flush); document.addEventListener("visibilitychange", hide); window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("online", flush); document.removeEventListener("visibilitychange", hide); window.removeEventListener("beforeunload", beforeUnload); };
  }, [save]);
  function changeCode(value: string) {
    if (value.length > 30000) { setError("코드는 30,000자까지 작성할 수 있습니다."); return; }
    setCode(value); latest.current = { code: value, dirty: true }; changeVersion.current += 1;
    setSaveState("local");
    try { localStorage.setItem(`recode-draft:${id}`, JSON.stringify({ code: value, at: Date.now() })); } catch { setSaveState("failed"); }
    if (timer.current) clearTimeout(timer.current);
    const version = changeVersion.current;
    timer.current = setTimeout(() => { void save(value, version); }, 700);
  }
  async function review(value: string) {
    if (pending.current || value.trim().length < 5 || !aiReady) return;
    pending.current = true; setBusy(true); setError("");
    try {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current.dirty) await save(value, changeVersion.current);
      if (reviewRequest.current?.code !== value) reviewRequest.current = { code: value, id: crypto.randomUUID() };
      const result = await api<{ attempt: Attempt; progress: Progress }>(`/api/problems/${encodeURIComponent(id)}/review`, { method: "POST", body: { code: value, requestId: reviewRequest.current.id } });
      if (!mounted.current) return;
      reviewRequest.current = null;
      setSelectedAttempt(result.attempt);
      setDetail(prev => prev ? { ...prev, progress: result.progress, attempts: [result.attempt, ...prev.attempts] } : prev);
      onProgress(result.progress, result.attempt);
    } catch (e) { if (mounted.current) setError(errorMessage(e)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function reveal(kind: "hint" | "solution") {
    if (revealing) return;
    setRevealing(true); setError(""); setConfirm(null);
    try {
      const result = await api<Pick<Detail, "hints" | "solution"> & { progress: Progress }>(`/api/problems/${encodeURIComponent(id)}/reveal`, { method: "POST", body: { kind } });
      setDetail(prev => prev ? { ...prev, ...result } : prev); onProgress(result.progress); setTab(kind === "hint" ? "hints" : "solution");
    } catch (e) { setError(errorMessage(e)); }
    finally { setRevealing(false); }
  }
  async function bookmark() {
    if (!detail) return;
    try {
      const { progress } = await api<{ progress: Progress }>(`/api/progress/${encodeURIComponent(id)}`, { method: "PUT", body: { bookmarked: !detail.progress?.bookmarked } });
      setDetail({ ...detail, progress }); onProgress(progress);
    } catch (e) { setError(errorMessage(e)); }
  }
  if (loading) return <div className="content-loader" role="status"><LoaderCircle className="spin" size={25} /><p>문제와 저장된 풀이를 불러오는 중</p></div>;
  if (loadError || !detail) return <div className="empty-state"><AlertCircle size={32} /><h2>문제를 불러오지 못했습니다.</h2><p>{loadError}</p><button className="secondary-button" onClick={() => { setLoading(true); setLoadError(""); void load(); }}>다시 시도</button><Link href="/">문제 보관함으로</Link></div>;
  const { problem, hints, solution, attempts, progress } = detail;
  return <div className={`workspace ${focus ? "is-focused" : ""}`}>
    <div className="workspace-breadcrumb"><Link href="/"><ArrowLeft size={15} /> 문제 보관함</Link><ChevronRight size={13} /><span>{domainLabel(problem.domain)}</span><span className="workspace-id mono">{problem.id.startsWith("ai-") ? "AI CHALLENGE" : "CURATED CHALLENGE"}</span></div>
    <div className="workspace-heading"><div><div className="problem-meta"><DifficultyBadge level={problem.difficulty} /><KindBadge kind={problem.kind} /><span>{LANGUAGES[problem.language].label}</span><span><Clock3 size={13} /> 약 {problem.minutes}분</span></div><h1>{problem.title}</h1></div><div className="workspace-heading-actions"><button className={`icon-button ${progress?.bookmarked ? "active" : ""}`} aria-label={progress?.bookmarked ? "북마크 해제" : "북마크"} onClick={bookmark}><Bookmark size={20} fill={progress?.bookmarked ? "currentColor" : "none"} /></button><button className="icon-button" aria-label={focus ? "집중 모드 종료" : "집중 모드"} onClick={() => setFocus(!focus)}>{focus ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button></div></div>
    <div className="workbench">
      <section className="problem-pane" aria-label="문제 설명">
        <div className="problem-tabs" role="tablist" aria-label="문제 자료" onKeyDown={event => { const tabs: Tab[] = ["problem", "hints", "solution", "history"]; const index = tabs.indexOf(tab); const next = event.key === "ArrowRight" ? tabs[(index + 1) % 4] : event.key === "ArrowLeft" ? tabs[(index + 3) % 4] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[3] : null; if (next) { event.preventDefault(); setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}>{([{ id: "problem", label: "문제", Icon: FileText }, { id: "hints", label: "힌트", Icon: Lightbulb }, { id: "solution", label: "정답", Icon: Code2 }, { id: "history", label: "기록", Icon: History }] as const).map(t => <button key={t.id} id={`tab-${t.id}`} role="tab" tabIndex={tab === t.id ? 0 : -1} aria-selected={tab === t.id} aria-controls="problem-tab-panel" onClick={() => setTab(t.id)}><t.Icon size={15} />{t.label}{t.id === "hints" && <small>{hints.length}/3</small>}{t.id === "history" && attempts.length > 0 && <small>{attempts.length}</small>}</button>)}</div>
        <div className="problem-content" role="tabpanel" id="problem-tab-panel" aria-labelledby={`tab-${tab}`}>
          {tab === "problem" && <><div className="section-marker">01 <span>상황</span></div><p className="scenario">{problem.scenario}</p><div className="section-marker">02 <span>구현 요구사항</span></div><ol className="requirements">{problem.requirements.map((r, i) => <li key={r}><span>{String(i + 1).padStart(2, "0")}</span><p>{r}</p></li>)}</ol><div className="section-marker">03 <span>입출력 예시</span></div>{problem.examples.map((example, i) => <div className="example-box" key={i}><div><span>INPUT</span><code>{example.input}</code></div><div><span>EXPECTED</span><code>{example.output}</code></div><p>{example.note}</p></div>)}<div className="problem-tags">{problem.tags.map(tag => <span key={tag}># {tag}</span>)}</div><div className="help-nudge"><Lightbulb size={17} /><span>막히는 부분이 있다면 힌트를 한 단계씩 열어 보세요.</span><button onClick={() => setTab("hints")} aria-label="힌트 탭 열기"><ArrowRight size={16} /></button></div></>}
          {tab === "hints" && <><span className="eyebrow">A LITTLE NUDGE</span><h2>생각의 실마리가 필요할 때</h2><p className="muted">힌트는 한 단계씩 구체적인 방향을 알려 줍니다. 사용 기록은 풀이와 함께 저장됩니다.</p><div className="hints-list">{[0,1,2].map(i => <div className={`hint-card ${hints[i] ? "revealed" : "locked"}`} key={i}><div><span className="mono">HINT 0{i + 1}</span>{hints[i] ? <Check size={15} /> : <span>{["접근 방향", "핵심 개념", "구현 방법"][i]}</span>}</div>{hints[i] ? <p>{hints[i]}</p> : <p>{i === hints.length ? "준비되면 다음 힌트를 열어 보세요." : "이전 힌트를 먼저 확인해 주세요."}</p>}</div>)}</div><button className="secondary-button full-width" disabled={revealing || hints.length >= 3} onClick={() => reveal("hint")}>{revealing ? <LoaderCircle className="spin" size={16} /> : <Lightbulb size={16} />}{hints.length >= 3 ? "모든 힌트를 확인했습니다" : `힌트 ${hints.length + 1} 보기`}</button></>}
          {tab === "solution" && <>{!solution ? <div className="solution-locked"><div className="terminal-icon"><Eye size={28} /></div><h2>다른 풀이와 비교해 보세요.</h2><p>정답 코드와 해설을 확인할 수 있습니다.<br />먼저 직접 풀어 본 뒤 비교하면 더 많이 배울 수 있어요.</p><button className="secondary-button" onClick={() => setConfirm("solution")} disabled={revealing}>{revealing ? <LoaderCircle className="spin" size={16} /> : <Eye size={16} />}정답 보기</button><small>정답을 본 기록이 남으며 자동으로 완료 처리되지 않습니다.</small></div> : <><div className="solution-title"><span className="eyebrow">REFERENCE SOLUTION</span><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(solution.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError("클립보드를 사용할 수 없습니다. 코드를 선택해 복사해 주세요."); } }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "복사됨" : "복사"}</button></div><h2>참고 정답</h2><p className="muted">같은 요구사항을 만족하는 다른 구현도 올바른 풀이입니다.</p><pre className="solution-code"><code>{solution.code}</code></pre><div className="section-marker">WHY <span>이렇게 풀었어요</span></div><p className="scenario">{solution.explanation}</p></> }</>}
          {tab === "history" && <><span className="eyebrow">SUBMISSION HISTORY</span><h2>생각이 코드가 된 기록</h2>{attempts.length === 0 ? <div className="tab-empty"><History size={30} /><p>아직 검토한 풀이가 없습니다.</p><small>코드를 작성하고 AI 풀이 검토를 눌러 보세요.</small></div> : <div className="attempts-list">{attempts.map((a, i) => <button key={a.id} className={selectedAttempt?.id === a.id ? "selected" : ""} onClick={() => setSelectedAttempt(a)}><span><strong>시도 #{attempts.length - i}</strong><small>{dateLabel(a.createdAt)}{a.assisted ? " · 도움 사용" : " · 직접 풀이"}</small></span><span className={a.review.passed ? "success-text" : "muted"}>{a.review.score}%<ChevronRight size={15} /></span></button>)}</div>}</>}
        </div>
      </section>
      <section className="editor-pane" aria-label="풀이 작업 공간">
        <div className="editor-topbar"><span><span className="status-dot" /> CODE WORKSPACE</span><div><span className={`save-indicator ${saveState === "failed" ? "failed" : ""}`} role="status">{saveState === "saving" ? <LoaderCircle size={12} className="spin" /> : saveState === "saved" ? <Check size={12} /> : <Save size={12} />}{({ saved: "저장됨", saving: "저장 중", local: "저장 대기", failed: "저장 실패" })[saveState]}</span>{(saveState === "failed" || saveState === "local") && <button className="text-button" onClick={() => save(code, changeVersion.current)}>지금 저장</button>}<button className="icon-button" aria-label="시작 코드로 초기화" onClick={() => setConfirm("reset")} disabled={busy}><RotateCcw size={14} /></button></div></div>
        <CodeEditor value={code} language={problem.language} problemId={id} onChange={changeCode} onCheck={review} fontSize={fontSize} />
        <div className="review-action"><span><kbd>⌘ / Ctrl</kbd> + <kbd>Enter</kbd><small>AI가 요구사항을 검토합니다.</small></span><button className="primary-button" onClick={() => review(code)} disabled={busy || code.trim().length < 5 || !aiReady}>{busy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{busy ? "풀이 검토 중" : "AI 풀이 검토"}{!busy && <ArrowRight size={16} />}</button></div>
        {!aiReady && <p className="inline-warning">AI 연결 설정 후 풀이 검토를 사용할 수 있습니다. 코드 작성과 저장은 가능합니다.</p>}
        {error && <p className="inline-error workspace-error" role="alert"><AlertCircle size={16} />{error}<button aria-label="오류 메시지 닫기" onClick={() => setError("")}>×</button></p>}
        <section className="review-console" aria-label="AI 검토 결과" aria-live="polite"><div className="console-heading"><Terminal size={14} /><strong>검토 결과</strong><span>AI 코드 리뷰 · 실행 검증 아님</span></div>
          {busy ? <div className="console-idle"><span className="mono success-text">$ review --requirements</span><p><LoaderCircle size={15} className="spin" />요구사항과 경계 조건을 하나씩 살펴보고 있습니다.</p><small>검토 중에도 코드를 수정할 수 있습니다. 제출 시점의 코드로 검토합니다.</small></div> : selectedAttempt ? <div className="review-result"><div className="review-result-title"><span className={selectedAttempt.review.passed ? "success-text" : "warning-text"}>{selectedAttempt.review.passed ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}<strong>{selectedAttempt.review.passed ? "모든 요구사항을 충족했습니다." : "조금 더 다듬어 볼까요?"}</strong></span><b>{selectedAttempt.review.score}<small>%</small></b></div><p>{selectedAttempt.review.summary}</p>{selectedAttempt.code !== code && <p className="review-stale"><History size={14} /> 현재 코드와 다른 제출본의 검토 결과입니다.</p>}<ul className="review-criteria">{selectedAttempt.review.criteria.map(c => <li key={c.requirementIndex}>{c.passed ? <CheckCircle2 className="success-text" size={16} /> : <AlertCircle className="warning-text" size={16} />}<div><strong>요구사항 {c.requirementIndex + 1}</strong><p>{c.feedback}</p></div></li>)}</ul>{selectedAttempt.review.improvements.length > 0 && <div className="review-improvements"><strong>다음 시도에서</strong><ul>{selectedAttempt.review.improvements.map(t => <li key={t}>{t}</li>)}</ul></div>}<details className="submitted-code"><summary>제출했던 코드 보기 <span>{dateLabel(selectedAttempt.createdAt)}</span></summary><pre><code>{selectedAttempt.code}</code></pre></details></div> : <div className="console-idle"><span className="mono"><span className="success-text">❯</span> 준비되었습니다.<span className="blink">_</span></span><p>코드를 작성한 뒤 검토를 요청해 보세요.</p><small>문자열 일치가 아닌 요구사항 충족 여부를 확인합니다.</small></div>}
        </section>
      </section>
    </div>
    <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "solution" ? "VIEW SOLUTION" : "RESET CODE"} className="confirm-modal"><div className="confirm-content"><h2>{confirm === "solution" ? "참고 정답을 열까요?" : "시작 코드로 돌아갈까요?"}</h2><p>{confirm === "solution" ? "작성한 코드는 유지됩니다. 정답을 본 이력이 풀이 기록에 남습니다." : "현재 작성 중인 코드는 시작 코드로 바뀝니다. 이전에 제출한 풀이와 검토 기록은 유지됩니다."}</p><div className="modal-buttons"><button className="secondary-button" onClick={() => setConfirm(null)}>계속 풀기</button><button className="primary-button" onClick={() => { if (confirm === "solution") void reveal("solution"); else { changeCode(problem.starterCode); setConfirm(null); } }}>{confirm === "solution" ? "정답 열기" : "시작 코드로 초기화"}</button></div></div></Modal>
  </div>;
}
