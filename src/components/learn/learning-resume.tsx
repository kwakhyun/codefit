"use client";
import { SectionArtwork } from "@/components/experience/section-artwork";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
      <p className="resume-status" role="status">
        입문 기록을 확인하지 못했습니다. {error}{" "}
        <button className="text-button" onClick={reload}>
          다시 확인
        </button>
      </p>
    );
  if (!overview)
    return (
      <p className="resume-status" role="status">
        입문 학습 기록을 확인하고 있습니다…
      </p>
    );
  const current = overview.resume;
  if (!current && recommendFirst && overview.complete < overview.missions.length) {
    const next = overview.next.mission;
    return (
      <section
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
      </section>
    );
  }
  if (!current && !showEmpty) return null;
  return (
    <section className="resume-card illustrated-resume" aria-label="입문 학습 이어하기">
      <SectionArtwork topic="principles" />
      <div>
        <span className="eyebrow">{current ? "이어서 연습할 미션" : "서비스 원리 학습 기록"}</span>
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
      <Link className="primary-button" href={current ? `/learn/${current.mission.id}` : "/learn"}>
        {current ? "이어서 연습하기" : "입문 학습 보기"}
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
