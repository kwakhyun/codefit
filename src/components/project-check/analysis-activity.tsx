"use client";
import {
  generationSnapshot,
  generationServerSnapshot,
  subscribeGeneration,
  isGenerationResultPage,
} from "@/lib/generation-activity";
import { GenerationActivity } from "./generation-activity";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LoaderCircle,
  CheckCircle2,
  CircleAlert,
  WifiOff,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppLink, Button } from "@/components/ui/primitives";
import {
  analysisSnapshot,
  analysisServerSnapshot,
  analysisState,
  subscribeAnalysis,
  syncAnalysisSession,
  dismissAnalysis,
  refreshAnalysis,
  isAnalysisShownOnPage,
  type AnalysisTask,
} from "@/lib/project-analysis-tasks";
import { CancelAnalysis } from "./cancel-analysis";
const titles = {
  running: "프로젝트 분석 중",
  done: "프로젝트 분석이 완료됐어요",
  cancelled: "분석을 중단했어요",
  input: "입력을 확인해 주세요",
  disconnected: "연결이 끊겼어요",
  failed: "분석하지 못했어요",
};
/** One state, one action: stop, open the result, fix the input, check again or start over. */
function AnalysisItem({ task }: { task: AnalysisTask }) {
  const state = analysisState(task);
  return (
    <div className="analysis-activity-item" data-state={state}>
      <div className="analysis-activity-status">
        {state === "running" ? (
          <LoaderCircle size={18} className="analysis-spinner" aria-hidden="true" />
        ) : state === "done" ? (
          <CheckCircle2 size={18} aria-hidden="true" />
        ) : state === "disconnected" ? (
          <WifiOff size={18} aria-hidden="true" />
        ) : (
          <CircleAlert size={18} aria-hidden="true" />
        )}
        <div>
          <strong>{titles[state]}</strong>
          <span>{task.label}</span>
        </div>
      </div>
      {state === "running" ? (
        <>
          <p>다른 화면을 이용해도 분석은 계속됩니다.</p>
          <CancelAnalysis task={task} />
        </>
      ) : state === "done" ? (
        <AppLink href={task.href} onClick={() => dismissAnalysis(task.id)}>
          분석 결과 보기 →
        </AppLink>
      ) : state === "cancelled" ? (
        <p>새 분석은 프로젝트 점검에서 다시 시작할 수 있습니다.</p>
      ) : state === "disconnected" ? (
        <>
          <p>
            응답을 받지 못했습니다. 서버에서는 분석이 계속될 수 있으며, 다시 확인해도 AI를 다시
            호출하지 않습니다.
          </p>
          <Button onClick={() => refreshAnalysis(task)}>분석 상태 다시 확인</Button>
        </>
      ) : (
        <>
          <p>{task.message}</p>
          <AppLink
            href="/project-check?new=1#project-register"
            onClick={() => dismissAnalysis(task.id)}
          >
            {state === "input" ? "입력 수정하기 →" : "새 분석 화면 열기 →"}
          </AppLink>
        </>
      )}
      {state !== "running" && (
        <Button
          className="analysis-activity-dismiss"
          aria-label={`${task.label} 분석 알림 닫기`}
          onClick={() => dismissAnalysis(task.id)}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
export function AnalysisActivity() {
  const generations = useSyncExternalStore(
    subscribeGeneration,
    generationSnapshot,
    generationServerSnapshot,
  );
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tasks = useSyncExternalStore(subscribeAnalysis, analysisSnapshot, analysisServerSnapshot);
  const search = searchParams.toString();
  // Small screens start as a chip so the list never covers the page content.
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 650px)").matches,
  );
  useEffect(() => {
    for (const task of tasks) {
      if (task.status === "done" && isGenerationResultPage(task.href, pathname, search))
        dismissAnalysis(task.id);
    }
  }, [tasks, pathname, search]);
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
  // A job the current page already shows (with its own action) is not repeated here.
  const displayed = tasks.filter(
    (task) =>
      !isAnalysisShownOnPage(task.id) &&
      !(pathname === "/projects" && !searchParams.get("class") && task.status === "pending"),
  );
  if ((!displayed.length && !generations.length) || pathname === "/login") return null;
  const states = displayed.map((task) => analysisState(task));
  const running =
    states.filter((state) => state === "running").length +
    generations.filter((task) => task.status === "pending").length;
  const attention =
    states.filter((state) => ["input", "disconnected", "failed"].includes(state)).length +
    generations.filter((task) => task.status === "failed").length;
  const done =
    states.filter((state) => state === "done").length +
    generations.filter((task) => task.status === "done").length;
  const summary = [
    running && `진행 중 ${running}`,
    attention && `확인 필요 ${attention}`,
    done && `완료 ${done}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <aside className="analysis-activity" data-collapsed={collapsed} aria-label="진행 중인 작업">
      {/* The only live region: item cards stay quiet so changes are announced once. */}
      <p className="sr-only" role="status" aria-atomic="true">
        {summary ? `작업 상태: ${summary}` : ""}
      </p>
      <Button
        className="analysis-activity-toggle"
        aria-expanded={!collapsed}
        aria-controls="analysis-activity-list"
        onClick={() => setCollapsed((value) => !value)}
      >
        {running > 0 && <LoaderCircle size={16} className="analysis-spinner" aria-hidden="true" />}
        <span>
          작업 {displayed.length + generations.length}개{summary ? ` · ${summary}` : ""}
        </span>
        {collapsed ? (
          <ChevronUp size={16} aria-hidden="true" />
        ) : (
          <ChevronDown size={16} aria-hidden="true" />
        )}
        <span className="sr-only">{collapsed ? "펼치기" : "접기"}</span>
      </Button>
      <div id="analysis-activity-list" className="analysis-activity-list" hidden={collapsed}>
        {displayed.map((task) => (
          <AnalysisItem key={task.id} task={task} />
        ))}
        <GenerationActivity />
      </div>
    </aside>
  );
}
