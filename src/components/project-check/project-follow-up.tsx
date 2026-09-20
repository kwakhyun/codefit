"use client";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { practiceSchema, type Check, type ProjectPractice } from "@/lib/project-check/types";
export function ProjectFollowUp({
  check,
  scope,
  onRevised,
  onSaved,
}: {
  check: Check;
  scope: string;
  onRevised: (check: Check) => void;
  onSaved: (practice: ProjectPractice) => void;
}) {
  const key = `codefit-follow-up:${scope}:${check.id}`;
  const [practice, setPractice] = useState<ProjectPractice>(() => {
    const saved = check.review?.practice ?? {
      revision: 0,
      tasks: Array.from({ length: 5 }, (_, questionIndex) => ({
        questionIndex,
        status: "planned" as const,
        result: "",
      })),
    };
    try {
      const draft = practiceSchema.safeParse(JSON.parse(sessionStorage.getItem(key) || "null"));
      if (draft.success && draft.data.revision === saved.revision) return draft.data;
    } catch {}
    return saved;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const active = useRef(false);
  const alive = useRef(true);
  const revisionId = useRef("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function change(questionIndex: number, patch: Partial<ProjectPractice["tasks"][number]>) {
    const next = {
      ...practice,
      tasks: practice.tasks.map((t) =>
        t.questionIndex === questionIndex ? { ...t, ...patch } : t,
      ),
    };
    setPractice(next);
    setMessage("아직 서버에 저장하지 않은 변경이 있습니다.");
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      setError("이 탭에 초안을 보관하지 못했습니다. 기록 저장을 눌러 주세요.");
    }
  }
  async function save() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await api<ProjectPractice>(`/api/project-check/${check.id}/follow-up`, {
        method: "PATCH",
        scope,
        body: practice,
      });
      if (!alive.current) return;
      setPractice(saved);
      onSaved(saved);
      try {
        sessionStorage.removeItem(key);
      } catch {}
      setMessage("확인 기록을 서버에 저장했습니다. AI 평가 횟수는 사용하지 않았습니다.");
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      active.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function revise() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    if (!revisionId.current) {
      try {
        revisionId.current = sessionStorage.getItem(`${key}:revision`) || "";
      } catch {}
      if (!revisionId.current) revisionId.current = crypto.randomUUID();
      try {
        sessionStorage.setItem(`${key}:revision`, revisionId.current);
      } catch {}
    }
    try {
      const result = await api<Check>(`/api/project-check/${check.id}/follow-up`, {
        method: "POST",
        scope,
        body: { requestId: revisionId.current },
      });
      if (alive.current) onRevised(result);
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      active.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!check.review) return null;
  return (
    <section id="project-follow-up" className="project-panel">
      <span className="eyebrow">내 프로젝트에서 이어서 확인</span>
      <h2>피드백을 실제 확인 기록으로 남기세요</h2>
      <p>
        이번 답변의 부족한 부분과 연결된 과제입니다. 내 프로젝트에서 직접 확인한 조건, 기대 결과와
        실제 결과를 적어 보세요. 모르는 부분은 미확인으로 남겨도 됩니다.
      </p>
      <p className="project-help">
        자기 기록이며 자동 검증 결과가 아닙니다. 비밀키, 계정 정보, 사용자 데이터는 적지 마세요.
        저장한 기록은 자동으로 AI에 전송하지 않습니다.
      </p>
      {[...check.review.assessment.feedback]
        .sort((a, b) => a.level - b.level)
        .map((f, i) => {
          const task = practice.tasks.find((t) => t.questionIndex === f.questionIndex)!;
          return (
            <details key={f.questionIndex} open={i === 0} className="project-feedback">
              <summary>
                {check.analysis.questions[f.questionIndex].area} —{" "}
                {task.status === "observed"
                  ? "확인 결과 작성함"
                  : task.status === "blocked"
                    ? "확인하지 못함"
                    : "확인 예정"}
              </summary>
              <p>{f.feedback}</p>
              <strong>이번 프로젝트의 확인 과제</strong>
              <p>{f.nextStep}</p>
              <label htmlFor={`task-status-${f.questionIndex}`}>확인 상태</label>{" "}
              <select
                id={`task-status-${f.questionIndex}`}
                value={task.status}
                disabled={busy}
                onChange={(e) =>
                  change(f.questionIndex, { status: e.target.value as typeof task.status })
                }
              >
                <option value="planned">확인 예정</option>
                <option value="observed">확인 결과 작성함</option>
                <option value="blocked">확인하지 못함</option>
              </select>
              <label htmlFor={`task-result-${f.questionIndex}`}>계획과 실제 결과</label>
              <textarea
                id={`task-result-${f.questionIndex}`}
                rows={4}
                maxLength={2000}
                value={task.result}
                disabled={busy}
                onChange={(e) => change(f.questionIndex, { result: e.target.value })}
                placeholder="확인한 조건과 순서 / 기대한 결과 / 실제 결과 또는 확인하지 못한 이유"
                style={{ width: "100%" }}
              />
            </details>
          );
        })}
      <button className="secondary-button" disabled={busy} onClick={() => void save()}>
        {busy ? "처리 중…" : "확인 기록 저장"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="project-error">
          {error}
        </p>
      )}
      <hr />
      <h3>확인한 내용으로 답변을 보완해 보세요</h3>
      <p>
        기존 답변과 평가는 보관하고, 같은 질문의 새 답변을 작성합니다. 이전 설명을 불러오며 평가 후
        달라진 부분을 비교할 수 있습니다.
      </p>
      <button
        className="primary-button"
        disabled={busy || (check.revisionNumber ?? 0) >= 3}
        onClick={() => void revise()}
      >
        같은 질문에 보완 답변 작성 →
      </button>
      <p className="project-help">
        질문을 다시 생성하지 않습니다. 보완 답변의 AI 평가를 요청할 때 평가 1회를 사용합니다. 동일
        질문은 최대 3번 보완할 수 있습니다.
      </p>
    </section>
  );
}
