import Link from "next/link";
import type { Metadata } from "next";
import { BrandIcon } from "@/components/ui/brand-icon";
import { HandoffDashboard } from "@/components/handoff/handoff-dashboard";
export const metadata: Metadata = {
  title: "AI 코드 이해 훈련 | CODE:FIT",
  description:
    "AI가 작성한 코드의 실행 결과를 예상하고, 직접 수정하고 테스트하세요. JavaScript 기본 과제 6개와 변형 과제 6개를 로그인 없이 연습할 수 있습니다.",
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
          AI가 작성한 코드를
          <br />
          직접 분석하고 수정해 보세요
        </h1>
        <p>
          코드를 읽고 실행 결과를 예상한 뒤 실제 결과와 비교해 보세요. 오류를 수정하고 테스트하며,
          코드가 어떻게 작동하는지 설명하는 연습을 합니다.
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
          <h2>장바구니 코드부터 살펴보세요</h2>
          <p>상품 수량을 바꾸면 원본 데이터도 바뀔까요? 짧은 함수를 읽고 직접 실행해 확인하세요.</p>
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
