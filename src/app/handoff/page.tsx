import Link from "next/link";
import type { Metadata } from "next";
import { BrandIcon } from "@/components/ui/brand-icon";
import { HandoffDashboard } from "@/components/handoff/handoff-dashboard";
export const metadata: Metadata = {
  title: "AI 코드 인수인계 훈련 | CODE:FIT",
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
        <span className="eyebrow">READ. QUESTION. OWN.</span>
        <h1>
          AI가 짠 코드,
          <br />
          이제 내가 책임질 차례.
        </h1>
        <p>
          코드를 넘겨받아 구조를 이해하고, 필요한 변경을 판단하고, 수정과 검증 근거를 남겨 보세요.
          정답 코드를 작성하는 것부터 다음 개발자에게 설명하는 것까지 연습합니다.
        </p>
        <ol>
          <li>구조 이해</li>
          <li>문제 판단</li>
          <li>수정과 확장</li>
          <li>검증과 인수인계</li>
        </ol>
        <p className="muted">
          로그인 없이 시작 · JavaScript 실무 과제 6개와 변형 과제 6개 · 약 25~35분
        </p>
      </section>
      <HandoffDashboard />
      <aside className="handoff-quality">
        <h2>어디까지 검증하나요?</h2>
        <p>
          제공하는 참고 풀이와 예제는 저장소 자동 테스트로 확인합니다. 작성한 코드와 테스트는
          서버에서 실행하지 않으며 AI가 요구사항별로 검토합니다. 검토 결과에 오류가 있을 수 있으므로
          실제 배포 전 실행 테스트가 필요합니다.
        </p>
        <Link href="/quality">AI 검토 방식과 검증 결과 →</Link>
      </aside>
    </main>
  );
}
