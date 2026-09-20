import { VisualIntro } from "@/components/experience/visual-intro";
import { ExperienceJourney } from "@/components/experience/experience-journey";
import { MISSIONS } from "@/lib/learn/catalog";
import { SiteHeader } from "@/components/navigation/site-header";
import { AppLink as Link } from "@/components/ui/primitives";
import type { Metadata } from "next";

import { LearningDashboard } from "@/components/learn/learning-dashboard";
export const metadata: Metadata = {
  title: "서비스 원리 배우기 | CODE:FIT",
  description:
    "코딩 경험 없이 시작하는 개발 기초 학습. 쇼핑, 예약, 업무, 콘텐츠, 고객지원 실습으로 서비스의 작동 원리와 수정 결과를 확인하는 방법을 배웁니다.",
};
export default function LearnPage() {
  return (
    <main id="main-content" className="learn-page">
      <SiteHeader />
      <VisualIntro topic="principles" className="learn-intro">
        <span className="eyebrow">5개 서비스 분야, {MISSIONS.length}개 실습</span>
        <h1>예제 서비스로 배우는 개발 기초</h1>
        <p>
          코딩 경험이 없어도 시작할 수 있습니다.
          <br />
          예제 서비스를 직접 조작하며 데이터 저장, 서버 통신, 접근 권한을 배우고 오류 해결을
          연습하세요.
        </p>
      </VisualIntro>
      <ExperienceJourney topic="principles" />
      <LearningDashboard />
      <aside className="learn-limits">
        <h2>실습 환경 안내</h2>
        <p>
          모든 실습 서비스는 가상의 사용자와 데이터를 쓰는 교육용 모의 환경입니다. 실제 서버를
          검사하거나 제품의 안전성을 인증하지 않습니다. AI 질문은 선택 사항이며, 힌트와 동작 검사는
          AI 없이도 이용할 수 있습니다.
        </p>
        <Link href="/handoff">코드 분석도 연습하고 싶다면, AI 코드 이해 훈련 →</Link>
      </aside>
    </main>
  );
}
