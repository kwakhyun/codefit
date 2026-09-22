"use client";
import { startProjectAnalysis } from "@/lib/project-analysis-tasks";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/client-api";
import type { Check } from "@/lib/project-check/types";
import { useProjectDraft } from "@/hooks/use-project-draft";
import { Button, Card } from "@/components/ui/primitives";
import { RequestStatus } from "./request-status";

export function RenewProject({
  check,
  scope,
  destination,
  disabled = false,
  queryKey = "check",
}: {
  check: Check;
  scope: string;
  destination: string;
  disabled?: boolean;
  queryKey?: "check" | "class";
}) {
  const router = useRouter();
  const { draft, saveDraft, clearSavedDraft, storageError } = useProjectDraft(
    scope,
    `renew-${check.id}`,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
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
      source: "repository",
    }));
    try {
      const next = await startProjectAnalysis(
        { requestId, url: check.page.url, description: check.description, source: "repository" },
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
  return (
    <Card className="project-renew">
      <h3>최신 코드로 새 학습 만들기</h3>
      <p>
        저장소를 다시 읽어 별도 점검 기록을 만듭니다. 지금의 질문, 답변과 학습 진도는 그대로
        남습니다. 새 기록에서 실습과 AI 학습을 준비할 수 있습니다.
      </p>
      <p className="muted">새 분석에 1회, 이후 실습 또는 AI 학습 준비에 각각 1회를 사용합니다.</p>
      <Button disabled={disabled || busy} onClick={renew}>
        최신 코드로 새로 점검
      </Button>
      {busy && <RequestStatus label="이전 기록을 보존하고 최신 코드를 분석하고 있습니다" />}
      {error && <p role="alert">{error}</p>}
      {storageError && (
        <p role="status">
          브라우저에 재시도 정보를 저장하지 못했습니다. 이 화면에서 다시 시도해 주세요.
        </p>
      )}
    </Card>
  );
}
