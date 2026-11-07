"use client";
import {
  Card,
  Button,
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  NativeSelect,
  Textarea,
  Status,
} from "@/components/ui/primitives";
import { useEffect, useRef, useState } from "react";
import {
  projectReportMarkdown,
  projectReportText,
  verificationTemplate,
} from "@/lib/project-check/report";
import { ExportButtons } from "./export-buttons";
import { api, errorMessage } from "@/lib/client-api";
import { practiceSchema, type Check, type ProjectPractice } from "@/lib/project-check/types";
import { VerificationRecord } from "./verification-record";
import { RepairRequest } from "./project-evidence-review";
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
  const [dirty, setDirty] = useState(() => {
    try {
      return !!sessionStorage.getItem(key);
    } catch {
      return false;
    }
  });
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
    setDirty(true);
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
      setDirty(false);
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
  // Revisions belong to one root: the timeline counts the root (0) and each revision.
  const used = Math.max(
    check.revisionNumber ?? 0,
    (check.revisionTimeline?.length ?? 1) - 1,
    check.revisions?.length ?? 0,
  );
  const revisionLimit =
    used >= 3
      ? "같은 질문은 3번까지 보완할 수 있어 모두 사용했습니다. 바뀐 내용은 아래 ‘프로젝트 관리’에서 다시 점검해 새 프로젝트로 설명해 보세요."
      : "";
  return (
    <Card as="section" id="project-follow-up" className="project-panel">
      <span className="eyebrow">확인하고 보완하기</span>
      <h2>확인 기록과 수정 요청</h2>
      <p>
        이번 답변의 부족한 부분과 연결된 과제입니다. 내 프로젝트에서 직접 확인한 조건, 기대 결과와
        실제 결과를 적어 보세요. 모르는 부분은 미확인으로 남겨도 됩니다.
      </p>
      <p className="project-help">
        자기 기록이며 자동 검증 결과가 아닙니다. 비밀키, 계정 정보, 사용자 데이터는 적지 마세요.
        저장한 기록은 자동으로 AI에 전송하지 않습니다.
      </p>
      <div className="project-task-toolbar">
        <span>
          확인 결과 작성 {practice.tasks.filter((t) => t.status === "observed").length} / 5
        </span>
        <ExportButtons
          label="확인 계획과 AI 수정 요청 내보내기"
          fileName="codefit-project-review"
          markdown={() => projectReportMarkdown(check, practice, dirty)}
          text={() => projectReportText(check, practice)}
          note={
            dirty
              ? "서버에 저장하지 않은 확인 기록 초안도 함께 내보냅니다. 공유 전에 내용을 확인하세요."
              : "질문, 답변, 평가, 확인 계획과 저장한 확인 기록을 내보냅니다."
          }
        />
      </div>
      {[...check.review.assessment.feedback]
        .sort((a, b) => Number(!!b.blockingIssue) - Number(!!a.blockingIssue) || a.level - b.level)
        .map((f, i) => {
          const task = practice.tasks.find((t) => t.questionIndex === f.questionIndex)!;
          return (
            <Disclosure key={f.questionIndex} open={i === 0} className="project-feedback">
              <DisclosureSummary>
                {check.analysis.questions[f.questionIndex].area} —{" "}
                {task.status === "observed"
                  ? "확인 결과 작성함"
                  : task.status === "blocked"
                    ? "확인하지 못함"
                    : "확인 예정"}
              </DisclosureSummary>
              <p>{f.feedback}</p>
              <strong>이번 프로젝트의 확인 과제</strong>
              <p>{f.nextStep}</p>
              {f.verificationPlan && (
                <Disclosure className="verification-plan">
                  <DisclosureSummary>단계별 확인 방법 보기</DisclosureSummary>
                  <p>
                    <strong>확인할 목표</strong>
                    <br />
                    {f.verificationPlan.goal}
                  </p>
                  <p>
                    <strong>준비</strong> {f.verificationPlan.preparation}
                  </p>
                  <ol>
                    {f.verificationPlan.steps.map((step, index) => (
                      <li key={index}>
                        <strong>{step.action}</strong>
                        <p>기대 결과: {step.expected}</p>
                      </li>
                    ))}
                  </ol>
                  <p>
                    <strong>남길 근거</strong> {f.verificationPlan.completion}
                  </p>
                  <small>
                    AI가 제안한 계획입니다. 실제 구현에 맞춰 조정하고 테스트 자료로 확인하세요.
                  </small>
                </Disclosure>
              )}
              <Button
                className="secondary-button"
                disabled={busy || !!task.result.trim()}
                onClick={() =>
                  change(f.questionIndex, { result: verificationTemplate(check, f.questionIndex) })
                }
              >
                빈 기록에 확인 양식 채우기
              </Button>
              <FieldLabel htmlFor={`task-status-${f.questionIndex}`}>확인 상태</FieldLabel>{" "}
              <NativeSelect
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
              </NativeSelect>
              <FieldLabel htmlFor={`task-result-${f.questionIndex}`}>계획과 실제 결과</FieldLabel>
              <Textarea
                id={`task-result-${f.questionIndex}`}
                rows={4}
                maxLength={4000}
                value={task.result}
                disabled={busy}
                onChange={(e) => change(f.questionIndex, { result: e.target.value })}
                placeholder="확인한 조건과 순서 / 기대한 결과 / 실제 결과 또는 확인하지 못한 이유"
                style={{ width: "100%" }}
              />
              <VerificationRecord
                value={task.verification}
                disabled={busy}
                onChange={(verification) => change(f.questionIndex, { verification })}
              />
              <RepairRequest check={check} questionIndex={f.questionIndex} practice={practice} />
            </Disclosure>
          );
        })}
      <Button className="secondary-button" disabled={busy} onClick={() => void save()}>
        {busy ? "처리 중…" : "확인 기록 저장"}
      </Button>
      {message && <Status role="status">{message}</Status>}
      {error && (
        <Status role="alert" className="project-error">
          {error}
        </Status>
      )}
      <hr />
      <h3>확인한 내용으로 답변을 보완해 보세요</h3>
      <p>
        기존 답변과 평가는 보관하고, 같은 질문의 새 답변을 작성합니다. 이전 설명을 불러오며 평가 후
        달라진 부분을 비교할 수 있습니다.
      </p>
      <Button
        className="primary-button"
        disabled={busy || !!revisionLimit}
        aria-describedby="project-revise-help"
        onClick={() => void revise()}
      >
        같은 질문에 보완 답변 작성 →
      </Button>
      <p id="project-revise-help" className="project-help">
        {revisionLimit ||
          `질문을 다시 생성하지 않으며 준비에는 AI를 사용하지 않습니다. 보완 답변의 평가를 요청할 때 평가 횟수 1회를 사용합니다. 같은 질문은 최대 3번 보완할 수 있으며 ${used}번 사용했습니다.`}
      </p>
    </Card>
  );
}
