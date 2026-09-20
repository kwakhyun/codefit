"use client";
import { useRef, useState } from "react";
import { ArrowRight, Check, Code2, GitBranch, Workflow, ClipboardCheck } from "lucide-react";
import { errorMessage } from "@/lib/client-api";
import type { Check as ProjectCheck } from "@/lib/project-check/types";
import { prepareProjectLearning } from "@/lib/project-check/quick-start";
import { useProjectDraft } from "@/hooks/use-project-draft";
import { AppLink, Button, Card, FieldLabel, Input } from "@/components/ui/primitives";
import { RequestStatus } from "@/components/project-check/request-status";
export function ProjectQuickStart({
  scope,
  embedded = false,
}: {
  scope: string;
  embedded?: boolean;
}) {
  const { draft, saveDraft, storageError } = useProjectDraft(scope, "project-start");
  const [busy, setBusy] = useState<"analysis" | "practice" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ check: ProjectCheck; ready: boolean }>();
  const lock = useRef(false);
  async function start(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setError("");
    setBusy("analysis");
    const id = draft.requestId || crypto.randomUUID();
    saveDraft((current) => ({ ...current, requestId: id }));
    try {
      const check = await prepareProjectLearning({ id, url: draft.url, scope }, (record) => {
        setResult({ check: record, ready: false });
        setBusy("practice");
      });
      setResult({ check, ready: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }
  return (
    <Card
      as={embedded ? "div" : "section"}
      className={`project-quick-start${embedded ? " quick-start-embedded" : ""}`}
      aria-label="저장소 링크로 점검과 연습 시작"
    >
      {!embedded && (
        <div className="quick-start-heading">
          <span className="eyebrow">
            <GitBranch size={16} /> 내 프로젝트에서 시작하세요
          </span>
          <h2>링크 하나로 점검부터 실습까지</h2>
          <p>
            공개 소스 저장소를 연결하면{" "}
            <strong>프로젝트 점검, 코드 이해 훈련, 서비스 원리 실습</strong>을 함께 준비합니다.
          </p>
        </div>
      )}
      <form onSubmit={start}>
        <FieldLabel htmlFor="home-project-url">공개 소스 저장소 링크</FieldLabel>
        <div className="quick-start-input">
          <Input
            id="home-project-url"
            type="url"
            required
            maxLength={1500}
            placeholder="https://github.com/owner/repository"
            value={draft.url}
            disabled={!!busy}
            onChange={(e) => {
              const url = e.target.value;
              saveDraft((current) => ({ ...current, url, requestId: null }));
              setResult(undefined);
              setError("");
            }}
          />
          <Button type="submit" className="primary-button" disabled={!!busy || !draft.url.trim()}>
            {busy
              ? "준비 중…"
              : result?.ready
                ? "저장된 결과 확인"
                : result
                  ? "이어서 준비하기"
                  : "점검과 연습 시작"}
            <ArrowRight size={18} />
          </Button>
        </div>
        {embedded ? (
          <div className="quick-start-note">
            <p>로그인 없이 시작할 수 있어요. 새 프로젝트는 분석 2회를 사용합니다.</p>
            <details>
              <summary>분석 범위와 데이터 안내</summary>
              <p>
                공개 코드 일부를 OpenAI로 보내 질문과 연습을 만듭니다. 저장소를 실행하거나 수정하지
                않습니다. 생성한 연습은 추가 AI 호출 없이 이어갈 수 있습니다.
              </p>
            </details>
          </div>
        ) : (
          <p className="muted">
            공개 코드 발췌를 OpenAI로 보내 분석합니다. 새 프로젝트는 분석 2회를 사용하며, 생성
            이후에는 무료로 이어갑니다. 실제 저장소를 실행하거나 수정하지 않습니다.
          </p>
        )}
      </form>
      {!embedded && (
        <div className="quick-start-outcomes" aria-label="한 번 연결하면 준비되는 학습">
          <span>
            <ClipboardCheck size={20} /> 설계 질문 5개
          </span>
          <span>
            <Code2 size={20} /> 내 코드 이해 훈련 3개
          </span>
          <span>
            <Workflow size={20} /> 서비스 동작 실습 3개
          </span>
        </div>
      )}
      {storageError && (
        <p role="status">
          이 브라우저에 입력을 보관하지 못했습니다. 분석 결과는 서버 기록에서 찾을 수 있습니다.
        </p>
      )}
      {busy && (
        <RequestStatus
          label={
            busy === "analysis"
              ? "1/2 저장소를 읽고 프로젝트 질문을 만드는 중"
              : "2/2 내 코드에 맞는 두 가지 실습을 만드는 중"
          }
        />
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className="quick-start-results" aria-live="polite">
          <strong>
            <Check size={18} />
            {result.ready
              ? "세 가지 학습이 준비됐어요. 원하는 곳부터 시작하세요."
              : "프로젝트 점검이 저장됐어요. 먼저 질문을 볼 수 있습니다."}
          </strong>
          <div className="practice-origin">
            <AppLink href={`/project-check?check=${result.check.id}`} className="primary-button">
              프로젝트 점검
            </AppLink>
            <AppLink href={`/project-practice?check=${result.check.id}&mode=code`}>
              코드 이해 훈련
            </AppLink>
            <AppLink href={`/project-practice?check=${result.check.id}&mode=service`}>
              서비스 원리 실습
            </AppLink>
          </div>
        </div>
      )}
      <div className="quick-start-alternatives">
        <AppLink href="/project-check">서비스 주소로 점검하기 →</AppLink>
        <AppLink href="/project-practice">기존 기록 이어보기 →</AppLink>
        {!embedded && <AppLink href="/handoff?source=sample">연결 없이 샘플로 체험 →</AppLink>}
      </div>
    </Card>
  );
}
