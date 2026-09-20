"use client";
import { Status, Button, Card } from "@/components/ui/primitives";
import { SectionArtwork } from "@/components/experience/section-artwork";
import { AppLink as Link } from "@/components/ui/primitives";
import { ArrowRight, BookOpen } from "lucide-react";
import { useLearningOverview } from "@/hooks/use-learning-overview";
import { learningOverview, LEARNING_STAGES } from "@/lib/learn/overview";

export function LearningResume({
  scope,
  showEmpty = false,
  recommendFirst = false,
}: {
  scope: string;
  showEmpty?: boolean;
  recommendFirst?: boolean;
}) {
  const { data, error, reload } = useLearningOverview(scope);
  const overview = data ? learningOverview(data.progress) : null;
  if (error)
    return (
      <Status className="resume-status" role="status">
        입문 기록을 확인하지 못했습니다. {error}{" "}
        <Button className="text-button" onClick={reload}>
          다시 확인
        </Button>
      </Status>
    );
  if (!overview)
    return (
      <Status className="resume-status" role="status">
        입문 학습 기록을 확인하고 있습니다…
      </Status>
    );
  const current = overview.resume;
  if (!current && recommendFirst && overview.complete < overview.missions.length) {
    const next = overview.next.mission;
    return (
      <Card
        as="section"
        className="resume-card home-recommendation illustrated-resume"
        aria-label="추천 첫 학습"
      >
        <SectionArtwork topic="principles" />
        <div>
          <span className="eyebrow">
            {overview.complete ? "다음에 연습할 미션" : "처음이라면 이 미션부터"}
          </span>
          <h2>{next.title}</h2>
          <p>약 {next.minutes}분 · 로그인 없이 예상하고, 직접 눌러 확인해 보세요.</p>
        </div>
        <Link className="primary-button" href={`/learn/${next.id}`}>
          추천 미션 시작하기 <ArrowRight size={16} />
        </Link>
      </Card>
    );
  }
  if (!current && !showEmpty) return null;
  return (
    <Card as="section" className="learning-resume-row" aria-label="입문 학습 이어하기">
      <span className="learning-resume-icon">
        <BookOpen size={24} aria-hidden="true" />
      </span>
      <div className="learning-resume-copy">
        <span className="eyebrow">서비스 원리 배우기</span>
        <h2>
          {current?.mission.title ||
            `${overview.complete} / ${overview.missions.length}개 미션 완료`}
        </h2>
        <p>
          {current
            ? `${current.record.stage + 1}/4단계 · ${LEARNING_STAGES[current.record.stage]}부터 이어갑니다.`
            : "예상하고, 직접 확인하며 배운 내용을 돌아보세요."}
        </p>
      </div>
      {current && (
        <div
          className="learning-resume-progress"
          aria-label={`4단계 중 ${current.record.stage + 1}단계`}
        >
          <span>
            {current.record.stage + 1}
            <small> / 4단계</small>
          </span>
          <div aria-hidden="true">
            {[0, 1, 2, 3].map((step) => (
              <i key={step} data-reached={step <= current.record.stage} />
            ))}
          </div>
        </div>
      )}
      <Link className="primary-button" href={current ? `/learn/${current.mission.id}` : "/learn"}>
        {current ? "이어서 연습하기" : "입문 학습 보기"}
        <ArrowRight size={16} />
      </Link>
    </Card>
  );
}
