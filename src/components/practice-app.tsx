"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, Upload, ArrowRight, ArrowUpRight, Bookmark, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, FolderCode, History, LayoutGrid, LoaderCircle, Menu, Search, Settings2, Sparkles, Terminal, X, CircleHelp, ShieldCheck, FileCode2, RotateCcw, AlertCircle } from "lucide-react";
import { DOMAINS, DOMAIN_IDS, LEVELS, KIND_LABELS, KINDS, LANGUAGES, domainLabel, type DomainId } from "@/lib/catalog";
import { api, ApiError, errorMessage, dateLabel } from "@/lib/client-api";
import { defaultFilters, libraryUrl, problemUrl, type LibraryFilters } from "@/lib/library-state";
import { recommendProblem, trainingSummary } from "@/lib/training";
import type { Attempt, Progress, ProblemSummary, Workspace } from "@/lib/problem";
import { DifficultyBadge, DomainIcon, KindBadge, Modal } from "./lab/ui";
import { Generator } from "./lab/generator";
import { ProblemWorkspace } from "./lab/problem-workspace";

export type LibraryView = "library" | "bookmarks" | "history";
export function PracticeApp({ initialProblemId, initialDomain = "all", initialView = "library", initialFilters = defaultFilters, returnTo = "/", initialAttemptId }: { initialProblemId?: string; initialDomain?: DomainId | "all"; initialView?: LibraryView; initialFilters?: LibraryFilters; returnTo?: string; initialAttemptId?: string }) {
  const router = useRouter();
  const [data, setData] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState("");
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [reauth, setReauth] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [search, setSearch] = useState(initialFilters.search);
  const query = useDeferredValue(search);
  const [level, setLevel] = useState(initialFilters.level);
  const [kind, setKind] = useState(initialFilters.kind);
  const [language, setLanguage] = useState(initialFilters.language);
  const [source, setSource] = useState(initialFilters.source);
  const [status, setStatus] = useState(initialFilters.status);
  const [sort, setSort] = useState(initialFilters.sort);
  const [page, setPage] = useState(initialFilters.page);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [focus, setFocus] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [toast, setToast] = useState("");
  const [toastError, setToastError] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFile = useRef<HTMLInputElement>(null);
  const [bookmarking, setBookmarking] = useState<string | null>(null);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const workspace = await api<Workspace>("/api/workspace");
      setData(workspace); setLocked(false); setLoadError("");
      try {
        const settings = Number(localStorage.getItem("recode-editor-font"));
        if (settings >= 12 && settings <= 20) setFontSize(settings);
        const legacyText = localStorage.getItem("recode-progress-v1");
        if (legacyText && !localStorage.getItem("recode-legacy-archived-v2")) {
          const legacy = JSON.parse(legacyText);
          if (Array.isArray(legacy.generatedLessons)) {
            await api("/api/workspace", { method: "POST", body: legacy });
            localStorage.setItem("recode-legacy-archived-v2", "yes");
            setData(d => d ? { ...d, legacyCount: legacy.generatedLessons.length } : d);
          }
        }
      } catch { /* Keep legacy browser data intact if archival or local storage fails. */ }
    } catch (e) { if (e instanceof ApiError && e.status === 401) setLocked(true); else setLoadError(errorMessage(e)); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const libraryHref = libraryUrl({ search, level, kind, language, source, status, sort, page }, initialDomain, initialView);
  useEffect(() => {
    if (!initialProblemId && window.location.pathname === "/" && window.location.pathname + window.location.search !== libraryHref) window.history.replaceState(null, "", libraryHref);
  }, [initialProblemId, libraryHref]);
  useEffect(() => {
    const expired = () => { if (data) { setReauth(true); setSettingsOpen(false); setHelpOpen(false); setGeneratorOpen(false); } };
    window.addEventListener("codefit:session-expired", expired);
    return () => window.removeEventListener("codefit:session-expired", expired);
  }, [data]);
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(""), 4500); return () => clearTimeout(id); } }, [toast]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.matches("input, textarea, select") || target.isContentEditable || document.querySelector("dialog[open]");
      if (event.key === "/" && !typing && !initialProblemId) { event.preventDefault(); document.getElementById("problem-search")?.focus(); }
      if (event.key === "Escape") setMobileMenu(false);
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [initialProblemId]);
  useEffect(() => {
    if (!mobileMenu) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>(".sidebar a")?.focus());
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = overflow; before?.focus(); };
  }, [mobileMenu]);
  const onProgress = useCallback((progress: Progress, attempt?: Attempt) => {
    setData(prev => prev ? { ...prev, progress: { ...prev.progress, [progress.problemId]: prev.progress[progress.problemId]?.updatedAt > progress.updatedAt ? prev.progress[progress.problemId] : progress }, attempts: attempt ? [attempt, ...prev.attempts.filter(a => a.id !== attempt.id)] : prev.attempts } : prev);
  }, []);
  async function login(e: FormEvent) {
    e.preventDefault(); setLoginBusy(true); setLoadError("");
    try { await api("/api/session", { method: "POST", body: { password } }); setPassword(""); setReauth(false); window.dispatchEvent(new Event("codefit:session-restored")); await load(); }
    catch (e) { setLoadError(errorMessage(e)); }
    finally { setLoginBusy(false); }
  }
  async function bookmark(problem: ProblemSummary) {
    if (bookmarking) return;
    setBookmarking(problem.id);
    try {
      const { progress } = await api<{ progress: Progress }>(`/api/progress/${problem.id}`, { method: "PUT", body: { bookmarked: !data?.progress[problem.id]?.bookmarked } });
      onProgress(progress);
    } catch (e) { setToastError(true); setToast(errorMessage(e)); }
    finally { setBookmarking(null); }
  }
  async function exportData() {
    setExporting(true); setSettingsNotice(null);
    try {
      const result = await api<unknown>("/api/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `codefit-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000); setToastError(false); setToast("문제와 학습 기록을 내보냈습니다."); setSettingsNotice({ text: "문제와 학습 기록을 내보냈습니다.", error: false });
    } catch (e) { const message = errorMessage(e); setToastError(true); setToast(message); setSettingsNotice({ text: message, error: true }); }
    finally { setExporting(false); }
  }
  async function importBackup(file: File) {
    setImporting(true); setSettingsNotice(null);
    try {
      if (file.size > 10_000_000) throw new Error("백업 파일은 10 MB까지 가져올 수 있습니다.");
      let body: unknown;
      try { body = JSON.parse(await file.text()); } catch { throw new Error("올바른 JSON 백업 파일이 아닙니다. 내보낸 백업 파일을 선택해 주세요."); }
      const result = await api<{ problems: number; attempts: number }>("/api/import", { method: "POST", body });
      await load();
      window.dispatchEvent(new Event("codefit:backup-imported"));
      const message = `백업을 가져왔습니다. 새 문제 ${result.problems}개, 풀이 기록 ${result.attempts}개가 추가되었습니다.`;
      setToastError(false); setToast(message); setSettingsNotice({ text: message, error: false });
    } catch (e) { const message = errorMessage(e); setToastError(true); setToast(message); setSettingsNotice({ text: message, error: true }); }
    finally { setImporting(false); if (importFile.current) importFile.current.value = ""; }
  }
  const progressList = useMemo(() => Object.values(data?.progress || {}), [data?.progress]);
  const solved = progressList.filter(p => p.status === "solved").length;
  const inProgress = progressList.filter(p => p.status === "in-progress").length;
  const saved = progressList.filter(p => p.bookmarked).length;
  const aiCount = data?.problems.filter(p => p.source === "ai").length || 0;
  const filtered = useMemo(() => {
    const list = (data?.problems || []).filter(p => {
      const progress = data?.progress[p.id];
      return (initialDomain === "all" || p.domain === initialDomain) && (level === "all" || p.difficulty === level)
        && (kind === "all" || p.kind === kind) && (language === "all" || p.language === language) && (source === "all" || p.source === source)
        && (status === "all" || (progress?.status || "new") === status) && (initialView !== "bookmarks" || progress?.bookmarked)
        && (!query.trim() || [p.title, p.summary, p.tags.join(" "), LANGUAGES[p.language].label, domainLabel(p.domain)].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
    });
    return list.sort((a,b) => sort === "easy" ? LEVELS.indexOf(a.difficulty) - LEVELS.indexOf(b.difficulty) : sort === "short" ? a.minutes - b.minutes : sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : (a.id === "fe-search-race" ? -1 : b.id === "fe-search-race" ? 1 : a.source !== b.source ? (a.source === "ai" ? -1 : 1) : a.createdAt.localeCompare(b.createdAt)));
  }, [data, initialDomain, initialView, kind, language, level, query, sort, source, status]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)));
  const pageProblems = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  const hasFilters = Boolean(search || level !== "all" || kind !== "all" || language !== "all" || source !== "all" || status !== "all" || sort !== "recommended");
  const activeProblem = data?.problems.find(p => p.id === initialProblemId);
  const resume = progressList.filter(p => p.status === "in-progress").sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const recommended = data ? recommendProblem(data.problems, data.progress) : undefined;
  const training = useMemo(() => trainingSummary(data?.attempts || []), [data?.attempts]);
  const title = initialView === "bookmarks" ? "북마크" : initialView === "history" ? "학습 기록" : initialDomain === "all" ? "문제 보관함" : domainLabel(initialDomain);
  function resetFilters() { setSearch(""); setLevel("all"); setKind("all"); setLanguage("all"); setSource("all"); setStatus("all"); setSort("recommended"); setPage(1); }
  if (locked) return <main className="login-page"><form onSubmit={login}><div className="brand-logo"><Terminal size={26} /><span>CODE:FIT<span className="brand-cursor">_</span></span></div><span className="eyebrow">YOUR DAILY CODING GYM</span><h1>오늘도, 코딩 근력을 지킬 시간.</h1><p>연습실 접근 암호를 입력해 주세요.</p><label>접근 암호<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} autoFocus /></label>{loadError && <p className="inline-error" role="alert">{loadError}</p>}<button className="primary-button full-width" disabled={loginBusy}>{loginBusy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}연습실 열기</button></form></main>;
  return <div className={`lab-shell ${focus && initialProblemId ? "focus-mode" : ""}`}>
    <a className="skip-link" href="#main-content">본문으로 이동</a>
    {mobileMenu && <button className="sidebar-backdrop" aria-label="메뉴 닫기" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`} aria-label="주 메뉴" onKeyDown={event => { if (!mobileMenu || event.key !== "Tab") return; const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a, button:not(:disabled)")); const first = controls[0], last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }}><Link href="/" className="brand-logo"><span className="brand-symbol"><Terminal size={22} /></span><span>CODE:FIT<span className="brand-cursor">_</span><small>AI 시대의 코딩 근력</small></span></Link><button className="sidebar-close icon-button" aria-label="메뉴 닫기" onClick={() => setMobileMenu(false)}><X size={20} /></button>
      <div className="sidebar-workspace"><span className="workspace-avatar">F</span><span>개인 연습실<small>Personal workspace</small></span><span className="status-dot" /></div>
      <nav><span className="nav-caption">WORKSPACE</span><Link className={`nav-item ${!initialProblemId && initialView === "library" && initialDomain === "all" ? "active" : ""}`} href="/"><LayoutGrid size={17} /><span>문제 보관함</span><small>{data?.problems.length ?? "—"}</small></Link><Link className={`nav-item ${!initialProblemId && initialView === "bookmarks" ? "active" : ""}`} href="/?view=bookmarks"><Bookmark size={17} /><span>북마크</span>{saved > 0 && <small>{saved}</small>}</Link><Link className={`nav-item ${!initialProblemId && initialView === "history" ? "active" : ""}`} href="/?view=history"><History size={17} /><span>학습 기록</span></Link>
        <span className="nav-caption domains-caption">EXPLORE BY DOMAIN <span>{DOMAINS.length}</span></span>{DOMAINS.map(d => <Link key={d.id} href={`/?domain=${d.id}`} className={`nav-item domain-nav ${(!initialProblemId && initialDomain === d.id || activeProblem?.domain === d.id) ? "domain-active" : ""}`}><DomainIcon domain={d.id} /><span>{d.label}</span></Link>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><Terminal size={17} /><span>매일 한 문제,<br /><strong>코딩 근력을 지키는 시간.</strong></span></div><button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /><span>환경 설정</span></button><div className="sidebar-version"><span>CODE:FIT v2.0</span><span><i />{data ? "CONNECTED" : "CONNECTING"}</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-path"><button className="mobile-menu icon-button" aria-label="메뉴 열기" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><span className="mono path-root">workspace</span><span>/</span><strong>{initialProblemId ? "문제 풀이" : title}</strong></div><div className="topbar-actions"><span className="connection"><span className={`status-dot ${!data ? "waiting" : ""}`} />{data ? "저장소 연결됨" : "연결 중"}</span>{!initialProblemId && <button className="icon-button" aria-label="문제와 기록 새로고침" disabled={refreshing} onClick={() => void load()}><RotateCcw size={17} className={refreshing ? "spin" : ""} /></button>}<button className="icon-button help-button" aria-label="사용 안내" onClick={() => setHelpOpen(true)}><CircleHelp size={18} /></button><button className="primary-button small" onClick={() => setGeneratorOpen(true)} disabled={!data}><Sparkles size={15} />AI 문제 생성<span className="new-label">NEW</span></button></div></header>
      <main id="main-content" className={initialProblemId ? "practice-main" : "library-main"}>
        {loadError ? <div className="empty-state"><AlertCircle size={32} /><h1>저장소에 연결하지 못했습니다.</h1><p>{loadError}</p><button className="secondary-button" onClick={load}><RotateCcw size={16} />다시 연결</button></div> : !data ? <div className="content-loader" role="status"><span className="terminal-icon"><Terminal size={26} /></span><span className="mono">INITIALIZING WORKSPACE<span className="blink">_</span></span><p>문제와 학습 기록을 불러오는 중입니다.</p></div> : initialProblemId ? <ProblemWorkspace key={`${initialProblemId}:${initialAttemptId || ""}`} id={initialProblemId} returnTo={returnTo} initialAttemptId={initialAttemptId} onProgress={onProgress} fontSize={fontSize} focus={focus} setFocus={setFocus} aiReady={data.aiReady} /> : initialView === "history" ? <>
          <div className="page-title"><span className="eyebrow">YOUR LEARNING LOG</span><h1>쌓이는 코드, 선명해지는 실력.</h1><p>지난 풀이를 돌아보고 다음 시도를 이어가세요.</p></div><div className="stats-row history-stats"><div><span><CheckCircle2 size={16} />해결한 문제</span><strong>{solved}<small>문제</small></strong></div><div><span><FileCode2 size={16} />검토한 풀이</span><strong>{data.attempts.length}<small>회</small></strong></div><div><span><Clock3 size={16} />진행 중</span><strong>{inProgress}<small>문제</small></strong></div><div><span><Bookmark size={16} />다시 풀 문제</span><strong>{saved}<small>문제</small></strong></div></div>
          <section className="training-overview" aria-label="최근 7일 훈련 현황"><div><span className="eyebrow">꾸준함이 실력이 됩니다</span><h2>{training.streak ? `${training.streak}일 연속 훈련 중` : "오늘의 첫 풀이를 남겨 보세요"}</h2><p>최근 7일 중 {training.activeDays}일 훈련 · 도움 없이 해결한 문제 {training.independentSolved}개</p><small>AI 검토를 완료한 날 기준 · 한국 시간</small></div><div className="training-week">{training.week.map(day => <span key={day.label} className={day.active ? "active" : ""} aria-label={`${day.label} ${day.active ? "훈련 완료" : "검토 기록 없음"}`}><Check size={16} /><small>{day.label}</small></span>)}</div></section>
          <section className="history-section"><div className="section-heading"><h2>풀이 타임라인 <span>{data.attempts.length}</span></h2><span className="muted">최근 검토 순</span></div>{data.attempts.length === 0 ? <div className="empty-state bordered"><History size={36} /><h2>첫 번째 기록을 남겨 보세요.</h2><p>문제를 풀고 AI 검토를 받으면 풀이와 피드백이 여기에 쌓입니다.</p><Link className="primary-button" href="/">문제 고르기<ArrowRight size={16} /></Link></div> : <div className="timeline">{data.attempts.map(a => { const p = data.problems.find(p => p.id === a.problemId); return <Link href={problemUrl(a.problemId, libraryHref, a.id)} className="timeline-item" key={a.id}><span className={a.review.passed ? "timeline-icon solved" : "timeline-icon"}>{a.review.passed ? <CheckCircle2 size={20} /> : <CodeIcon />}</span><div><div><span className="mono">{dateLabel(a.createdAt)}</span><span>{a.assisted ? "힌트 / 정답 참고" : "직접 풀이"}</span></div><h3>{p?.title || "문제 풀이"}</h3><p>{a.review.summary}</p></div><strong className={a.review.passed ? "success-text" : "muted"}>{a.review.score}%</strong><ChevronRight size={18} /></Link>; })}</div>}</section>
        </> : <>
          {initialView === "library" && initialDomain === "all" ? <section className="library-hero"><div className="hero-copy"><span className="eyebrow"><span className="status-dot" /> AI 시대의 코딩 근력, CODE:FIT</span><h1><span className="hero-headline-line">AI가 코드를 짜도,</span><span className="hero-headline-line">내 실력은 녹슬지 않게<span className="accent">_</span></span></h1><p>AI에게 코딩을 맡기는 동안, 내 손으로 푸는 감각도 챙기세요.<br /> 기능 구현, 버그 수정, 리팩터링을 직접 풀며 실력을 단련합니다.</p><div className="training-principle"><CodeIcon /><span>문제는 AI가 출제하고, 풀이는 직접. 막힐 때는 힌트와 피드백.</span></div>{recommended && <Link href={problemUrl(recommended.id, libraryHref)} className="hero-start">{resume ? "이어서 훈련하기" : "오늘의 코딩 훈련 시작"}<ArrowUpRight size={16} /><span>{resume ? "저장된 코드부터 이어서" : `약 ${recommended.minutes}분 / 난이도 ${recommended.difficulty}`}</span></Link>}</div><div className="hero-terminal" aria-label="코딩 근력 훈련 과정"><div className="terminal-title"><span><i /><i /><i /></span><span>CODE:FIT / DAILY TRAINING</span><Terminal size={13} /></div><div className="terminal-body"><div><span className="terminal-prompt">C:\CODEFIT&gt;</span> <span className="muted">train.exe</span></div><p><span className="terminal-flag">/mode:</span><span className="terminal-value">hands-on</span></p><div className="terminal-output"><span><Check size={12} />구현 — 요구사항을 코드로 옮기기</span><span><Check size={12} />디버깅 — 원인을 찾고 직접 고치기</span><span><Check size={12} />리팩터링 — 더 나은 구조로 다듬기</span></div><div className="terminal-bottom"><span className="accent">C:\CODEFIT&gt;</span><span className="block-cursor" /></div></div><div className="terminal-foot"><span className="status-dot" /> KEEP YOUR CODING MUSCLE.</div></div></section> : <div className="page-title"><span className="eyebrow">{initialView === "bookmarks" ? "SAVED FOR LATER" : "EXPLORE YOUR DOMAIN"}</span><h1>{initialView === "bookmarks" ? "다시 풀고 싶은 문제들." : `${domainLabel(initialDomain as DomainId)}, 직접 풀어 보세요.`}</h1><p>{initialView === "bookmarks" ? "북마크한 문제를 모아 보고, 나만의 속도로 다시 도전하세요." : "AI에게 맡겼던 기능 구현, 오류 수정, 리팩터링을 직접 풀며 코딩 감각을 유지하세요."}</p></div>}
          <div className="stats-row"><div><span><FolderCode size={16} />전체 문제</span><strong>{data.problems.length}<small>문제</small></strong><span className="stat-note">차곡차곡 쌓이는 문제 은행</span></div><div><span><CheckCircle2 size={16} />해결한 문제</span><strong className="accent">{solved}<small>/ {data.problems.length}</small></strong><div className="stat-progress"><i style={{ width: `${solved / Math.max(1,data.problems.length) * 100}%` }} /></div></div><div><span><Clock3 size={16} />진행 중</span><strong>{inProgress}<small>문제</small></strong><span className="stat-note">작성한 코드부터 이어서</span></div><div><span><Sparkles size={16} />AI 생성 문제</span><strong>{aiCount}<small>문제</small></strong><span className="stat-note"><span className="status-dot" />생성하면 자동으로 저장</span></div></div>
          <section className="problem-library" aria-label="문제 목록"><div className="section-heading"><div><h2>{title}<span>{filtered.length}</span></h2><p>오늘은 어떤 코딩 근력을 단련할까요?</p></div><button className="text-button" onClick={() => setGeneratorOpen(true)}><Sparkles size={14} />원하는 문제가 없다면 직접 생성<ArrowRight size={14} /></button></div>
          <div className="filter-top"><div className="search-box"><Search size={17} /><input id="problem-search" maxLength={200} value={search} placeholder="제목, 기술, 키워드로 검색" onChange={e => { setSearch(e.target.value); setPage(1); }} aria-label="문제 검색" />{search ? <button className="icon-button" aria-label="검색어 지우기" onClick={() => setSearch("")}><X size={14} /></button> : <kbd>/</kbd>}</div><div className="type-filters"><button className={kind === "all" ? "selected" : ""} aria-pressed={kind === "all"} onClick={() => { setKind("all"); setPage(1); }}>전체 유형</button>{KINDS.map(k => <button key={k} className={kind === k ? "selected" : ""} aria-pressed={kind === k} onClick={() => { setKind(k); setPage(1); }}>{KIND_LABELS[k]}</button>)}</div></div>
          <div className="filter-bottom"><div className="select-filters"><label><span className="sr-only">난이도 필터</span><select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }}><option value="all">모든 난이도</option>{LEVELS.map(l => <option value={l} key={l}>난이도 {l}</option>)}</select><ChevronDown size={12} /></label><label><span className="sr-only">언어 필터</span><select value={language} onChange={e => { setLanguage(e.target.value); setPage(1); }}><option value="all">모든 언어</option>{Object.entries(LANGUAGES).map(([id,l]) => <option key={id} value={id}>{l.label}</option>)}</select><ChevronDown size={12} /></label><label><span className="sr-only">풀이 상태 필터</span><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="all">모든 상태</option><option value="new">미해결</option><option value="in-progress">진행 중</option><option value="solved">해결 완료</option></select><ChevronDown size={12} /></label><label><span className="sr-only">문제 출처 필터</span><select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}><option value="all">모든 출처</option><option value="curated">기본 문제</option><option value="ai">AI 생성</option></select><ChevronDown size={12} /></label>{hasFilters && <button className="text-button clear-filters" onClick={resetFilters}><RotateCcw size={12} />초기화</button>}</div><label className="sort-select"><span className="sr-only">정렬 순서</span><select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="recommended">추천순</option><option value="newest">최신순</option><option value="easy">쉬운 순</option><option value="short">짧은 시간순</option></select><ChevronDown size={12} /></label></div>
          <div className="problem-table"><div className="table-header"><span>상태</span><span>문제</span><span>유형</span><span>난이도</span><span>예상 시간</span><span className="sr-only">북마크</span></div>{pageProblems.length === 0 ? <div className="empty-state"><Search size={32} /><h3>{initialView === "bookmarks" && !hasFilters ? "아직 북마크한 문제가 없습니다." : "조건에 맞는 문제가 없습니다."}</h3><p>{initialView === "bookmarks" && !hasFilters ? "문제 옆 북마크 아이콘을 눌러 모아 보세요." : "검색 조건을 바꾸거나 원하는 주제로 새 문제를 만들어 보세요."}</p>{hasFilters ? <button className="secondary-button" onClick={resetFilters}>필터 초기화</button> : <Link href="/" className="secondary-button">전체 문제 보기</Link>}</div> : pageProblems.map(p => { const progress = data.progress[p.id]; return <div className="problem-row" key={p.id}><span className={`problem-status ${progress?.status || "new"}`} title={progress?.status === "solved" ? "해결 완료" : progress?.status === "in-progress" ? "진행 중" : "미해결"}>{progress?.status === "solved" ? <CheckCircle2 size={18} aria-label="해결 완료" /> : progress?.status === "in-progress" ? <Clock3 size={17} aria-label="진행 중" /> : <span className="empty-status" aria-label="미해결" role="img" />}</span><Link href={problemUrl(p.id, libraryHref)} className="problem-link"><div><h3>{p.title}</h3>{p.source === "ai" && <span className="ai-tag"><Sparkles size={10} />AI</span>}</div><span><DomainIcon domain={p.domain} size={12} />{domainLabel(p.domain)}<i />{LANGUAGES[p.language].label}<span className="row-tags">{p.tags.slice(1,3).map(t => <span key={t}>{t}</span>)}</span></span></Link><KindBadge kind={p.kind} /><DifficultyBadge level={p.difficulty} /><span className="row-time mono">{p.minutes}<small> min</small></span><button className={`bookmark-button icon-button ${progress?.bookmarked ? "active" : ""}`} aria-label={`${p.title} ${progress?.bookmarked ? "북마크 해제" : "북마크"}`} disabled={bookmarking === p.id} onClick={() => bookmark(p)}><Bookmark size={17} fill={progress?.bookmarked ? "currentColor" : "none"} /></button></div>; })}</div>
          <div className="table-footer"><span>{filtered.length > 0 ? `${(currentPage-1)*8+1}–${Math.min(currentPage*8, filtered.length)}` : "0"} <span className="muted">/ {filtered.length}개 문제</span></span><div className="pagination"><button className="icon-button" aria-label="이전 페이지" disabled={currentPage <= 1} onClick={() => setPage(currentPage-1)}><ChevronLeft size={16} /></button><span>{currentPage} <span className="muted">/ {Math.max(1,Math.ceil(filtered.length/8))}</span></span><button className="icon-button" aria-label="다음 페이지" disabled={currentPage*8 >= filtered.length} onClick={() => setPage(currentPage+1)}><ChevronRight size={16} /></button></div></div>
          </section><div className="library-bottom-note"><span><ShieldCheck size={14} />생성한 문제와 학습 기록은 서버에 보관됩니다.</span><button className="text-button" onClick={exportData} disabled={exporting}><ArrowDownToLine size={13} />내 기록 내보내기</button></div>
        </>}
      </main><footer className="app-footer"><span className="mono">&gt; CODE:FIT / KEEP YOUR SKILLS SHARP.</span><span>{DOMAIN_IDS.length}개 분야<span>/</span>{Object.keys(LANGUAGES).length}개 언어와 기술</span></footer>
    </div>
    <Generator key={`${initialDomain}:${activeProblem?.domain || "frontend"}`} open={generatorOpen} onClose={() => setGeneratorOpen(false)} initialDomain={initialDomain === "all" ? activeProblem?.domain || "frontend" : initialDomain} aiReady={Boolean(data?.aiReady)} onCreated={problem => { setData(d => d ? { ...d, problems: [problem, ...d.problems.filter(p => p.id !== problem.id)] } : d); setGeneratorOpen(false); router.push(problemUrl(problem.id, initialProblemId ? returnTo : libraryHref)); }} />
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="WORKSPACE SETTINGS"><div className="settings-content"><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2>내게 맞는 연습 환경</h2><label className="font-setting">코드 글자 크기 <strong>{fontSize}px</strong><input type="range" min={12} max={20} step={1} value={fontSize} onChange={e => { const size = Number(e.target.value); setFontSize(size); try { localStorage.setItem("recode-editor-font", String(size)); } catch { /* Settings still work for this session. */ } }} /></label><div className="font-preview mono" style={{ fontSize }}>const practice = () =&gt; progress++;</div><div className="settings-info"><span><span className={`status-dot ${!data?.aiReady ? "waiting" : ""}`} />AI 연결</span><strong>{data?.aiReady ? "서버에 연결 정보 설정됨" : "API 키 설정 필요"}</strong></div><div className="settings-info"><span><ShieldCheck size={15} />저장소</span><strong>{data ? "서버 데이터베이스" : "연결 확인 중"}</strong></div><p className="muted">문제는 연습실 전체에 공유되며, 풀이와 진도는 이 브라우저의 개인 세션에 저장됩니다. 브라우저 쿠키를 삭제하기 전 기록을 내보내세요. 다른 브라우저에서는 백업을 가져와 이어갈 수 있습니다.</p>{Boolean(data?.legacyCount) && <p className="inline-warning">이전 버전의 생성 예제 {data?.legacyCount}개도 서버에 별도로 보관했습니다. 내보내기에 원본이 포함됩니다.</p>}<button className="secondary-button full-width" onClick={exportData} disabled={exporting}>{exporting ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}전체 문제와 내 학습 기록 내보내기</button><input ref={importFile} type="file" accept="application/json,.json" className="sr-only" aria-label="학습 기록 백업 파일" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; if (file) void importBackup(file); }} /><button className="secondary-button full-width import-button" onClick={() => importFile.current?.click()} disabled={importing}>{importing ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}백업 가져오기</button>{settingsNotice && <p className={settingsNotice.error ? "inline-error" : "draft-notice"} role={settingsNotice.error ? "alert" : "status"}>{settingsNotice.text}</p>}<p className="import-note">이미 있는 문제와 작성 코드는 유지하고 새 기록을 추가합니다.</p></div></Modal>
    <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="QUICK START"><div className="help-content"><span className="eyebrow">WELCOME TO CODE:FIT</span><h2>AI 시대에도, 스스로 풀 수 있도록.</h2><ol><li><span>01</span><div><strong>유지하고 싶은 코딩 감각을 고르세요.</strong><p>분야, 언어, 난이도와 유형으로 찾거나 AI로 직접 만들 수 있습니다.</p></div></li><li><span>02</span><div><strong>요구사항을 읽고 코드를 작성하세요.</strong><p>먼저 스스로 구현해 보세요. 막히는 지점에서는 힌트를 한 단계씩 확인할 수 있습니다. 코드는 자동 저장됩니다.</p></div></li><li><span>03</span><div><strong>AI 피드백으로 풀이를 개선하세요.</strong><p>힌트를 단계별로 확인하고 정답과 비교할 수 있습니다. AI 검토는 코드를 실행하지 않으며 실제 실행 검증을 대신하지 않습니다.</p></div></li></ol><div className="shortcut-help"><span><kbd>/</kbd> 문제 검색</span><span><kbd>⌘ / Ctrl + Enter</kbd> AI 풀이 검토</span></div></div></Modal>
    <Modal open={reauth} onClose={() => {}} title="연습실 다시 연결" dismissible={false}><form className="settings-content" onSubmit={login}><h2>접근 암호를 다시 입력해 주세요.</h2><p className="muted">로그인 시간이 만료되었습니다. 작성 중인 코드는 유지되며 연결 후 저장을 다시 시도합니다.</p><label className="reauth-field">접근 암호<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>{loadError && <p className="inline-error" role="alert">{loadError}</p>}<button className="primary-button full-width" disabled={loginBusy}>{loginBusy ? "연결 중…" : "다시 연결"}</button></form></Modal>
    {toast && <div className={`toast ${toastError ? "toast-error" : ""}`} role={toastError ? "alert" : "status"}>{toastError ? <AlertCircle size={16} /> : <Check size={16} />}<span>{toast}</span><button className="icon-button" aria-label="알림 닫기" onClick={() => setToast("")}><X size={14} /></button></div>}
  </div>;
}
function CodeIcon() { return <FileCode2 size={19} />; }
