"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowRight, GitBranch, FlaskConical } from "lucide-react";
import { AppLink, Button, Card } from "@/components/ui/primitives";
import type { PracticeMode } from "@/lib/project-check/generated-practice";
import { useLearningOverview } from "@/hooks/use-learning-overview";
import { learningOverview, LEARNING_STAGES } from "@/lib/learn/overview";
import { MISSIONS } from "@/lib/learn/catalog";
import { api } from "@/lib/client-api";
import { HANDOFF_TRACKS } from "@/lib/handoff/catalog";
import { recommendedHandoff, type HandoffDashboard } from "@/lib/handoff/learning";
import { problemUrl } from "@/lib/library-state";

export type PracticeSource = "project" | "sample";
const NO_HASHES: readonly string[] = [];
function practiceSource(value: unknown): PracticeSource | undefined {
  return value === "sample" || value === "project" ? value : undefined;
}
const storageKey = (mode: PracticeMode) => `codefit:practice-source:${mode}`;
const sampleUrl = (mode: PracticeMode) => (mode === "code" ? "/handoff" : "/learn");
const subscribe = (listener: () => void) => {
  window.addEventListener("storage", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("hashchange", listener);
  };
};
/** The last tab chosen in this browser, or the sample tab when the URL points into it. */
function rememberedSource(mode: PracticeMode, sampleHashes: readonly string[]) {
  if (sampleHashes.includes(window.location.hash.slice(1))) return "sample";
  try {
    return practiceSource(localStorage.getItem(storageKey(mode))) ?? null;
  } catch {
    return null;
  }
}

/**
 * Project practice is the default for first visits. `?source=sample|project` selects a tab and
 * is kept in the address bar; without it the browser's last choice is used.
 */
