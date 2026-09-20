"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch } from "lucide-react";
import { AppLink, Button, FieldLabel, Input } from "@/components/ui/primitives";
import { useProjectDraft } from "@/hooks/use-project-draft";
import { api, errorMessage } from "@/lib/client-api";
import type { CheckOverview } from "@/lib/project-check/types";
export function ProjectAiEntry() {
  const [scope, setScope] = useState<string>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    api<CheckOverview>("/api/project-check", { scope: null, signal: abort.signal })
      .then((v) => {
        setScope(v.scope);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorMessage(e));
      });
    return () => abort.abort();
  }, [revision]);
  return (
    <div className="project-ai-entry">
      {scope ? (
        <EntryForm key={scope} scope={scope} />
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
function EntryForm({ scope }: { scope: string }) {
  const { draft, saveDraft } = useProjectDraft(scope, "ai-workshop");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push("/learn/ai/project?new=1");
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
          내 프로젝트로 배우기 <ArrowRight size={17} />
        </Button>
      </div>
      <p className="muted">코드에서 확인한 AI와 새로 적용할 아이디어를 구분해 배워요.</p>
    </form>
  );
}
