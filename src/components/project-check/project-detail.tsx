"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Anchor, Button, Card, Disclosure, DisclosureSummary } from "@/components/ui/primitives";
import { ProjectPracticeLinks } from "@/components/project-practice/practice-entry";
import { ProjectLearning } from "@/components/project-learning/project-learning";
import { dateLabel } from "@/lib/client-api";
import { displayName } from "@/lib/project-check/display";
import type { Check, CheckOverview, ProjectPractice } from "@/lib/project-check/types";
import { AnalysisOverview } from "./analysis-overview";
import { ProjectCaptures } from "./project-captures";
import { ProjectEvidenceReview } from "./project-evidence-review";
import { ProjectFollowUp } from "./project-follow-up";
import { ProjectQuestions } from "./project-questions";
import { ProjectRepository, SourceEvidence } from "./project-repository";
import { RenewProject } from "./renew-project";
import { RevisionTimeline } from "./revision-timeline";

/**
 * One analysed project in journey order: answer the questions, read the result, confirm and
 * improve (one place for 확인 기록 and 수정 요청), then the collapsed analysis material.
 */
export function ProjectDetail({
  check,
  data,
  busy,
  onSelect,
  onDelete,
  onReviewed,
  onRevised,
  onPracticeSaved,
  onUsage,
}: {
  check: Check;
  data: CheckOverview;
  busy: boolean;
  onSelect: (id: string) => void;
  onDelete: () => void;
  onReviewed: (review: NonNullable<Check["review"]>) => Promise<void>;
  onRevised: (check: Check) => void;
  onPracticeSaved: (practice: ProjectPractice) => void;
  onUsage: () => Promise<void>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [trainingOpen, setTrainingOpen] = useState(false);
  useEffect(() => {
    heading.current?.focus();
  }, [check.id]);
  useEffect(() => {
    const followHash = () => {
      if (window.location.hash !== "#training") return;
      setTrainingOpen(true);
      // The panel mounts its content only when opened; bring it into view once it exists.
      window.setTimeout(() => document.getElementById("training")?.scrollIntoView(), 0);
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [check.id]);
  const repository = check.page.repository;
  const rootId = check.revisionOf ?? check.id;
  return (
    <>
      <Card as="section" id="project-analysis-overview" className="project-panel project-summary">
        <span className="eyebrow">
          내 프로젝트 이해도 점검
          {check.revisionNumber ? ` · 보완 답변 ${check.revisionNumber}차` : ""}
        </span>
        <h2 ref={heading} tabIndex={-1}>
          {displayName(check)}
        </h2>
        <Anchor href={check.page.url} target="_blank" rel="noreferrer">
          {new URL(check.page.url).hostname}
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </Anchor>
        <RevisionTimeline check={check} onSelect={onSelect} disabled={busy} />
        <AnalysisOverview check={check} />
      </Card>
      <ProjectQuestions
        key={`questions:${check.id}`}
        check={check}
        scope={data.scope}
        aiReady={data.aiReady}
        review={data.usage.review}
        onUsage={onUsage}
        onReviewed={onReviewed}
      />
      {check.review && (
        <ProjectFollowUp
          key={`follow-up:${check.id}`}
          check={check}
          scope={data.scope}
          onRevised={onRevised}
          onSaved={onPracticeSaved}
        />
      )}
      {repository && <ProjectPracticeLinks id={rootId} />}
      <Disclosure
        id="project-analysis-material"
        className="project-panel analysis-material"
        key={`material:${check.id}`}
      >
        <DisclosureSummary>
          <strong>분석 자료와 근거</strong>
          <span>
            {repository ? "수집한 코드, 인용 위치와 코드 지도" : "수집한 화면과 분석 범위"}
          </span>
        </DisclosureSummary>
        <section aria-label="질문을 만든 자료">
          <h3>어떤 자료로 질문을 만들었나요?</h3>
          {repository ? (
            <p className="project-help">
              {dateLabel(check.page.fetchedAt)} 기준. 커밋 {repository.commit.slice(0, 7)}에서{" "}
              {repository.files.length}개 파일을 일부 읽었습니다. 코드를 실행하거나 배포 상태를
              확인한 결과는 아닙니다.
            </p>
          ) : (
            <p className="project-help">
              {dateLabel(check.page.fetchedAt)} 수집.{" "}
              {check.page.collectionNote || "공개 HTML 한 곳의 정보를 참고했습니다."}{" "}
              {check.page.source === "metadata"
                ? "화면 본문을 충분히 읽지 못해 사이트에 등록된 공개 소개 정보를 참고했습니다. 자바스크립트 실행 후 나타나는 화면은 확인하지 않았습니다. "
                : check.page.limited
                  ? "공개 화면에서 읽은 정보가 적습니다. "
                  : ""}
              로그인 후 화면, 소스 코드와 실제 서버 구성은 확인하지 않았습니다.
            </p>
          )}
        </section>
        <ProjectEvidenceReview check={check} />
        {(repository || !!check.page.captures?.length) && (
          <ProjectCaptures check={check} scope={data.scope} />
        )}
        {repository && Boolean(check.analysis.codeGuide?.length) && (
          <section className="repository-reading-guide" aria-label="먼저 살펴볼 코드">
            <h3>먼저 살펴볼 코드</h3>
            <p className="project-help">
              파일을 처음부터 읽기 막막하다면 여기서 시작해 보세요. 수집한 코드에서 AI가 고른 읽기
              후보이며, 동작이나 안전성을 검증한 결과는 아닙니다.
            </p>
            {check.analysis.codeGuide?.map((item, index) => (
              <div key={item.evidence}>
                <h4>
                  {index + 1}. {item.title}
                </h4>
                <SourceEvidence repository={repository} evidence={item.evidence} />
              </div>
            ))}
          </section>
        )}
        {repository && <ProjectRepository repository={repository} />}
      </Disclosure>
      {check.review && (
        <Disclosure
          className="project-panel project-training"
          open={trainingOpen}
          onToggle={(event) => setTrainingOpen(event.currentTarget.open)}
        >
          <DisclosureSummary>기초 개념을 예제로 연습하기 (선택)</DisclosureSummary>
          {/* Opening it is the request: a closed panel never reads or copies the examples. */}
          {trainingOpen && (
            <ProjectLearning key={`training:${check.id}`} id={rootId} scope={data.scope} />
          )}
        </Disclosure>
      )}
      <section className="project-panel project-settings" aria-labelledby="project-settings-title">
        <h2 id="project-settings-title">프로젝트 관리</h2>
        <RenewProject
          check={check}
          scope={data.scope}
          usage={data.usage.analysis}
          aiReady={data.aiReady}
          destination="/project-check"
          disabled={busy}
        />
        <div className="project-danger-zone">
          <h3>위험 영역</h3>
          <p className="project-help">
            프로젝트를 삭제하면 분석, 답변과 평가, 보완 답변, 확인 기록, 코드 대화, 실습과 AI
            워크숍이 함께 삭제됩니다. 삭제 전에 무엇이 지워지는지 다시 확인합니다.
          </p>
          <Button
            className="danger-button"
            disabled={busy}
            onClick={(event) => {
              event.currentTarget.focus();
              onDelete();
            }}
          >
            프로젝트 삭제
          </Button>
        </div>
      </section>
    </>
  );
}
