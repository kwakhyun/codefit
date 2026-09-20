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
          AI 도구를 이해하고,
          <br />내 일에 연결해 보세요.
        </h1>
        <p>
          낯선 용어는 쉽게 풀고, 쓰임새는 직접 확인합니다.
          <br />
          관심 있는 도구부터 시작해도 괜찮아요.
        </p>
        <div className="ai-hero-flow" aria-label="학습 방법">
          <span>01 개념 이해</span>
          <span aria-hidden="true">→</span>
          <span>02 선택하며 실습</span>
          <span aria-hidden="true">→</span>
          <span>03 확인 문제</span>
        </div>
        <p>
          <Anchor href="#ai-catalog">배우고 싶은 도구 바로 찾기 ↓</Anchor>
        </p>
      </header>
      <AiCatalog />
    </main>
  );
}
