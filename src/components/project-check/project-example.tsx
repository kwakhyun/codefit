import { Card, Disclosure, DisclosureSummary } from "@/components/ui/primitives";
import { AccessPreview } from "@/components/experience/access-preview";
import { AppLink as Link } from "@/components/ui/primitives";

/** An editorial example of the flow, never presented as a live AI assessment. */
export function ProjectExample() {
  return (
    <Card
      as="section"
      className="project-panel project-example"
      aria-labelledby="project-example-title"
    >
      <span className="eyebrow">로그인 없이 먼저 살펴보기</span>
      <h2 id="project-example-title">어떤 질문과 피드백을 받나요?</h2>
      <p>
        비공개 메모 서비스로 보는 설명용 예시입니다. 실제 AI 분석 결과나 사용자 답변이 아닙니다.
      </p>
      <AccessPreview />
      <div className="project-example-grid">
        <div>
          <h3>설계 질문</h3>
          <p>
            민수가 지민의 비공개 메모 주소를 알게 됐다면, 서버는 무엇을 확인한 뒤 메모를 보내야
            하나요?
          </p>
          <h3>답변 예시</h3>
          <blockquote>
            로그인한 사람에게만 메모를 보여줍니다. 다른 사람의 메모는 목록에서 숨깁니다.
          </blockquote>
        </div>
        <div>
          <h3>피드백 예시</h3>
          <p>
            <strong>설명한 부분:</strong> 로그인 여부와 목록 표시를 구분했습니다.
          </p>
          <p>
            <strong>보완할 부분:</strong> 로그인한 사람도 다른 사람의 메모 주소로 요청할 수
            있습니다. 서버에서 요청자와 메모 소유자를 비교하는지 설명이 빠졌습니다.
          </p>
          <p>
            <strong>다음 확인:</strong> 같은 메모를 소유자와 다른 계정으로 각각 요청해, 소유자에게만
            내용이 반환되는지 확인하세요.
          </p>
          <Link href="/learn/private-board">접근 권한 실습으로 확인하기 →</Link>
        </div>
      </div>
      <Disclosure>
        <DisclosureSummary>데이터 저장에 관한 질문도 보기</DisclosureSummary>
        <p>
          메모를 저장한 직후 새로고침하거나 다른 기기로 접속하면 같은 내용을 볼 수 있나요? 어느
          저장소를 기준으로 화면을 보여주는지 설명해 주세요.
        </p>
      </Disclosure>
      <p className="learn-fineprint">
        실제 점검에서는 공개 페이지와 직접 작성한 설명을 바탕으로 질문을 만듭니다. 서버 코드나 보안
        상태를 자동 검사하는 기능은 아닙니다.
      </p>
    </Card>
  );
}
