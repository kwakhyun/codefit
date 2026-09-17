"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLearningOverview } from "@/hooks/use-learning-overview";
import { learningOverview, LEARNING_STAGES } from "@/lib/learn/overview";

export function LearningResume({
  scope,
  showEmpty = false,
}: {
  scope: string;
  showEmpty?: boolean;
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
  if (!current && !showEmpty) return null;
  return (
    <section className="resume-card" aria-label="입문 학습 이어하기">
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
