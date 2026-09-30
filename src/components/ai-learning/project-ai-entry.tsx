"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch } from "lucide-react";
import { AppLink, Button, FieldLabel, Input } from "@/components/ui/primitives";
import { useProjectDraft } from "@/hooks/use-project-draft";
import { api, errorMessage } from "@/lib/client-api";
import type { CheckOverview } from "@/lib/project-check/types";
import { requestWorkshopAnalysis } from "./workshop-autostart";
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
  const remaining = overview.usage.analysis.remaining;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
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
        <Button type="submit" className="primary-button" disabled={!draft.url.trim()}>
          저장소 분석하고 배우기 <ArrowRight size={17} />
        </Button>
      </div>
      <p className="muted">
        프로젝트에서 사용 중인 AI 기술을 배우고, 새로 활용할 방법도 살펴보세요.
      </p>
      <p className="muted">
        {overview.aiReady
          ? `공개 코드 일부를 OpenAI로 보내 분석합니다. 새 분석 1회와 AI 학습 생성 1회를 사용합니다 · 현재 ${remaining}회 남음.`
          : "AI 연결을 준비 중입니다. 저장소 링크는 보관되며, 기존 학습이나 일반 수업을 이용할 수 있습니다."}
      </p>
    </form>
  );
}
