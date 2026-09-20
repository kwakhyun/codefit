import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { ProjectPracticeApp } from "@/components/project-practice/project-practice";
export const metadata: Metadata = {
  title: "내 프로젝트로 연습 | CODE:FIT",
  description: "공개 소스 저장소의 실제 코드로 코드 이해 훈련과 서비스 동작 실습을 만드세요.",
};
export default function ProjectPracticePage() {
  return (
    <main id="main-content" className="project-practice-page">
      <SiteHeader />
      <header className="practice-page-intro">
        <span className="eyebrow">내 코드에서 시작하는 연습</span>
        <h1>만든 기능을, 이해한 기능으로</h1>
        <p>실제 프로젝트의 코드를 읽고 동작을 예상한 뒤, 확인할 일을 정리해 보세요.</p>
      </header>
      <Suspense fallback={<ScreenSkeleton variant="lesson" label="프로젝트 연습 준비 중" />}>
        <ProjectPracticeApp />
      </Suspense>
    </main>
  );
}
