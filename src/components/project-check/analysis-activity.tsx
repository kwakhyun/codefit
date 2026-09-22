"use client";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
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
export function AnalysisActivity() {
  const pathname = usePathname();
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
  if (!tasks.length || pathname === "/login") return null;
  return (
    <aside className="analysis-activity" aria-label="프로젝트 분석 상태">
      {tasks.map((task) => (
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
                    : "분석 상태 확인이 필요해요"}
              </strong>
              <span>{task.label}</span>
            </div>
          </div>
          {task.status === "pending" ? (
            <p>다른 화면을 이용해도 분석은 계속됩니다.</p>
          ) : task.status === "done" ? (
            <AppLink href={task.href} onClick={() => dismissAnalysis(task.id)}>
              분석 결과 보기 →
            </AppLink>
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
    </aside>
  );
}
