"use client";
import { useState } from "react";
import { GitBranch, FileCode2, ArrowRight, ExternalLink } from "lucide-react";
import {
  Button,
  Disclosure,
  DisclosureSummary,
  Anchor,
  NativeSelect,
} from "@/components/ui/primitives";
import {
  repositoryCitation,
  repositoryEvidenceContext,
  type RepositorySnapshot,
  type RepositoryFile,
} from "@/lib/project-check/repository";
export function CodeExcerpt({
  file,
  focus,
  end = focus,
}: {
  file: RepositoryFile;
  focus?: number;
  end?: number;
}) {
  const lines = focus
    ? repositoryEvidenceContext(file, [{ line: focus, endLine: end ?? focus }])
    : file.lines;
  return (
    <pre className="repository-code" tabIndex={0} aria-label={`${file.path} 코드 발췌`}>
      <code>
        {lines.map((line, i) => (
          <span
            key={line.number}
            className={
              focus !== undefined && line.number >= focus && line.number <= (end ?? focus)
                ? "is-focus"
                : undefined
            }
          >
            {i > 0 && line.number > lines[i - 1].number + 1 && (
              <span className="repository-gap">… 중간 줄 생략 …{"\n"}</span>
            )}
            <span className="repository-line-number">{line.number}</span>
            {line.text}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  );
}
export function SourceEvidence({
  repository,
  evidence,
  defaultOpen = false,
}: {
  repository: RepositorySnapshot;
  evidence: string;
  defaultOpen?: boolean;
}) {
  const citation = repositoryCitation(repository, evidence);
  if (!citation) return null;
  return (
    <Disclosure className="repository-evidence" open={defaultOpen || undefined}>
      <DisclosureSummary>
        근거 코드: {citation.file.path} ({citation.line}
        {citation.endLine > citation.line ? `–${citation.endLine}` : ""}줄)
      </DisclosureSummary>
      <CodeExcerpt file={citation.file} focus={citation.line} end={citation.endLine} />
      <Anchor href={citation.url} target="_blank" rel="noreferrer">
        {citation.file.path}:{citation.line}
        {citation.endLine > citation.line ? `–${citation.endLine}` : ""} 원본{" "}
        <ExternalLink size={14} />
      </Anchor>
    </Disclosure>
  );
}
export function ProjectRepository({ repository: repo }: { repository: RepositorySnapshot }) {
  const [selected, setSelected] = useState(repo.files[0]?.path);
  const file = repo.files.find((f) => f.path === selected) ?? repo.files[0];
  const groups = [
    ...new Set(repo.files.map((f) => (f.path.includes("/") ? f.path.split("/")[0] : "루트"))),
  ];
  if (!file) return null;
  const related = repo.links.filter((l) => l.from === file.path || l.to === file.path);
  return (
    <Disclosure className="repository-map">
      <DisclosureSummary>
        <GitBranch size={18} /> 코드 구조와 분석 범위
      </DisclosureSummary>
      <div className="repository-overview">
        <strong>{repo.name}</strong>
        <span>
          {repo.commit.slice(0, 7)}
          {repo.pullRequest ? ` · PR #${repo.pullRequest}` : ""}
        </span>
      </div>
      <p className="project-help">
        수집 목록 {repo.totalFiles}개 중 {repo.files.length}개 파일을 읽었습니다.{" "}
        {repo.omittedFiles}개는 범위에서 제외했습니다. 파일을 선택하면 읽은 코드와 import로 연결된
        파일을 볼 수 있습니다.
      </p>
      <div className="repository-explorer">
        <NativeSelect
          className="repository-file-picker"
          aria-label="살펴볼 코드 파일"
          value={file.path}
          onChange={(event) => setSelected(event.target.value)}
        >
          {repo.files.map((item) => (
            <option key={item.path} value={item.path}>
              {item.path}
            </option>
          ))}
        </NativeSelect>
        <nav aria-label="분석한 소스 파일" className="repository-files">
          {groups.map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              {repo.files
                .filter((f) => (f.path.includes("/") ? f.path.split("/")[0] : "루트") === group)
                .map((f) => (
                  <Button
                    key={f.path}
                    aria-pressed={f.path === file.path}
                    onClick={() => setSelected(f.path)}
                  >
                    <FileCode2 size={16} />
                    <span>
                      {f.path}
                      {f.partial && <small>일부 발췌</small>}
                    </span>
                  </Button>
                ))}
            </section>
          ))}
        </nav>
        <div className="repository-detail">
          <strong>{file.path}</strong>
          <p className="project-help">
            전체 {file.totalLines}줄 중 {file.lines.length}줄 수집
            {file.changed ? " · PR 변경 줄 주변" : ""}
          </p>
          <CodeExcerpt key={file.path} file={file} />
          <Disclosure>
            <DisclosureSummary>연결된 파일 {related.length}개 보기</DisclosureSummary>
            <div className="repository-relations" aria-label="선택한 파일의 import 관계">
              {related.length ? (
                related.map((link) => (
                  <Button
                    key={`${link.from}:${link.to}`}
                    onClick={() => setSelected(link.from === file.path ? link.to : link.from)}
                  >
                    <span>{link.from}</span>
                    <ArrowRight size={14} />
                    <span>{link.to}</span>
                  </Button>
                ))
              ) : (
                <p className="project-help">
                  발췌한 코드 사이에서 연결된 import를 찾지 못했습니다.
                </p>
              )}
            </div>
            <p className="project-help">
              화살표는 소스에 적힌 import 방향입니다. 실제 실행 순서나 전체 의존 관계를 뜻하지
              않습니다.
            </p>
          </Disclosure>
        </div>
      </div>
    </Disclosure>
  );
}
