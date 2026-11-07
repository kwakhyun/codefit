"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch } from "lucide-react";
import { AppLink, Button, FieldLabel, Input } from "@/components/ui/primitives";
import { useProjectDraft } from "@/hooks/use-project-draft";
import { api, dateLabel, errorMessage } from "@/lib/client-api";
import { allowanceSummary } from "@/lib/ai-access";
import type { CheckOverview } from "@/lib/project-check/types";
import { requestWorkshopAnalysis, WORKSHOP_NEW_REPOSITORY_COST } from "./workshop-autostart";
export function ProjectAiEntry() {
  const [overview, setOverview] = useState<CheckOverview>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    api<CheckOverview>("/api/project-check", { scope: null, signal: abort.signal })
      .then((v) => {
        setOverview(v);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorMessage(e));
      });
    return () => abort.abort();
  }, [revision]);
  return (
    <div className="project-ai-entry">
      {overview ? (
        <EntryForm key={overview.scope} overview={overview} />
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <Button
            onClick={() => {
              setError("");
              setRevision((n) => n + 1);
            }}
          >
            다시 불러오기
          </Button>
        </div>
      ) : (
        <div className="screen-skeleton project-ai-entry-skeleton" role="status" aria-busy="true">
          <span className="skeleton-label">프로젝트 연결 준비 중</span>
          <div className="skeleton-content" aria-hidden="true">
            <div className="skeleton-shape skeleton-line is-short" />
            <div className="skeleton-shape skeleton-field" />
            <div className="skeleton-shape skeleton-line is-medium" />
          </div>
        </div>
      )}
      <AppLink href="/learn/ai/project">
        분석한 프로젝트에서 이어가기 <ArrowRight size={16} />
      </AppLink>
    </div>
  );
}
function EntryForm({ overview }: { overview: CheckOverview }) {
  const { draft, saveDraft } = useProjectDraft(overview.scope, "ai-workshop");
  const router = useRouter();
  const { remaining, resetsAt } = overview.usage.analysis;
  // A new repository needs an analysis and a workshop generation; check before leaving.
  const short = overview.aiReady && remaining < WORKSHOP_NEW_REPOSITORY_COST && !draft.requestId;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (short) return;
        // Submitting here is the cost confirmation; the workshop starts the analysis on arrival.
        if (overview.aiReady) requestWorkshopAnalysis(draft.url);
        router.push("/learn/ai/project");
      }}
    >
      <FieldLabel htmlFor="ai-project-url">
        <GitBranch size={16} /> 내 프로젝트 저장소 링크
      </FieldLabel>
      <div className="project-ai-input">
        <Input
          id="ai-project-url"
          type="url"
          required
          maxLength={1500}
          value={draft.url}
          placeholder="https://github.com/owner/repository"
          onChange={(e) => {
            const url = e.target.value;
            saveDraft((d) => ({ ...d, url, requestId: null }));
          }}
        />
        <Button
          type="submit"
          className="primary-button"
          disabled={!draft.url.trim() || short}
          aria-describedby={short ? "ai-project-allowance" : undefined}
        >
          저장소 분석하고 배우기 <ArrowRight size={17} />
        </Button>
      </div>
      <p className="muted">
        프로젝트에서 사용 중인 AI 기술을 배우고, 새로 활용할 방법도 살펴보세요.
      </p>
      {short ? (
        <div id="ai-project-allowance" className="project-ai-entry-blocked" role="status">
          <strong>분석 횟수가 부족해 새 저장소를 분석할 수 없어요</strong>
          <span>
            새 저장소로 내 프로젝트 AI 워크숍을 만들려면 분석 횟수 {WORKSHOP_NEW_REPOSITORY_COST}
            회가 필요하고, 지금 {remaining}회 남았어요.{" "}
            {resetsAt ? `${dateLabel(resetsAt)}에 다시 채워집니다. ` : ""}이미 분석한 프로젝트로
            이어가거나 전체 수업을 이용해 주세요.
          </span>
        </div>
      ) : (
        <p className="muted">
          {overview.aiReady
            ? `공개 코드 일부를 OpenAI로 보내 분석합니다. 새 분석과 AI 워크숍 생성에 분석 횟수 ${WORKSHOP_NEW_REPOSITORY_COST}회를 사용합니다 · 현재 ${remaining}회 남음 (${allowanceSummary("analysis")}).`
            : "AI 연결을 준비 중입니다. 저장소 링크는 보관되며, 기존 워크숍이나 일반 수업을 이용할 수 있습니다."}
        </p>
      )}
    </form>
  );
}
