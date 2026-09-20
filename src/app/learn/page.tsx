import { PracticeEntry } from "@/components/project-practice/practice-entry";
import { VisualIntro } from "@/components/experience/visual-intro";
import { ExperienceJourney } from "@/components/experience/experience-journey";
import { MISSIONS } from "@/lib/learn/catalog";
import { SiteHeader } from "@/components/navigation/site-header";
import { AppLink as Link } from "@/components/ui/primitives";
import type { Metadata } from "next";

import { LearningDashboard } from "@/components/learn/learning-dashboard";
import { AiLearningEntry } from "@/components/ai-learning/ai-learning-entry";
export const metadata: Metadata = {
  title: "서비스 원리 배우기 | CODE:FIT",
  description:
    "내 GitHub 코드에서 서비스 동작 실습을 만들거나, 저장소 연결 없이 샘플 서비스로 원리를 체험하세요.",
};
export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const sample = (await searchParams).source === "sample";
  return (
    <main id="main-content" className="learn-page">
      <SiteHeader />
      <VisualIntro topic="principles" className="learn-intro">
        <span className="eyebrow">내 프로젝트 실습과 {MISSIONS.length}개 샘플 체험</span>
        <h1>서비스가 동작하는 이유를 확인해 보세요</h1>
        <p>
          내 GitHub 코드에서 실습을 만들고, 정상 동작과 실패 상황을 비교하세요. 저장소를 연결하고
          싶지 않다면 샘플로 먼저 체험할 수 있습니다.
        </p>
      </VisualIntro>
      <PracticeEntry initialSample={sample} mode="service">
        <Link className="primary-button" href="/project-check">
          내 서비스로 점검 시작하기 →
        </Link>
        <ExperienceJourney topic="principles" />
        <AiLearningEntry />
        <LearningDashboard />
        <aside className="learn-limits">
          <h2>실습 환경 안내</h2>
          <p>
            모든 실습 서비스는 가상의 사용자와 데이터를 쓰는 교육용 모의 환경입니다. 실제 서버를
            검사하거나 제품의 안전성을 인증하지 않습니다. AI 질문은 선택 사항이며, 힌트와 동작
            검사는 AI 없이도 이용할 수 있습니다.
          </p>
          <Link href="/handoff">코드 분석도 연습하고 싶다면, AI 코드 이해 훈련 →</Link>
        </aside>
      </PracticeEntry>
    </main>
  );
}
