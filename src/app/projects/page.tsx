import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { ProjectClasses } from "@/components/projects/project-classes";
export const metadata: Metadata = {
  title: "내 프로젝트 | CODE:FIT",
  description: "내 프로젝트 학습 클래스를 관리하고 점검, 실습, AI 학습과 복습을 이어가세요.",
};
export default function ProjectsPage() {
  return (
    <main id="main-content" className="project-classes-page">
      <SiteHeader />
      <header className="practice-page-intro">
        <span className="eyebrow">한 번 분석하고, 나만의 수업으로</span>
        <h1>내 프로젝트</h1>
        <p>
          분석한 프로젝트가 자동으로 저장됩니다. 질문과 실습, AI 학습을 원하는 속도로 이어가세요.
        </p>
      </header>
      <Suspense fallback={<ScreenSkeleton variant="lesson" label="내 프로젝트 준비 중" />}>
        <ProjectClasses />
      </Suspense>
    </main>
  );
}