export function PracticeEntry({
  mode,
  children,
  initialSource,
  sampleHashes = NO_HASHES,
}: {
  mode: PracticeMode;
  children: ReactNode;
  /** From `?source=`; overrides the remembered tab. */
  initialSource?: PracticeSource;
  /** Anchors that only exist on the sample tab, e.g. `labs` for `/learn#labs`. */
  sampleHashes?: readonly string[];
}) {
  const remembered = useSyncExternalStore(
    subscribe,
    () => rememberedSource(mode, sampleHashes),
    () => null,
  );
  const [chosen, setChosen] = useState<PracticeSource | undefined>(initialSource);
  const source = chosen ?? remembered ?? "project";
  const sample = source === "sample";
  function choose(next: PracticeSource) {
    setChosen(next);
    try {
      localStorage.setItem(storageKey(mode), next);
    } catch {
      /* The address bar still keeps the choice. */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("source", next);
    if (next === "project") url.hash = "";
    window.history.replaceState(null, "", url);
  }
  const hashes = sampleHashes.join(" ");
  useEffect(() => {
    // Content behind the sample tab renders after the browser's own anchor scroll.
    const id = window.location.hash.slice(1);
    if (sample && id && hashes.split(" ").includes(id))
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [sample, hashes]);
  return (
    <div className="practice-entry">
      {mode === "code" ? (
        <HandoffProgress onOpen={() => choose("sample")} sample={sample} />
      ) : (
        <MissionProgress onOpen={() => choose("sample")} sample={sample} />
      )}
      <div className="practice-origin segmented" role="group" aria-label="연습 자료 선택">
        <Button aria-pressed={!sample} onClick={() => choose("project")}>
          <GitBranch size={18} /> 내 프로젝트로 연습
        </Button>
        <Button aria-pressed={sample} onClick={() => choose("sample")}>
          <FlaskConical size={18} /> 샘플로 체험
        </Button>
      </div>
      {sample ? (
        <div className="practice-samples">
          <p className="muted">
            저장소 연결 없이 제공된 예제로 연습합니다. 내 프로젝트 코드와는 별개의 학습입니다.
          </p>
          {children}
        </div>
      ) : (
        <Card className="practice-entry-card">
          <span className="eyebrow">내 프로젝트 코드로 만드는 맞춤 연습</span>
          <h2>
            {mode === "code"
              ? "내 프로젝트의 코드를 설명할 수 있나요?"
              : "내 서비스가 이 상황에서는 어떻게 동작할까요?"}
          </h2>
          <p>
            {mode === "code"
              ? "실제 파일을 읽고 입력이 어떤 처리 과정을 거치는지 예상해 보세요. 코드 근거와 해설을 비교하며 이해를 점검합니다."
              : "내 코드와 연결된 정상 동작과 실패 상황을 모의 실습합니다. 어떤 조건에서 결과가 달라지는지 비교하고, 실제 서비스에서 확인할 일을 정리하세요."}
          </p>
          <ol>
            <li>공개 저장소 연결 또는 분석 기록 선택</li>
            <li>코드 이해 3개와 서비스 동작 3개 생성</li>
            <li>예상, 모의 결과, 내 프로젝트 확인 순서로 연습</li>
          </ol>
          <AppLink className="primary-button" href={`/project-practice?mode=${mode}`}>
            내 프로젝트로 시작하기 <ArrowRight size={18} />
          </AppLink>
          <p className="muted">
            코드를 실행하거나 저장소를 수정하지 않습니다. 저장된 연습은 추가 AI 호출 없이 이어갈 수
            있습니다.
          </p>
        </Card>
      )}
    </div>
  );
}

/** A compact row shown above the tabs once there is sample progress to resume. */
function ProgressRow({
  label,
  count,
  detail,
  href,
  action,
  sample,
  onOpen,
}: {
  label: string;
  count: string;
  detail: string;
  href: string;
  action: string;
  sample: boolean;
  onOpen: () => void;
}) {
  return (
    <section className="practice-progress" aria-label={label}>
      <div>
        <span className="eyebrow">{label}</span>
        <strong>{count}</strong>
        <span className="muted">{detail}</span>
      </div>
      <AppLink className="secondary-button" href={href}>
        {action} <ArrowRight size={16} aria-hidden="true" />
      </AppLink>
      {!sample && (
        <Button className="text-button" onClick={onOpen}>
          샘플 기록 보기
        </Button>
      )}
    </section>
  );
}

function MissionProgress({ sample, onOpen }: { sample: boolean; onOpen: () => void }) {
  const { data } = useLearningOverview();
  if (!data) return null;
  const { resume, next, complete } = learningOverview(data.progress);
  if (!resume && !complete) return null;
  return (
    <ProgressRow
      label="샘플 미션 진행"
      count={`${complete}/${MISSIONS.length} 미션 완료`}
      detail={
        resume
          ? `${resume.mission.title} · ${resume.record.stage + 1}/4단계 ${LEARNING_STAGES[resume.record.stage]}`
          : complete === MISSIONS.length
            ? "모든 미션을 마쳤어요."
            : `다음 미션: ${next.mission.title}`
      }
      href={
        resume || complete < MISSIONS.length
          ? `/learn/${next.mission.id}`
          : `${sampleUrl("service")}?source=sample`
      }
      action={
        resume ? "이어하기" : complete < MISSIONS.length ? "다음 미션 시작" : "미션 다시 보기"
      }
      sample={sample}
      onOpen={onOpen}
    />
  );
}

function HandoffProgress({ sample, onOpen }: { sample: boolean; onOpen: () => void }) {
  const [data, setData] = useState<HandoffDashboard | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<HandoffDashboard>("/api/handoff", { signal: controller.signal, track: false })
      .then(setData)
      .catch(() => {
        /* The dashboard on the sample tab reports load errors. */
      });
    return () => controller.abort();
  }, []);
  if (!data) return null;
  const total = HANDOFF_TRACKS.length * 2;
  const reviewed =
    data.learning.filter((t) => t.base).length + data.learning.filter((t) => t.transfer).length;
  if (!reviewed && !data.learning.some((t) => t.next.priority === 0)) return null;
  const next = recommendedHandoff(data.learning).next;
  return (
    <ProgressRow
      label="샘플 코드 이해 훈련 진행"
      count={`${reviewed}/${total} 과제 검토`}
      detail={next.reason}
      href={problemUrl(next.problemId, `${sampleUrl("code")}?source=sample`)}
      action={next.label}
      sample={sample}
      onOpen={onOpen}
    />
  );
}
export function ProjectPracticeLinks({ id }: { id: string }) {
  return (
    <Card className="practice-entry-card">
      <h2>이 프로젝트로 직접 연습하기</h2>
      <p>
        분석한 코드에서 맞춤 문제를 만들고, 처리 흐름과 서비스 동작을 이해해 보세요. 점검 질문에
        모두 답하지 않아도 시작할 수 있습니다.
      </p>
      <div className="practice-origin">
        <AppLink className="primary-button" href={`/project-practice?check=${id}&mode=code`}>
          코드 이해 훈련 <ArrowRight size={16} />
        </AppLink>
        <AppLink className="secondary-button" href={`/project-practice?check=${id}&mode=service`}>
          서비스 동작 실습 <ArrowRight size={16} />
        </AppLink>
      </div>
    </Card>
  );
}
