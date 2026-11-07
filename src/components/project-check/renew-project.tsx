"use client";
import { startProjectAnalysis } from "@/lib/project-analysis-tasks";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/client-api";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import { useProjectDraft } from "@/hooks/use-project-draft";
import { Button, Card } from "@/components/ui/primitives";
import { AllowanceCost } from "./allowance-cost";

/**
 * Re-checks the same address as a new, separate project: a repository is read again at its latest
 * commit and a website at its current public screen. The earlier record is kept.
 */
export function RenewProject({
  check,
  scope,
  usage,
  aiReady = true,
  destination,
  disabled = false,
  queryKey = "check",
}: {
  check: Check;
  scope: string;
  /** Without it (screens that do not load the allowance) only the cost is stated. */
  usage?: CheckOverview["usage"]["analysis"];
  aiReady?: boolean;
  destination: string;
  disabled?: boolean;
  queryKey?: "check" | "class";
}) {
  const router = useRouter();
  const costId = useId();
  const source = check.page.repository ? "repository" : "website";
  const { draft, saveDraft, clearSavedDraft, storageError } = useProjectDraft(
    scope,
    `renew-${check.id}`,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const unavailable = !aiReady
    ? "지금은 새 AI 분석을 시작할 수 없습니다. 저장된 기록은 계속 볼 수 있습니다."
    : "";
  async function renew() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    const requestId = draft.requestId ?? crypto.randomUUID();
    saveDraft((d) => ({
      ...d,
      requestId,
      url: check.page.url,
      description: check.description,
      source,
    }));
    try {
      // The same background job as a new analysis: the global activity follows it elsewhere.
      const next = await startProjectAnalysis(
        { requestId, url: check.page.url, description: check.description, source },
        scope,
        `${destination}${destination.includes("?") ? "&" : "?"}${queryKey}=${requestId}`,
      );
      if (!controller.signal.aborted) {
        clearSavedDraft();
        router.push(`${destination}${destination.includes("?") ? "&" : "?"}${queryKey}=${next.id}`);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const insufficient = !!usage && usage.remaining < 1;
  return (
    <Card className="project-renew">
      <h3>{source === "repository" ? "최신 코드로 다시 점검" : "최신 화면으로 다시 점검"}</h3>
      <p>
        {source === "repository"
          ? "저장소를 다시 읽어 별도 프로젝트를 만듭니다. 지금의 질문, 답변과 학습 진도는 그대로 남습니다. 새 프로젝트에서 실습과 AI 워크숍을 다시 준비할 수 있습니다."
          : "같은 주소의 공개 화면을 다시 읽어 별도 프로젝트를 만듭니다. 지금의 질문, 답변과 평가는 그대로 남습니다. 보완 답변을 모두 사용한 뒤 바뀐 화면으로 다시 설명할 때 사용하세요."}
      </p>
      {usage ? (
        <AllowanceCost
          id={costId}
          label="분석 횟수"
          cost={1}
          remaining={usage.remaining}
          resetsAt={usage.resetsAt}
        />
      ) : (
        <p id={costId} className="allowance-cost">
          분석 횟수 1회 사용
        </p>
      )}
      {unavailable && <p className="project-help">{unavailable}</p>}
      <Button
        disabled={disabled || busy || insufficient || !aiReady}
        aria-describedby={costId}
        onClick={renew}
      >
        {busy
          ? "새 분석 진행 중…"
          : source === "repository"
            ? "최신 코드로 새로 점검"
            : "같은 주소로 다시 점검"}
      </Button>
      {busy && (
        <p className="project-help">
          분석은 백그라운드에서 계속되며, 끝나면 새 프로젝트를 엽니다. 다른 화면으로 이동해도
          됩니다.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {storageError && (
        <p role="status">
          브라우저에 재시도 정보를 저장하지 못했습니다. 이 화면에서 다시 시도해 주세요.
        </p>
      )}
    </Card>
  );
}
