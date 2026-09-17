"use client";

import { Modal } from "@/components/ui/modal";
import {
  DOMAINS,
  KINDS,
  KIND_LABELS,
  LANGUAGES,
  LEVELS,
  type DomainId,
  type Language,
} from "@/lib/catalog";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import Link from "next/link";
import type { AccountState } from "@/lib/auth-types";
import type { AiUsage } from "@/lib/ai-telemetry";
import type { PublicProblem } from "@/lib/problem";
import { ArrowRight, Check, Database, LoaderCircle, Sparkles, Terminal } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
const topics: Record<DomainId, string[]> = {
  frontend: ["검색 결과의 비동기 처리", "접근성 있는 모달", "폼 유효성 검사"],
  backend: ["API 페이지네이션", "멱등성 있는 결제 요청", "캐시 만료 정책"],
  game: ["인벤토리 시스템", "충돌 감지", "오브젝트 풀"],
  network: ["TCP 메시지 파싱", "재시도와 타임아웃", "연결 풀"],
  database: ["JOIN 집계 오류", "트랜잭션 일관성", "윈도 함수"],
  infra: ["다단계 Docker 빌드", "배포 상태 검사", "안전한 백업 자동화"],
  mobile: ["화면 상태 관리", "오프라인 캐시", "목록 페이지네이션"],
  data: ["데이터 전처리", "데이터 누수 방지", "배치 데이터 집계"],
  security: ["안전한 URL 검증", "입력 검증", "권한 확인 로직"],
  systems: ["LRU 캐시", "링 버퍼", "메모리 소유권"],
};
export function Generator({
  open,
  onClose,
  onCreated,
  initialDomain,
  aiReady,
  account,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (problem: PublicProblem) => void;
  initialDomain: DomainId;
  aiReady: boolean;
  account: AccountState;
}) {
  const [domain, setDomain] = useState<DomainId>(initialDomain);
  const [language, setLanguage] = useState<Language>(
    DOMAINS.find((d) => d.id === initialDomain)!.languages[0],
  );
  const [difficulty, setDifficulty] = useState<(typeof LEVELS)[number]>("중");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("debugging");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [usageError, setUsageError] = useState("");
  const [usageRetry, setUsageRetry] = useState(0);
  useEffect(() => {
    if (!open || !account.user) return;
    const controller = new AbortController();
    api<AiUsage>("/api/usage", { signal: controller.signal })
      .then((value) => {
        setUsage(value);
        setUsageError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setUsageError(errorMessage(error));
      });
    return () => controller.abort();
  }, [open, account.user, usageRetry]);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function generate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify({ domain, language, difficulty, kind, topic });
      if (requestRef.current?.fingerprint !== fingerprint)
        requestRef.current = { fingerprint, id: crypto.randomUUID() };
      const { problem } = await api<{ problem: PublicProblem }>("/api/generate", {
        method: "POST",
        body: { domain, language, difficulty, kind, topic, requestId: requestRef.current.id },
      });
      requestRef.current = null;
      onCreated(problem);
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 401) setNeedsLogin(true);
    } finally {
      setBusy(false);
      setUsageRetry((value) => value + 1);
    }
  }
  if (!account.user || needsLogin)
    return (
      <Modal open={open} onClose={onClose} title="NEW CHALLENGE" className="generator-modal">
        <div className="generator-login">
          <span className="eyebrow">THREE NEW CHALLENGES A DAY</span>
          <h2>
            로그인하고,
            <br />
            내게 필요한 문제를 만드세요.
          </h2>
          <p>
            Google 또는 GitHub로 로그인하면 하루 3회 AI 문제를 만들 수 있습니다. 이용 횟수는 한국
            시간 자정에 초기화됩니다.
          </p>
          <div className="generation-note">
            <Database size={16} />
            <span>생성한 문제는 공개 보관함에 저장되어 누구나 풀 수 있습니다.</span>
          </div>
          <Link
            className="primary-button"
            href={`/login?returnTo=${encodeURIComponent(`/?domain=${initialDomain}&generate=1`)}`}
          >
            로그인 / 가입하고 생성하기
            <ArrowRight size={16} />
          </Link>
          <p>문제 풀이, 힌트, 정답 확인, AI 풀이 검토는 로그인 없이도 이용할 수 있습니다.</p>
        </div>
      </Modal>
    );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="NEW CHALLENGE"
      className="generator-modal"
      busy={busy}
    >
      <form onSubmit={generate}>
        <div className="generation-allowance" aria-live="polite">
          <strong>
            {usage ? `오늘 ${usage.remaining.generate} / 3회 남음` : "생성 가능 횟수 확인 중…"}
          </strong>
          <small>매일 한국 시간 자정에 초기화 · GPT-5.6 Sol</small>
        </div>
        {usageError && (
          <p className="inline-error" role="alert">
            {usageError}{" "}
            <button
              className="text-button"
              type="button"
              onClick={() => setUsageRetry(usageRetry + 1)}
            >
              다시 확인
            </button>
          </p>
        )}
        {usage?.remaining.generate === 0 && (
          <p className="inline-warning">
            오늘의 문제 생성 횟수를 모두 사용했습니다. 한국 시간 자정부터 다시 만들 수 있습니다.
          </p>
        )}
        <div className="generator-intro">
          <div className="terminal-icon">
            <Sparkles size={25} />
          </div>
          <span className="eyebrow">MAKE YOUR NEXT CHALLENGE</span>
          <h2>지금 필요한 문제를 만드세요.</h2>
          <p>분야, 난이도와 주제를 고르면 AI가 문제와 힌트, 참고 정답을 만듭니다.</p>
        </div>
        <fieldset disabled={busy} className="generator-fields">
          <div className="form-row">
            <label>
              분야
              <select
                value={domain}
                onChange={(e) => {
                  const next = e.target.value as DomainId;
                  setDomain(next);
                  setLanguage(DOMAINS.find((d) => d.id === next)!.languages[0]);
                }}
              >
                {DOMAINS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              언어 / 기술
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                {DOMAINS.find((d) => d.id === domain)!.languages.map((l) => (
                  <option value={l} key={l}>
                    {LANGUAGES[l].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-label">문제 유형</label>
          <div className="segmented" role="group" aria-label="문제 유형">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k}
                aria-pressed={kind === k}
                className={kind === k ? "selected" : ""}
                onClick={() => setKind(k)}
              >
                {KIND_LABELS[k]}
                {kind === k && <Check size={13} />}
              </button>
            ))}
          </div>
          <label className="field-label">난이도</label>
          <div className="difficulty-options" role="group" aria-label="난이도">
            {LEVELS.map((level, i) => (
              <button
                type="button"
                key={level}
                data-difficulty={level}
                aria-pressed={difficulty === level}
                className={difficulty === level ? "selected" : ""}
                onClick={() => setDifficulty(level)}
              >
                <strong>
                  {level}
                  <span>{["기본기를 탄탄하게", "실무 감각 익히기", "깊이 있는 도전"][i]}</span>
                </strong>
                <small>{["5–20분", "20–40분", "35–90분"][i]}</small>
              </button>
            ))}
          </div>
          <label className="topic-label">
            연습 주제 <span>{topic.length}/200</span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              minLength={2}
              maxLength={200}
              placeholder="예: 연속 검색 시 이전 API 응답이 최신 결과를 덮어쓰는 오류"
              rows={3}
            />
          </label>
          <div className="topic-suggestions">
            {topics[domain].map((t) => (
              <button type="button" key={t} onClick={() => setTopic(t)}>
                + {t}
              </button>
            ))}
          </div>
        </fieldset>
        {!aiReady && (
          <p className="inline-warning">
            현재 AI 문제 생성을 사용할 수 없습니다. 보관함에 있는 문제는 계속 풀 수 있습니다.
          </p>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="generation-note">
          <Database size={15} />
          <span>생성된 문제는 보관함에 자동으로 영구 저장됩니다.</span>
        </div>
        {busy && (
          <div className="generation-progress" role="status">
            <Terminal size={16} />
            <div>
              <strong>
                문제와 힌트, 정답을 구성하고 있습니다<span className="blink">_</span>
              </strong>
              <span>보통 30–90초가 걸립니다. 저장이 끝나면 문제를 열어 드립니다.</span>
            </div>
          </div>
        )}
        <button
          className="primary-button generate-submit"
          disabled={
            busy ||
            !aiReady ||
            !usage ||
            Boolean(usageError) ||
            usage.remaining.generate === 0 ||
            topic.trim().length < 2
          }
        >
          {busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          {busy ? "문제 생성 중" : "문제 생성하기"}
          {!busy && <ArrowRight size={17} />}
        </button>
      </form>
    </Modal>
  );
}
