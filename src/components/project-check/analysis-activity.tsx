"use client";
import {
  generationSnapshot,
  generationServerSnapshot,
  subscribeGeneration,
} from "@/lib/generation-activity";
import { GenerationActivity } from "./generation-activity";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LoaderCircle, CheckCircle2, CircleAlert, X } from "lucide-react";
import { AppLink, Button } from "@/components/ui/primitives";
import {
  analysisSnapshot,
  analysisServerSnapshot,
  subscribeAnalysis,
  syncAnalysisSession,
  dismissAnalysis,
  refreshAnalysis,
} from "@/lib/project-analysis-tasks";
import { CancelAnalysis } from "./cancel-analysis";
export function AnalysisActivity() {
  const generations = useSyncExternalStore(
    subscribeGeneration,
    generationSnapshot,
    generationServerSnapshot,
  );
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tasks = useSyncExternalStore(subscribeAnalysis, analysisSnapshot, analysisServerSnapshot);
  useEffect(() => {
    void syncAnalysisSession();
    const refresh = () => void syncAnalysisSession();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [pathname]);
  const displayed = tasks.filter(
    (task) =>
      !(pathname === "/projects" && !searchParams.get("class") && task.status === "pending"),
  );
  if ((!displayed.length && !generations.length) || pathname === "/login") return null;
  return (
    <aside className="analysis-activity" aria-label="프로젝트 분석 상태">
      {displayed.map((task) => (
        <div className="analysis-activity-item" key={task.id}>
          <div className="analysis-activity-status" role="status" aria-atomic="true">
            {task.status === "pending" ? (
              <LoaderCircle size={18} className="analysis-spinner" aria-hidden="true" />
            ) : task.status === "done" ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <CircleAlert size={18} aria-hidden="true" />
            )}
            <div>
              <strong>
                {task.status === "pending"
                  ? "프로젝트 분석 중"
                  : task.status === "done"
                    ? "프로젝트 분석이 완료됐어요"
                    : task.status === "cancelled"
                      ? "분석을 중단했어요"
                      : "분석 상태 확인이 필요해요"}
              </strong>
              <span>{task.label}</span>
            </div>
          </div>
          {task.status === "pending" ? (
            <>
              <p>다른 화면을 이용해도 분석은 계속됩니다.</p>
              <CancelAnalysis task={task} />
            </>
          ) : task.status === "done" ? (
            <AppLink href={task.href} onClick={() => dismissAnalysis(task.id)}>
              분석 결과 보기 →
            </AppLink>
          ) : task.status === "cancelled" ? (
            <p>내 프로젝트에서 새 분석을 시작할 수 있습니다.</p>
          ) : (
            <>
              <p>{task.message}</p>
              <Button onClick={() => refreshAnalysis(task)}>상태 확인</Button>
              <AppLink href="/project-check">프로젝트 점검으로 이동 →</AppLink>
            </>
          )}
          {task.status !== "pending" && (
            <Button
              className="analysis-activity-dismiss"
              aria-label={`${task.label} 분석 알림 닫기`}
              onClick={() => dismissAnalysis(task.id)}
            >
              <X size={16} />
            </Button>
          )}
        </div>
      ))}
      <GenerationActivity />
    </aside>
  );
}
