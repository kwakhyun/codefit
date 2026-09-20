import { PracticeEntry } from "@/components/project-practice/practice-entry";
import { VisualIntro } from "@/components/experience/visual-intro";
import { ExperienceJourney } from "@/components/experience/experience-journey";
import { SiteHeader } from "@/components/navigation/site-header";
import { AppLink as Link } from "@/components/ui/primitives";
import type { Metadata } from "next";

import { HandoffDashboard } from "@/components/handoff/handoff-dashboard";
export const metadata: Metadata = {
  title: "AI 코드 이해 훈련 | CODE:FIT",
  description:
    "실제 GitHub 코드로 맞춤 이해 훈련을 만들거나, 저장소 연결 없이 JavaScript 샘플을 실행하고 수정하며 연습하세요.",
};
export default async function HandoffPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const sample = (await searchParams).source === "sample";
  return (
    <main id="main-content" className="handoff-page">
      <SiteHeader />
      <VisualIntro topic="code" className="handoff-intro">
        <span className="eyebrow">읽고, 실행하고, 내 말로 설명하기</span>
        <h1>내 코드가 어떻게 동작하는지 이해해 보세요</h1>
        <p>
          GitHub 저장소를 연결해 실제 코드로 연습하거나, 준비된 샘플을 선택하세요. 입력부터 결과까지
          처리 흐름을 따라가며 내 말로 설명해 봅니다.
        </p>

        <p className="muted">내 프로젝트 맞춤 훈련 또는 저장소 연결 없는 샘플 체험</p>
      </VisualIntro>
      <PracticeEntry initialSample={sample} mode="code">
        <ExperienceJourney topic="code" />
        <HandoffDashboard />
        <aside className="handoff-quality">
          <h2>어디까지 검증하나요?</h2>
          <p>
            12개 훈련의 JavaScript 코드를 브라우저의 분리된 실행 환경에서 테스트합니다. 제공된
            사례의 실행 결과와 AI의 설명 검토를 구분해 보여 줍니다. 테스트 통과는 모든 상황의
            정답이나 실력 인증이 아니며, 실제 제품에 적용하기 전에는 해당 환경에서도 검증해야
            합니다.
          </p>
          <Link href="/quality">AI 검토 방식과 검증 결과 →</Link>
        </aside>
      </PracticeEntry>
    </main>
  );
}
