"use client";
import { useSyncExternalStore } from "react";
import { LoaderCircle, CheckCircle2, CircleAlert, X } from "lucide-react";
import { AppLink, Button } from "@/components/ui/primitives";
import {
  subscribeGeneration,
  generationSnapshot,
  generationServerSnapshot,
  dismissGeneration,
} from "@/lib/generation-activity";
export function GenerationActivity() {
  const tasks = useSyncExternalStore(
    subscribeGeneration,
    generationSnapshot,
    generationServerSnapshot,
  );
  if (!tasks.length) return null;
  return (
    <section className="generation-activity" aria-label="생성 작업 상태">
      {tasks.map((task) => (
        <div className="analysis-activity-item" key={task.id}>
          <div className="analysis-activity-status" role="status" aria-atomic="true">
            {task.status === "pending" ? (
              <LoaderCircle className="analysis-spinner" size={18} />
            ) : task.status === "done" ? (
              <CheckCircle2 size={18} />
            ) : (
              <CircleAlert size={18} />
            )}
            <div>
              <strong>{task.label}</strong>
              <span>
                {task.status === "pending"
                  ? "진행 중 · 완료되면 알려드려요"
                  : task.status === "done"
                    ? "완료됐어요"
                    : "완료하지 못했어요"}
              </span>
            </div>
          </div>
          {task.message && <p>{task.message}</p>}
          <AppLink
            href={task.href}
            onClick={() => {
              if (task.status !== "pending") dismissGeneration(task.id);
            }}
          >
            {task.status === "done" ? "결과 확인하기 →" : "작업 화면으로 이동 →"}
          </AppLink>
          {task.status !== "pending" && (
            <Button
              className="analysis-activity-dismiss"
              aria-label={`${task.label} 알림 닫기`}
              onClick={() => dismissGeneration(task.id)}
            >
              <X size={16} />
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
