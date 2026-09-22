import { Anchor, Disclosure, DisclosureSummary } from "@/components/ui/primitives";
import { ChevronRight } from "lucide-react";
import { CodeExcerpt } from "@/components/project-check/project-repository";
import {
  repositoryCitation,
  repositoryEvidenceContext,
  type RepositorySnapshot,
} from "@/lib/project-check/repository";
export function PracticeSources({
  repository,
  evidence,
  expanded,
}: {
  repository: RepositorySnapshot;
  evidence: string[];
  expanded: boolean;
}) {
  const citations = evidence.flatMap((text) => {
    const citation = repositoryCitation(repository, text);
    return citation ? [citation] : [];
  });
  const paths = [...new Set(citations.map((c) => c.file.path))];
  return (
    <div className="practice-sources">
      {paths.map((path, index) => {
        const refs = citations.filter((c) => c.file.path === path);
        const file = refs[0].file;
        // Merge overlapping context from the same file instead of repeating three code blocks.
        const lines = repositoryEvidenceContext(file, refs, 3);
        return (
          <Disclosure
            key={path}
            className="repository-evidence"
            open={(expanded && index === 0) || undefined}
          >
            <DisclosureSummary>
              <ChevronRight size={18} aria-hidden="true" />
              <span>근거 코드: {path}</span>
            </DisclosureSummary>
            <CodeExcerpt file={{ ...file, lines }} />
            <div className="practice-origin">
              {[...new Set(refs.map((c) => c.url))].map((url) => (
                <Anchor key={url} href={url} target="_blank" rel="noreferrer">
                  {refs.find((c) => c.url === url)!.line}–{refs.find((c) => c.url === url)!.endLine}
                  줄 원본 ↗
                </Anchor>
              ))}
            </div>
          </Disclosure>
        );
      })}
    </div>
  );
}
