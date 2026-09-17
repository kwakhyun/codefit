"use client";
import { ScenarioImage } from "@/components/ui/scenario-visual";
import { problemUrl } from "@/lib/library-state";
import type { ProblemSummary, ProgressSummary } from "@/lib/problem";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { FeatureBanner } from "./feature-banner";
import { LearningResume } from "@/components/learn/learning-resume";
import { GuestLogin } from "@/components/account/guest-login";
interface TrainingHeroProps {
  recommended: ProblemSummary | undefined;
  libraryHref: string;
  resume: ProgressSummary | undefined;
  scope: string;
  onGenerate: () => void;
}
export function TrainingHero({
  recommended,
  libraryHref,
  resume,
  scope,
  onGenerate,
}: TrainingHeroProps) {
  return (
    <div className="training-welcome">
      <div className="home-heading">
        <div>
          <span className="eyebrow">AI 시대에도, 이해는 내 실력으로</span>
          <h1>오늘은 무엇을 연습할까요?</h1>
        </div>
        <p>처음 배우는 원리부터 직접 고치는 코드까지.</p>
      </div>
      <LearningResume key={scope} scope={scope} />
      {resume && recommended && (
        <section className="resume-card" aria-label="코딩 문제 이어하기">
          <div>
            <span className="eyebrow">작성 중인 코드</span>
            <h2>{recommended.title}</h2>
            <p>저장된 코드부터 이어서 풀어보세요.</p>
          </div>
          <Link className="primary-button" href={problemUrl(recommended.id, libraryHref)}>
            이어서 훈련하기
            <ArrowRight size={16} />
          </Link>
        </section>
      )}
      <div className="training-paths">
        <Link href="/learn" className="training-path-foundation">
          <ScenarioImage scene="data-storage" />
          <span>코딩이 처음이라면 · 5분부터</span>
          <strong>
            서비스 원리 배우기 <ArrowRight size={17} />
          </strong>
          <p>데이터 저장과 서비스의 작동 원리를 직접 확인해요.</p>
        </Link>
        <Link href="/handoff" className="training-path-analysis">
          <ScenarioImage scene="cart" />
          <span>코드를 읽을 수 있다면 · 25분부터</span>
          <strong>
            AI 코드 분석하기 <ArrowRight size={17} />
          </strong>
          <p>실행 결과를 예상하고, 코드를 고치고 검증해요.</p>
        </Link>
        <a href="#problem-library" className="training-path-practice">
          <ScenarioImage scene="packets" />
          <span>직접 코딩하고 싶다면</span>
          <strong>
            문제 골라 풀기 <ArrowRight size={17} />
          </strong>
          <p>원하는 분야의 구현, 오류 수정, 리팩터링을 연습해요.</p>
        </a>
      </div>
      <Link href="/project-check" className="project-launch">
        <div>
          <strong>AI로 만든 내 서비스, 설계도 설명할 수 있나요?</strong>
          <p>서비스 링크로 질문을 받고, 내 프로젝트 이해도를 확인해 보세요.</p>
        </div>
        <ArrowRight size={22} />
      </Link>
      <FeatureBanner onGenerate={onGenerate} />
      {scope.startsWith("guest:") && <GuestLogin returnTo="/" />}
    </div>
  );
}
