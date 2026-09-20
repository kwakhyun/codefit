import { ScreenSkeleton } from "@/components/ui/skeleton";
import { VisualIntro } from "@/components/experience/visual-intro";
import { ExperienceJourney } from "@/components/experience/experience-journey";
import { Suspense } from "react";
import { SiteHeader } from "@/components/navigation/site-header";
import { ProjectCheckApp } from "@/components/project-check/project-check";
export const metadata = {
  title: "내 프로젝트 이해도 점검 | CODE:FIT",
  description:
    "서비스나 GitHub 저장소 링크로 설계 질문을 받아보세요. 데이터 흐름과 설계 선택을 설명하고 보완할 부분을 확인합니다.",
};
export default function ProjectCheckPage() {
  return (
    <main id="main-content" className="learn-page project-page">
      <SiteHeader />
      <VisualIntro topic="project" className="learn-intro project-task-intro">
        <span className="eyebrow">내 서비스로 연습하는 설계 설명</span>
        <h1>내 서비스에서 놓친 부분을 찾아보세요</h1>
        <p>
          공개 화면이나 GitHub 코드를 읽고 설계 질문 5개를 준비합니다.
          <br />
          답변하면 부족한 설명과 직접 확인할 일을 짚어드려요.
        </p>
      </VisualIntro>
      <Suspense fallback={<ScreenSkeleton variant="form" label="점검 기록 불러오는 중…" />}>
        <ProjectCheckApp />
      </Suspense>
      <ExperienceJourney topic="project" />
    </main>
  );
}
