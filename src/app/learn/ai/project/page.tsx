import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { ProjectAiWorkshop } from "@/components/ai-learning/project-ai-workshop";
export const metadata: Metadata = { title: "내 프로젝트 AI 워크숍 | CODE:FIT" };
export default function ProjectWorkshopPage() {
  return (
    <main id="main-content" className="learn-page ai-learning-page project-ai-page">
      <SiteHeader />
      <header className="ai-learning-hero">
        <span className="eyebrow">내 프로젝트 AI 워크숍</span>
        <h1>내 코드에서 AI의 쓰임새를 찾아보세요</h1>
        <p>사용 중인 기술을 이해하고, 새로 적용할 아이디어를 작은 실험으로 확인합니다.</p>
      </header>
      <Suspense fallback={<ScreenSkeleton variant="lesson" label="프로젝트 학습 준비 중" />}>
        <ProjectAiWorkshop />
      </Suspense>
    </main>
  );
}
