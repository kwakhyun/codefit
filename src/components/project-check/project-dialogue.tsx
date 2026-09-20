"use client";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Textarea,
  Status,
} from "@/components/ui/primitives";
import type { Check } from "@/lib/project-check/types";
import type { ProjectDialogue } from "@/lib/project-check/dialogue";
import { api, errorMessage } from "@/lib/client-api";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { SourceEvidence } from "./project-repository";
import { RequestStatus } from "./request-status";
export function ProjectCodeDialogue({
  check,
  index,
  answer,
  scope,
  enabled,
  onUsage,
  readOnly = false,
  remaining,
}: {
  check: Check;
  index: number;
  answer: string;
  scope: string;
  enabled: boolean;
  readOnly?: boolean;
  remaining?: number;
  onUsage?: () => Promise<void>;
}) {
  const [dialogue, setDialogue] = useState<ProjectDialogue | null>(null);
  const [lastUseOpen, setLastUseOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true),
    active = useRef(false);
  const url = `/api/project-check/${check.id}/dialogue`;
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    api<ProjectDialogue | null>(`${url}?question=${index}`, { scope, signal: controller.signal })
      .then((value) => {
        if (alive.current) {
          setDialogue(value);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(e));
          setLoading(false);
        }
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [url, index, scope]);
  async function reload() {
    setError("");
    try {
      const saved = await api<ProjectDialogue | null>(`${url}?question=${index}`, { scope });
      if (alive.current) setDialogue(saved);
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    }
  }
  async function send() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await api<ProjectDialogue>(url, {
        method: "POST",
        scope,
        body: {
          questionIndex: index,
          answer: dialogue ? reply : answer,
          ...(dialogue ? { previousId: dialogue.id } : {}),
        },
        signal: AbortSignal.timeout(90_000),
      });
      if (alive.current) {
        setDialogue(saved);
        setReply("");
      }
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      active.current = false;
      if (alive.current) setBusy(false);
      try {
        await onUsage?.();
      } catch {
        /* Stored replies remain available even if the quota refresh fails. */
      }
    }
  }
  if (!check.page.repository || (readOnly && !loading && !dialogue && !error)) return null;
  const last = dialogue?.turns.at(-1)?.reply;
  const finished = !!dialogue && (dialogue.turns.length >= 3 || !last?.nextQuestion);
  return (
    <Disclosure className="project-code-dialogue">
      <Modal
        open={lastUseOpen}
        onClose={() => setLastUseOpen(false)}
        title="남은 평가 1회를 어디에 사용할까요?"
      >
        <p>
          코드 대화에 사용하면 전체 답변 평가는 이용 횟수가 다시 채워진 뒤에 받을 수 있습니다. 지금
          작성한 답변은 유지됩니다.
        </p>
        <div className="ui-dialog-actions">
          <Button onClick={() => setLastUseOpen(false)}>전체 평가를 위해 남겨두기</Button>
          <Button
            onClick={() => {
              setLastUseOpen(false);
              void send();
            }}
          >
            코드 대화에 1회 사용
          </Button>
        </div>
      </Modal>
      <DisclosureSummary>
        {readOnly ? "저장된 코드 대화 보기" : "이 답변을 코드와 함께 확인하기"}{" "}
        {!readOnly && <span>선택</span>}
      </DisclosureSummary>
      {!readOnly && (
        <p className="project-help">
          지금 적은 답변에서 코드와 맞는 부분과 더 확인할 부분을 알려드려요. 대화 한 번에 답변 평가
          1회를 사용합니다. 질문마다 최대 3번 대화할 수 있습니다.
        </p>
      )}
      {loading && <ScreenSkeleton variant="response" label="이전 코드 대화를 불러오는 중…" />}
      {dialogue?.turns.map((turn, i) => (
        <section className="project-dialogue-turn" key={i}>
          <strong>내 설명 {i + 1}</strong>
          <p>{turn.answer}</p>
          <strong>
            {
              {
                supported: "코드와 맞는 부분",
                uncertain: "더 확인할 부분",
                conflict: "다시 살펴볼 부분",
              }[turn.reply.alignment]
            }
          </strong>
          <p>{turn.reply.explanation}</p>
          <SourceEvidence repository={check.page.repository!} evidence={turn.reply.codeEvidence} />
          <p>
            <strong>직접 확인할 일</strong>
            <br />
            {turn.reply.nextAction}
          </p>
        </section>
      ))}
      {last?.nextQuestion && !finished && !readOnly && (
        <>
          <FieldLabel htmlFor={`dialogue-${index}`}>{last.nextQuestion}</FieldLabel>
          <Textarea
            id={`dialogue-${index}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={1500}
            disabled={busy}
          />
        </>
      )}
      {readOnly ? null : finished ? (
        <Status role="status">
          이 질문의 대화를 마쳤습니다. 확인한 내용을 위의 설계 답변에 반영한 뒤 전체 평가를
          받아보세요.
        </Status>
      ) : (
        <Button
          className="secondary-button"
          onClick={() => (remaining === 1 ? setLastUseOpen(true) : void send())}
          disabled={loading || busy || !enabled || !(dialogue ? reply : answer).trim()}
        >
          {busy ? "코드와 비교하는 중…" : dialogue ? "이어서 답하기" : "코드와 비교해 피드백 받기"}
        </Button>
      )}
      {!readOnly && !dialogue && !answer.trim() && (
        <p className="project-help">먼저 위의 ‘내 설계 설명’을 작성해 주세요.</p>
      )}
      {busy && <RequestStatus label="코드 근거를 확인하고 있습니다" />}
      {error && <Status role="alert">{error}</Status>}
      <Button className="text-button" onClick={() => void reload()} disabled={busy}>
        이전 대화 불러오기
      </Button>
    </Disclosure>
  );
}
