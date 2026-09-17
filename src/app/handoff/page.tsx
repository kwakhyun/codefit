import Link from "next/link";
import type { Metadata } from "next";
import { BrandIcon } from "@/components/ui/brand-icon";
import { HandoffDashboard } from "@/components/handoff/handoff-dashboard";
export const metadata: Metadata = {
  title: "AI 코드 이해 훈련 | CODE:FIT",
  description:
    "AI가 작성한 코드를 이해하고, 고치고, 다음 변경까지 책임지는 연습. 실무 과제 6개와 변형 재도전으로 코드 판단력을 단련하세요.",
};
export default function HandoffPage() {
  return (
    <main id="main-content" className="handoff-page">
      <header>
        <Link className="brand-logo" href="/">
          <BrandIcon />
          CODE:FIT_
        </Link>
        <Link className="text-button" href="/">
          문제 보관함으로
        </Link>
      </header>
      <section className="handoff-intro">
        <span className="eyebrow">PREDICT. RUN. UNDERSTAND.</span>
        <h1>
          AI가 짠 코드,
          <br />
          읽는 것에서 이해하는 것으로.
        </h1>
        <p>
          실행 결과를 먼저 예상하고, 실제 동작과 비교해 보세요. 어긋난 이유를 찾아 고치고, 다른
          상황에서도 설명할 수 있을 때까지 연습합니다. 틀린 예상도 배움의 시작입니다.
        </p>
        <ol>
          <li>예측하기</li>
          <li>비교하기</li>
          <li>수정하기</li>
          <li>설명하고 응용하기</li>
        </ol>
        <p className="muted">
          로그인 없이 시작 · JavaScript 실무 과제 6개와 변형 과제 6개 · 약 25~35분
        </p>
      </section>
      <div className="handoff-quickstart">
        <div>
          <span className="eyebrow">처음이라면 여기서 시작하세요</span>
          <h2>원본 장바구니는 그대로일까요?</h2>
          <p>짧은 함수 하나를 읽고 예상해 보세요. 로그인 없이 첫 실행까지 약 3분.</p>
        </div>
        <Link href="/problems/handoff-cart?from=%2Fhandoff" className="primary-button">
          코드 이해 훈련 시작 →
        </Link>
      </div>
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
