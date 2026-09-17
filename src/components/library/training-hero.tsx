"use client";
import { problemUrl } from "@/lib/library-state";
import type { ProblemSummary, ProgressSummary } from "@/lib/problem";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { FeatureBanner } from "./feature-banner";
interface TrainingHeroProps {
  recommended: ProblemSummary | undefined;
  libraryHref: string;
  resume: ProgressSummary | undefined;
  onGenerate: () => void;
}
export function TrainingHero({ recommended, libraryHref, resume, onGenerate }: TrainingHeroProps) {
  return (
    <div className="training-welcome">
      <h1 className="sr-only">CODE:FIT — 앱의 원리부터 코드 이해까지</h1>
      <FeatureBanner onGenerate={onGenerate} />
      <div className="training-paths">
        <Link href="/learn">
          <span>처음이라면</span>
          <strong>
            앱의 원리부터 배우기 <ArrowUpRight size={17} />
          </strong>
          <p>예제 앱으로 배우는 개발 기초</p>
        </Link>
        <Link href="/handoff">
          <span>코드를 읽을 수 있다면</span>
          <strong>
            AI 코드 이해 훈련 <ArrowUpRight size={17} />
          </strong>
          <p>코드 분석부터 수정과 테스트까지</p>
        </Link>
      </div>
      {recommended && (
        <Link href={problemUrl(recommended.id, libraryHref)} className="hero-start">
          {resume ? "이어서 훈련하기" : "오늘의 코딩 훈련 시작"}
          <ArrowUpRight size={16} />
          <span>
            {resume
              ? "저장된 코드부터 이어서"
              : `약 ${recommended.minutes}분 / 난이도 ${recommended.difficulty}`}
          </span>
        </Link>
      )}
    </div>
  );
}
