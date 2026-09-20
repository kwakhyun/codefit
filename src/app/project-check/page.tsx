import { Suspense } from "react";
import { SiteHeader } from "@/components/navigation/site-header";
import { ProjectCheckApp } from "@/components/project-check/project-check";
export const metadata = {
  title: "내 프로젝트 이해도 점검 | CODE:FIT",
  description:
    "내가 만든 서비스 링크로 설계 질문을 받아보세요. 데이터 흐름과 설계 선택을 설명하고 보완할 부분을 확인합니다.",
};
export default function ProjectCheckPage() {
  return (
    <main id="main-content" className="learn-page project-page">
      <SiteHeader />
      <section className="learn-intro">
        <span className="eyebrow">내 서비스로 연습하는 설계 설명</span>
        <h1>
          만든 서비스,
          <br />
          어디까지 설명할 수 있나요?
        </h1>
        <p>
          서비스 링크를 넣으면 AI가 프로젝트에 맞는 질문을 준비합니다.
          <br />내 말로 설계를 설명하고, 내 프로젝트에서 직접 확인하고 답변을 보완하세요.
        </p>
        <ol className="learn-journey">
          <li>서비스 링크 분석</li>
          <li>설계 질문 5개</li>
          <li>답변과 이해도 점검</li>
          <li>직접 확인하고 답변 보완</li>
        </ol>
      </section>
      <Suspense fallback={<p role="status">점검 기록 불러오는 중…</p>}>
        <ProjectCheckApp />
      </Suspense>
    </main>
  );
}
