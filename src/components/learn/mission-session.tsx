"use client";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Lightbulb } from "lucide-react";
import { useBeginnerMission } from "@/hooks/use-beginner-mission";
import { MISSIONS, type Mission, type Action } from "@/lib/learn/catalog";
import {
  canComplete,
  checksPassed,
  learningSummary,
  readLearning,
  requestReady,
  type LearningRecord,
} from "@/lib/learn/progress";
import { reproduced, simulate, verification } from "@/lib/learn/simulation";
import type { LearningSession } from "./mission-loader";
import { SimulationView } from "./simulation-view";
import { MissionRequest } from "./mission-request";
const stages = ["예상하기", "직접 확인", "수정과 검사", "응용하기"];
const labels = {
  saved: "서버에 저장됨",
  saving: "저장 중…",
  local: "저장 대기",
  offline: "오프라인 · 브라우저 보관",
  failed: "저장 실패 · 재시도 가능",
  conflict: "다른 곳의 기록과 충돌",
  resolving: "서버 버전 확인 중",
};
function download(m: Mission, r: LearningRecord) {
  const blob = new Blob([learningSummary(m, r)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `codefit-${m.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
export function MissionSession({
  mission: m,
  session,
}: {
  mission: Mission;
  session: LearningSession;
}) {
  const c = useBeginnerMission(m, session),
    r = c.record;
  const [observationUndo, setObservationUndo] = useState<Action[] | null>(null);
  const [sandbox, setSandbox] = useState<Action[]>([]),
    [notice, setNotice] = useState("");
  const focusPending = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (focusPending.current) {
      focusPending.current = false;
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start" });
    }
  }, [r.stage]);
  function move(stage: number) {
    setNotice("");
    if (stage === r.stage) return;
    focusPending.current = true;
    c.update((x) => ({ ...x, stage }));
  }
  const evidence = reproduced(m, r.actions),
    passed = checksPassed(m, r),
    results = verification(m, r.fix),
    next = MISSIONS[MISSIONS.findIndex((x) => x.id === m.id) + 1];
  const allowed = [
    true,
    r.locked,
    r.locked && evidence,
    r.locked && evidence && passed && (m.kind !== "lab" || requestReady(r)),
  ];
  const conflict =
    c.draft.draftStatus.kind === "conflict" || c.draft.draftStatus.kind === "resolving"
      ? c.draft.draftStatus
      : null;
  function lock() {
    if (r.prediction < 0) {
      setNotice("예상 결과를 하나 골라 주세요.");
      document.getElementById("learn-choice-0")?.focus();
      return;
    }
    if (r.reason.trim().length < 3) {
      setNotice("예상한 이유를 짧게 남겨 주세요. 최소 3자입니다.");
      document.getElementById("learn-reason")?.focus();
      return;
    }
    focusPending.current = true;
    c.update((x) => ({ ...x, locked: true, stage: 1 }));
    setNotice("");
  }
  function complete() {
    if (!canComplete(m, r)) {
      setNotice("응용 답과 배운 점을 확인해 주세요. 배운 점은 10자 이상 남겨 주세요.");
      document.getElementById("learn-reflection")?.focus();
      return;
    }
    c.update((x) => ({ ...x, completed: true }));
  }
  return (
    <main id="main-content" className="learn-page mission-page">
      <header className="learn-header">
        <Link href="/learn">
          <ArrowLeft size={16} /> 앱의 원리 배우기
        </Link>
        <div className="learn-save">
          <span role="status">{labels[c.draft.saveState]}</span>
          <button className="text-button" onClick={() => void c.draft.saveNow()}>
            지금 저장
          </button>
          <button
            className="icon-button"
            aria-label="학습 기록 내려받기"
            onClick={() => download(m, r)}
          >
            <Download size={18} />
          </button>
        </div>
      </header>
      <div className="mission-title">
        <span className="eyebrow">
          {m.kind === "lab" ? "앱 오류 해결 실습" : "앱의 원리 배우기"} / {m.minutes}분
        </span>
        <h1>{m.title}</h1>
        <p>{m.task}</p>
      </div>
      {!c.draft.localSaved && (
        <p role="alert">
          브라우저 보관에 실패했습니다. 창을 닫기 전에 학습 기록을 내려받아 주세요.
        </p>
      )}
      {conflict && (
        <section className="learn-conflict" aria-label="학습 기록 충돌">
          <p role="alert">
            <strong>다른 곳에서 저장한 학습 기록이 있습니다.</strong> 내 작성 내용은 유지됩니다. 두
            기록을 비교하고 필요한 내용을 아래 입력란에 옮긴 뒤 저장하세요.
          </p>
          <details>
            <summary>내 기록과 서버 기록 비교</summary>
            <div className="learn-comparison">
              <pre aria-label="내 학습 기록">{learningSummary(m, r)}</pre>
              <pre aria-label="서버 학습 기록">
                {learningSummary(m, readLearning(conflict.server.code))}
              </pre>
            </div>
          </details>
          <button
            className="secondary-button"
            disabled={conflict.kind === "resolving"}
            onClick={async () => {
              if (await c.draft.resolveConflict()) heading.current?.focus();
            }}
          >
            비교한 버전에 내 기록 저장
          </button>
          <p>그사이 서버 내용이 바뀌면 다시 비교를 안내합니다.</p>
        </section>
      )}
      {(c.error || notice) && (
        <p className="inline-error" role="alert">
          {c.error || notice}
        </p>
      )}
      <nav className="learn-steps" aria-label="입문 미션 단계">
        {stages.map((s, i) => (
          <button
            key={s}
            disabled={!c.ready || !allowed[i]}
            aria-current={r.stage === i ? "step" : undefined}
            onClick={() => move(i)}
          >
            <span>{i + 1}</span>
            {s}
          </button>
        ))}
      </nav>
      <section className="mission-stage" aria-busy={!c.ready}>
        <h2 ref={heading} tabIndex={-1}>
          {r.stage + 1}. {stages[r.stage]}
        </h2>
        {!c.ready ? (
          <p>초안을 복원하는 중…</p>
        ) : (
          <>
            {r.stage === 0 && (
              <div className="learn-prediction">
                <p>아직 실행하지 말고, 어떻게 될지 먼저 생각해 보세요. 틀려도 괜찮습니다.</p>
                <fieldset disabled={r.locked}>
                  <legend>{m.prediction}</legend>
                  {m.choices.map((choice, i) => (
                    <label className="learn-option" key={choice}>
                      <input
                        id={`learn-choice-${i}`}
                        name="prediction"
                        type="radio"
                        checked={r.prediction === i}
                        onChange={() => c.update((x) => ({ ...x, prediction: i }))}
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </fieldset>
                <label htmlFor="learn-reason">
                  왜 그렇게 생각했나요?
                  <textarea
                    id="learn-reason"
                    value={r.reason}
                    readOnly={r.locked}
                    rows={3}
                    maxLength={800}
                    placeholder="지금 알고 있는 만큼만 적어 주세요."
                    onChange={(e) => c.update((x) => ({ ...x, reason: e.target.value }))}
                  />
                </label>
                <button className="primary-button" onClick={r.locked ? () => move(1) : lock}>
                  {r.locked ? "내 첫 예상으로 다시 살펴보기" : "예상 남기고 직접 확인 →"}
                </button>
              </div>
            )}
            {r.stage === 1 && (
              <>
                <div className="mission-columns">
                  <SimulationView
                    mission={m}
                    actions={r.actions}
                    onAction={(a) => {
                      if (r.actions.length < 80)
                        c.update((x) => ({ ...x, completed: false, actions: [...x.actions, a] }));
                    }}
                  />
                  <div className="learn-observations">
                    <h3>내 첫 예상</h3>
                    <p>{m.choices[r.prediction]}</p>
                    <p className="muted">{r.reason}</p>
                    <h3>실행 기록</h3>
                    {r.actions.length ? (
                      <ol>
                        {simulate(m, r.actions)
                          .trace.slice(-12)
                          .map((t, i) => (
                            <li key={`${i}:${t}`}>{t}</li>
                          ))}
                      </ol>
                    ) : (
                      <p>왼쪽 앱의 버튼을 눌러 보세요. 모바일에서는 위쪽에 있습니다.</p>
                    )}
                    {r.actions.length > 12 && (
                      <small>최근 12개 동작을 표시합니다. 전체 기록은 내려받을 수 있습니다.</small>
                    )}
                    {r.actions.length >= 80 && (
                      <p>
                        관찰 기록 80개를 보관했습니다. 필요하면 기록을 내려받고 다시 시작하세요.
                      </p>
                    )}
                    {r.actions.length > 0 && (
                      <button
                        className="text-button"
                        onClick={() => {
                          download(m, r);
                          setObservationUndo(r.actions);
                          c.update((x) => ({ ...x, actions: [], checked: [], completed: false }));
                        }}
                      >
                        기록 내려받고 관찰 다시 시작
                      </button>
                    )}
                    {observationUndo && (
                      <button
                        className="text-button"
                        onClick={() => {
                          c.update((x) => ({
                            ...x,
                            actions: observationUndo,
                            checked: [],
                            completed: false,
                          }));
                          setObservationUndo(null);
                        }}
                      >
                        이전 관찰 복구
                      </button>
                    )}
                    {evidence && (
                      <div className="learn-concept">
                        <strong>
                          {r.prediction === m.answer
                            ? "예상한 대로 동작했습니다. 이유를 살펴보세요."
                            : "예상과 다른 결과가 나왔습니다. 이유를 살펴보세요."}
                        </strong>
                        <p>{m.lesson}</p>
                      </div>
                    )}
                  </div>
                </div>
                <button className="primary-button" disabled={!evidence} onClick={() => move(2)}>
                  수정 방법과 검사 살펴보기 →
                </button>
                {!evidence && (
                  <p className="learn-fineprint">
                    미션에 적힌 순서로 상황을 재현하면 다음 단계가 열립니다.
                  </p>
                )}
              </>
            )}
            {r.stage === 2 && (
              <>
                {m.kind === "foundation" ? (
                  <details>
                    <summary>AI에게 요청하는 연습도 해보기 (선택)</summary>
                    <MissionRequest
                      mission={m}
                      record={r}
                      update={c.update}
                      coach={c.coach}
                      busy={c.busy}
                      aiReady={session.aiReady}
                    />
                  </details>
                ) : (
                  <MissionRequest
                    mission={m}
                    record={r}
                    update={c.update}
                    coach={c.coach}
                    busy={c.busy}
                    aiReady={session.aiReady}
                  />
                )}
                <div className="learn-fixes">
                  <h3>수정안을 선택하고 결과를 확인하세요.</h3>
                  <p>다음은 검토 연습을 위해 준비한 수정안입니다. 적용한 뒤 동작을 확인하세요.</p>
                  <fieldset>
                    <legend>적용할 수정안</legend>
                    {m.fixes.map((f) => (
                      <label className="learn-option" key={f.id}>
                        <input
                          type="radio"
                          name="fix"
                          checked={r.fix === f.id}
                          onChange={() => {
                            setSandbox([]);
                            c.update((x) => ({ ...x, fix: f.id, checked: [], completed: false }));
                          }}
                        />
                        <span>
                          <strong>{f.title}</strong>
                          <small>{f.detail}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </div>
                {r.fix && (
                  <>
                    <details className="learn-sandbox">
                      <summary>수정안이 적용된 앱 사용해 보기</summary>
                      <SimulationView
                        mission={m}
                        fix={r.fix}
                        actions={sandbox}
                        onAction={(a) => setSandbox((s) => [...s, a].slice(-80))}
                      />
                      <button className="text-button" onClick={() => setSandbox([])}>
                        실험 상태 초기화
                      </button>
                    </details>
                    <section className="learn-checks" aria-label="수정 결과 검사">
                      <h3>수정 후에도 기능이 제대로 작동하는지 확인하세요.</h3>
                      <p>
                        각 검사는 초기 상태에서 독립적으로 실행합니다. 아래 항목을 모두 확인해야
                        다음 단계로 넘어갑니다.
                      </p>
                      {results.map((check) => (
                        <div className="learn-check" key={check.id}>
                          <div>
                            <strong>{check.label}</strong>
                            {r.checked.includes(check.id) && (
                              <p className={check.passed ? "learn-success" : "learn-warning"}>
                                {check.passed ? "확인됨" : "보완 필요"} — {check.evidence}
                              </p>
                            )}
                          </div>
                          <button
                            className="secondary-button"
                            onClick={() =>
                              c.update((x) => ({
                                ...x,
                                checked: Array.from(new Set([...x.checked, check.id])),
                              }))
                            }
                          >
                            {check.label} 검사
                          </button>
                        </div>
                      ))}
                    </section>
                  </>
                )}
                <button className="primary-button" disabled={!allowed[3]} onClick={() => move(3)}>
                  다른 상황에 적용하기 →
                </button>
                {m.kind === "lab" && !requestReady(r) && (
                  <p className="learn-fineprint">수정 요청의 다섯 항목도 채워 주세요.</p>
                )}
              </>
            )}
            {r.stage === 3 && (
              <>
                <div className="learn-transfer">
                  <fieldset>
                    <legend>{m.transfer.question}</legend>
                    {m.transfer.choices.map((choice, i) => (
                      <label className="learn-option" key={choice}>
                        <input
                          type="radio"
                          name="transfer"
                          checked={r.transfer === i}
                          onChange={() =>
                            c.update((x) => ({ ...x, transfer: i, completed: false }))
                          }
                        />
                        <span>{choice}</span>
                      </label>
                    ))}
                  </fieldset>
                  {r.transfer >= 0 && (
                    <p
                      role="status"
                      className={
                        r.transfer === m.transfer.answer ? "learn-success" : "learn-warning"
                      }
                    >
                      {r.transfer === m.transfer.answer
                        ? m.transfer.explanation
                        : "앞에서 확인한 원리를 다른 상황에도 적용해 보세요. 힌트를 다시 볼 수 있습니다."}
                    </p>
                  )}
                  <label htmlFor="learn-reflection">
                    내 제품에서는 무엇을 확인할 건가요?
                    <textarea
                      id="learn-reflection"
                      rows={3}
                      maxLength={1000}
                      value={r.reflection}
                      onChange={(e) =>
                        c.update((x) => ({ ...x, reflection: e.target.value, completed: false }))
                      }
                      placeholder="예: 저장 완료 안내뿐 아니라 새로고침 후에도 데이터가 남는지 확인하겠습니다."
                    />
                  </label>
                  <small>10자 이상 · 실제로 해볼 검사를 내 말로 남겨 주세요.</small>
                  <button className="primary-button" onClick={complete}>
                    학습 기록 마치기 <Check size={16} />
                  </button>
                </div>
                {r.completed && canComplete(m, r) && (
                  <div className="learn-completed" role="status">
                    <h3>직접 확인하는 연습을 마쳤어요.</h3>
                    <p>
                      예상, 관찰, 수정 요청과 검사 결과를 보관했습니다. 실습 완료는 실제 제품의
                      안전성이나 실력 인증을 뜻하지 않습니다.
                    </p>
                    <div>
                      {next && (
                        <Link className="primary-button" href={`/learn/${next.id}`}>
                          다음 미션 →
                        </Link>
                      )}
                      <Link className="secondary-button" href="/learn">
                        전체 학습 보기
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
      <aside className="learn-support">
        <button
          className="secondary-button"
          disabled={r.hints >= 3 || !c.ready}
          onClick={() => c.update((x) => ({ ...x, hints: Math.min(3, x.hints + 1) }))}
        >
          <Lightbulb size={16} />
          힌트 보기 {r.hints}/3
        </button>
        {r.hints > 0 && (
          <ol>
            {m.hint.slice(0, r.hints).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        )}
        <details>
          <summary>용어와 짧은 코드로 더 알아보기</summary>
          <h3>{m.concept}</h3>
          <p>{m.lesson}</p>
          <pre>
            <code>{m.code}</code>
          </pre>
          <p className="learn-fineprint">
            개념을 설명하는 코드입니다. 실제 제품에 그대로 붙여 넣는 구현은 아닙니다.
          </p>
        </details>
      </aside>
      <footer className="learn-fineprint">
        {session.signedIn ? "계정에 저장" : "게스트 연습실에 저장"} · 실제 네트워크나 계정에 영향을
        주지 않는 모의 실습입니다. <Link href="/quality">AI 검토 안내</Link>
      </footer>
    </main>
  );
}
