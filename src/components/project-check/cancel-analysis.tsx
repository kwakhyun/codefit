"use client";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { cancelAnalysis, type AnalysisTask } from "@/lib/project-analysis-tasks";
import { errorMessage } from "@/lib/client-api";
export function CancelAnalysis({ task }: { task: AnalysisTask }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function stop() {
    setBusy(true);
    setError("");
    try {
      await cancelAnalysis(task);
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>분석 중단</Button>
      <Modal open={open} busy={busy} onClose={() => setOpen(false)} title="분석을 중단할까요?">
        <div className="class-edit">
          <p>
            <strong>{task.label}</strong>의 진행 중인 분석을 중단합니다. 다시 분석하려면 새 요청을
            시작해야 합니다.
          </p>
          <p className="muted">이미 AI 분석을 시작했다면 사용한 분석 횟수는 복구되지 않습니다.</p>
          {error && <p role="alert">{error}</p>}
          <div className="class-actions">
            <Button disabled={busy} onClick={() => setOpen(false)}>
              계속 분석
            </Button>
            <Button disabled={busy} onClick={() => void stop()}>
              {busy ? "중단 중…" : "분석 중단하기"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
