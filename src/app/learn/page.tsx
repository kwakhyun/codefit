import Link from "next/link";
import type { Metadata } from "next";
import { BrandIcon } from "@/components/ui/brand-icon";
import { LearningDashboard } from "@/components/learn/learning-dashboard";
export const metadata: Metadata = {
  title: "앱의 원리부터 배우기 | CODE:FIT",
  description:
    "코딩 경험 없이 시작하는 개발 기초 학습. 기초 미션 6개와 앱 오류 해결 실습 3개로 앱의 작동 원리와 수정 결과를 확인하는 방법을 배웁니다.",
};
export default function LearnPage() {
  return (
    <main id="main-content" className="learn-page">
      <header className="learn-header">
        <Link className="brand-logo" href="/">
          <BrandIcon />
          CODE:FIT_
        </Link>
        <Link href="/">문제 보관함으로</Link>
      </header>
      <section className="learn-intro">
        <span className="eyebrow">BUILD WITH AI. VERIFY FOR YOURSELF.</span>
        <h1>
          예제 앱으로 배우는
          <br />
          개발 기초
        </h1>
        <p>
          코딩 경험이 없어도 시작할 수 있습니다.
          <br />
          메모와 예약 앱으로 실습하며 작동 원리를 배우고, 오류를 찾고 수정하는 과정을 연습하세요.
        </p>
        <div className="learn-intro-actions">
          <Link className="primary-button" href="/learn/where-data-lives">
            첫 미션 시작하기 (약 5분) →
          </Link>
          <Link className="secondary-button" href="#labs">
            앱 오류 해결 실습 보기
          </Link>
        </div>
        <ol className="learn-journey">
          <li>결과 예상</li>
          <li>직접 조작</li>
          <li>수정과 확인</li>
          <li>다른 상황에 적용</li>
        </ol>
      </section>
      <LearningDashboard />
      <aside className="learn-limits">
        <h2>실습 환경 안내</h2>
        <p>
          모든 앱은 가상의 사용자와 데이터를 쓰는 교육용 모의 환경입니다. 실제 서버를 검사하거나
          제품의 안전성을 인증하지 않습니다. AI 질문은 선택 사항이며, 힌트와 동작 검사는 AI 없이도
          이용할 수 있습니다.
        </p>
        <Link href="/handoff">코드 분석도 연습하고 싶다면, AI 코드 이해 훈련 →</Link>
      </aside>
    </main>
  );
}
