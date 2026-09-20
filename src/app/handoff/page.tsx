import { VisualIntro } from "@/components/experience/visual-intro";
import { ExperienceJourney } from "@/components/experience/experience-journey";
import { SiteHeader } from "@/components/navigation/site-header";
import { AppLink as Link } from "@/components/ui/primitives";
import type { Metadata } from "next";

import { HandoffDashboard } from "@/components/handoff/handoff-dashboard";
export const metadata: Metadata = {
  title: "AI 코드 이해 훈련 | CODE:FIT",
  description:
    "AI가 작성한 코드의 실행 결과를 예상하고, 직접 수정하고 테스트하세요. JavaScript 기본 과제 6개와 변형 과제 6개를 로그인 없이 연습할 수 있습니다.",
};
export default function HandoffPage() {
  return (
    <main id="main-content" className="handoff-page">
      <SiteHeader />
      <VisualIntro topic="code" className="handoff-intro">
        <span className="eyebrow">읽고, 실행하고, 내 말로 설명하기</span>
        <h1>AI가 작성한 코드를 직접 분석하고 수정해 보세요</h1>
        <p>
          코드를 읽고 실행 결과를 예상한 뒤 실제 결과와 비교해 보세요. 오류를 수정하고 테스트하며,
          코드가 어떻게 작동하는지 설명하는 연습을 합니다.
        </p>

        <p className="muted">
          로그인 없이 시작 · JavaScript 실무 과제 6개와 변형 과제 6개 · 약 25~35분
        </p>
      </VisualIntro>
      <ExperienceJourney topic="code" />
      <HandoffDashboard />
      <aside className="handoff-quality">
        <h2>어디까지 검증하나요?</h2>
        <p>
          12개 훈련의 JavaScript 코드를 브라우저의 분리된 실행 환경에서 테스트합니다. 제공된 사례의
          실행 결과와 AI의 설명 검토를 구분해 보여 줍니다. 테스트 통과는 모든 상황의 정답이나 실력
          인증이 아니며, 실제 제품에 적용하기 전에는 해당 환경에서도 검증해야 합니다.
        </p>
        <Link href="/quality">AI 검토 방식과 검증 결과 →</Link>
      </aside>
    </main>
  );
}
