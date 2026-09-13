"use client";
import type { ConfirmationAction } from "@/components/workspace/types";
import type { Dispatch, SetStateAction } from "react";

import type { WorkspaceTab } from "@/components/workspace/types";

import { dateLabel } from "@/lib/client-api";
import type { Attempt, PublicProblem } from "@/lib/problem";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  FileText,
  History,
  Lightbulb,
  LoaderCircle,
} from "lucide-react";
interface ProblemMaterialsProps {
  tab: WorkspaceTab;
  setTab: Dispatch<SetStateAction<WorkspaceTab>>;
  hints: string[];
  attempts: Attempt[];
  problem: PublicProblem;
  revealing: boolean;
  reveal: (kind: "hint" | "solution") => Promise<void>;
  solution: { code: string; explanation: string } | null;
  setConfirm: Dispatch<SetStateAction<ConfirmationAction>>;
  setCopied: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  copied: boolean;
  selectedAttempt: Attempt | null;
  setSelectedAttempt: Dispatch<SetStateAction<Attempt | null>>;
}
export function ProblemMaterials({
  tab,
  setTab,
  hints,
  attempts,
  problem,
  revealing,
  reveal,
  solution,
  setConfirm,
  setCopied,
  setError,
  copied,
  selectedAttempt,
  setSelectedAttempt,
}: ProblemMaterialsProps) {
  return (
    <section className="problem-pane" aria-label="문제 설명">
      <div
        className="problem-tabs"
        role="tablist"
        aria-label="문제 자료"
        onKeyDown={(event) => {
          const tabs: WorkspaceTab[] = ["problem", "hints", "solution", "history"];
          const index = tabs.indexOf(tab);
          const next =
            event.key === "ArrowRight"
              ? tabs[(index + 1) % 4]
              : event.key === "ArrowLeft"
                ? tabs[(index + 3) % 4]
                : event.key === "Home"
                  ? tabs[0]
                  : event.key === "End"
                    ? tabs[3]
                    : null;
          if (next) {
            event.preventDefault();
            setTab(next);
            document.getElementById(`tab-${next}`)?.focus();
          }
        }}
      >
        {(
          [
            { id: "problem", label: "문제", Icon: FileText },
            { id: "hints", label: "힌트", Icon: Lightbulb },
            { id: "solution", label: "정답", Icon: Code2 },
            { id: "history", label: "기록", Icon: History },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            tabIndex={tab === t.id ? 0 : -1}
            aria-selected={tab === t.id}
            aria-controls="problem-tab-panel"
            onClick={() => setTab(t.id)}
          >
            <t.Icon size={15} />
            {t.label}
            {t.id === "hints" && <small>{hints.length}/3</small>}
            {t.id === "history" && attempts.length > 0 && <small>{attempts.length}</small>}
          </button>
        ))}
      </div>
      <div
        className="problem-content"
        role="tabpanel"
        id="problem-tab-panel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "problem" && (
          <>
            <div className="section-marker">
              01 <span>상황</span>
            </div>
            <p className="scenario">{problem.scenario}</p>
            <div className="section-marker">
              02 <span>구현 요구사항</span>
            </div>
            <ol className="requirements">
              {problem.requirements.map((r, i) => (
                <li key={r}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <p>{r}</p>
                </li>
              ))}
            </ol>
            <div className="section-marker">
              03 <span>입출력 예시</span>
            </div>
            {problem.examples.map((example, i) => (
              <div className="example-box" key={i}>
                <div>
                  <span>INPUT</span>
                  <code>{example.input}</code>
                </div>
                <div>
                  <span>EXPECTED</span>
                  <code>{example.output}</code>
                </div>
                <p>{example.note}</p>
              </div>
            ))}
            <div className="problem-tags">
              {problem.tags.map((tag) => (
                <span key={tag}># {tag}</span>
              ))}
            </div>
            <div className="help-nudge">
              <Lightbulb size={17} />
              <span>막히는 부분이 있다면 힌트를 한 단계씩 열어 보세요.</span>
              <button onClick={() => setTab("hints")} aria-label="힌트 탭 열기">
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
        {tab === "hints" && (
          <>
            <span className="eyebrow">A LITTLE NUDGE</span>
            <h2>생각의 실마리가 필요할 때</h2>
            <p className="muted">
              힌트는 한 단계씩 구체적인 방향을 알려 줍니다. 사용 기록은 풀이와 함께 저장됩니다.
            </p>
            <div className="hints-list">
              {[0, 1, 2].map((i) => (
                <div className={`hint-card ${hints[i] ? "revealed" : "locked"}`} key={i}>
                  <div>
                    <span className="mono">HINT 0{i + 1}</span>
                    {hints[i] ? (
                      <Check size={15} />
                    ) : (
                      <span>{["접근 방향", "핵심 개념", "구현 방법"][i]}</span>
                    )}
                  </div>
                  {hints[i] ? (
                    <p>{hints[i]}</p>
                  ) : (
                    <p>
                      {i === hints.length
                        ? "준비되면 다음 힌트를 열어 보세요."
                        : "이전 힌트를 먼저 확인해 주세요."}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              className="secondary-button full-width"
              disabled={revealing || hints.length >= 3}
              onClick={() => reveal("hint")}
            >
              {revealing ? <LoaderCircle className="spin" size={16} /> : <Lightbulb size={16} />}
              {hints.length >= 3 ? "모든 힌트를 확인했습니다" : `힌트 ${hints.length + 1} 보기`}
            </button>
          </>
        )}
        {tab === "solution" && (
          <>
            {!solution ? (
              <div className="solution-locked">
                <div className="terminal-icon">
                  <Eye size={28} />
                </div>
                <h2>다른 풀이와 비교해 보세요.</h2>
                <p>
                  정답 코드와 해설을 확인할 수 있습니다.
                  <br />
                  먼저 직접 풀어 본 뒤 비교하면 더 많이 배울 수 있어요.
                </p>
                <button
                  className="secondary-button"
                  onClick={() => setConfirm("solution")}
                  disabled={revealing}
                >
                  {revealing ? <LoaderCircle className="spin" size={16} /> : <Eye size={16} />}
                  정답 보기
                </button>
                <small>정답을 본 기록이 남으며 자동으로 완료 처리되지 않습니다.</small>
              </div>
            ) : (
              <>
                <div className="solution-title">
                  <span className="eyebrow">REFERENCE SOLUTION</span>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(solution.code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        setError("클립보드를 사용할 수 없습니다. 코드를 선택해 복사해 주세요.");
                      }
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
                <h2>참고 정답</h2>
                <p className="muted">같은 요구사항을 만족하는 다른 구현도 올바른 풀이입니다.</p>
                <pre className="solution-code">
                  <code>{solution.code}</code>
                </pre>
                <div className="section-marker">
                  WHY <span>이렇게 풀었어요</span>
                </div>
                <p className="scenario">{solution.explanation}</p>
              </>
            )}
          </>
        )}
        {tab === "history" && (
          <>
            <span className="eyebrow">SUBMISSION HISTORY</span>
            <h2>생각이 코드가 된 기록</h2>
            {attempts.length === 0 ? (
              <div className="tab-empty">
                <History size={30} />
                <p>아직 검토한 풀이가 없습니다.</p>
                <small>코드를 작성하고 AI 풀이 검토를 눌러 보세요.</small>
              </div>
            ) : (
              <div className="attempts-list">
                {attempts.map((a, i) => (
                  <button
                    key={a.id}
                    className={selectedAttempt?.id === a.id ? "selected" : ""}
                    onClick={() => setSelectedAttempt(a)}
                  >
                    <span>
                      <strong>시도 #{attempts.length - i}</strong>
                      <small>
                        {dateLabel(a.createdAt)}
                        {a.assisted ? " · 도움 사용" : " · 직접 풀이"}
                      </small>
                    </span>
                    <span className={a.review.passed ? "success-text" : "muted"}>
                      {a.review.score}%<ChevronRight size={15} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
