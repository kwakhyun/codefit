import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { ProjectAiEntry } from "@/components/ai-learning/project-ai-entry";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import { AiCatalog } from "@/components/ai-learning/ai-catalog";
import { AI_LESSONS, AI_TRACKS } from "@/lib/ai-learning/catalog";
import { Anchor } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "AI 실무 배우기 | CODE:FIT",
  description:
    "LangChain, LangGraph, RAG, 로컬 AI, 업무 자동화부터 AI 평가와 모델 배포까지. 용어 설명과 모의 실습으로 배우는 AI 기술 입문.",
};
export default function AiLearningPage() {
  return (
    <main id="main-content" className="learn-page ai-learning-page">
      <SiteHeader />
      <header className="ai-learning-hero">
        <span className="eyebrow">
          {AI_TRACKS.length}개 분야 / {AI_LESSONS.length}개 수업 / 설치 없이 시작
        </span>
        <h1>
          내 프로젝트에 맞는 AI,
          <br />
          쓰임새부터 배워보세요.
        </h1>
        <p>
          내 코드에서 사용 중인 AI를 이해하고, 새로운 활용 방법을 찾아봅니다.
          <br />
          프로젝트 없이 관심 있는 도구부터 배워도 괜찮아요.
        </p>
        <ProjectAiEntry />
        <p>
          <Anchor href="#ai-catalog">배우고 싶은 도구 바로 찾기 ↓</Anchor>
        </p>
      </header>
      <Suspense fallback={<ScreenSkeleton variant="cards" />}>
        <AiCatalog />
      </Suspense>
    </main>
  );
}
