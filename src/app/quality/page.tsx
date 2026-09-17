import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandIcon } from "@/components/ui/brand-icon";
import report from "../../../reports/ai-review-luna.json";
export const metadata = { title: "AI 검토 방식과 검증 결과 | CODE:FIT" };
export default function QualityPage() {
  const result = report.summary;
  return (
    <main className="quality-page">
      <header>
        <Link href="/" className="brand-logo">
          <BrandIcon />
          CODE:FIT_
        </Link>
        <Link href="/" className="text-button">
          <ArrowLeft size={15} />
          문제 보관함
        </Link>
      </header>
      <span className="eyebrow">HOW WE REVIEW YOUR CODE</span>
      <h1>
        AI의 피드백도,
        <br />
        확인하며 개선합니다.
      </h1>
      <p>
        AI 풀이 검토는 코드를 읽는 정적 리뷰입니다. 코드 이해 훈련의 브라우저 실행 테스트는 별도로
        표시하며, 어느 결과도 실제 제품 환경의 모든 동작을 보장하지 않습니다.
      </p>
      <section aria-label="고정 사례 평가 결과">
        <h2>고정된 코드로 확인한 결과</h2>
        <p>
          React, Python, PostgreSQL, Unity의 문제에 정답, 다른 정상 구현, 미완성 코드, 통과를
          유도하는 주석을 넣은 코드 16개를 각각 두 번 제출했습니다. 아래 값은{" "}
          {report.measuredAt.slice(0, 10)} GPT-5.6 Luna의 실제 응답을 측정한 결과입니다.
        </p>
        <div className="quality-metrics">
          <div>
            <span>통과 여부 일치</span>
            <strong>
              {result.agreement === null ? "—" : `${Math.round(result.agreement * 100)}%`}
            </strong>
            <small>
              {result.completed}개 완료 / {result.total}개 평가
            </small>
          </div>
          <div>
            <span>오답을 통과시킨 사례</span>
            <strong>
              {result.falsePasses}
              <small> / {result.negativeCases}</small>
            </strong>
            <small>정답을 거절한 사례 {result.falseRejects}개</small>
          </div>
          <div>
            <span>응답 시간 중앙값</span>
            <strong>
              {result.latencyP50Ms === null ? "—" : `${(result.latencyP50Ms / 1000).toFixed(1)}초`}
            </strong>
            <small>코드 길이와 접속 상황에 따라 달라집니다.</small>
          </div>
        </div>
        <p>
          요구사항별 판정은 {result.criteriaMatched}/{result.criteriaCount}개가 사전에 작성한 기준과
          일치했습니다. 이 작은 개발용 사례 집합은 전체 언어의 정확도를 대표하지 않습니다. 검토
          지침을 개선할 때 같은 사례를 반복해 사용하며, 독립적인 외부 평가나 숨겨진 시험 데이터는
          아닙니다.
        </p>
      </section>
      <section>
        <h2>인수인계 훈련의 검토 범위</h2>
        <p>
          인수인계 훈련은 코드뿐 아니라 구조 이해, 문제 판단, 검증 계획과 인수인계 메모를 함께
          검토합니다. 위의 일반 풀이 평가 수치를 새 훈련의 정확도로 해석하면 안 됩니다. 제공하는
          참고 코드는 저장소 자동 테스트로 확인합니다. 12개 코드 이해 훈련에서는 사용자가 수정한
          JavaScript 코드를 브라우저의 QuickJS 실행 환경에서 제공된 사례로 테스트합니다. DOM,
          네트워크, 타이머는 지원하지 않습니다.
        </p>
        <Link href="/handoff">AI 코드 이해 훈련 살펴보기 →</Link>
      </section>
      <section>
        <h2>실행 근거와 AI 질문은 다릅니다</h2>
        <p>
          실행 결과는 현재 브라우저가 관찰한 값입니다. 서버가 인증한 성적이 아니며, 클라이언트
          기록은 변경될 수 있습니다. AI 질문은 예측과 관찰을 바탕으로 생각할 지점을 제안합니다. AI가
          직접 실행하거나 학습자의 이해도를 확정한 결과로 표현하지 않습니다.
        </p>
        <p>
          맞춤 질문은 기본 GPT-5.6 Luna를 사용하며 풀이 검토와 24시간 20회 한도를 공유합니다. AI
          질문을 받은 과제는 도움 사용으로 기록합니다. 위 고정 사례 평가 수치는 이 새 질문 기능의
          품질 평가 결과가 아닙니다.
        </p>
      </section>
      <section>
        <h2>입문 실습에서 확인하는 것</h2>
        <p>
          기초 미션 6개와 앱 오류 해결 실습 3개는 미리 설계한 모의 앱입니다. 연결 끊기나 사용자
          전환은 실제 네트워크나 계정을 바꾸지 않습니다. 검사 결과는 각 수정안의 모의 동작을 초기
          상태에서 재현해 계산하며 AI 점수가 아닙니다.
        </p>
        <p>
          입문 AI 코치는 서버가 재현한 조작 결과와 작성한 수정 요청을 바탕으로 질문합니다. 기본
          GPT-5.6 Luna와 기존 검토 한도를 공유합니다. 문장 품질이나 실제 제품의 안전성을 인증하지
          않으며, 위의 코드 리뷰 평가 수치를 입문 코치의 정확도로 해석할 수 없습니다.
        </p>
        <Link href="/learn">앱의 원리부터 배우기 →</Link>
      </section>
      <section>
        <h2>피드백은 이렇게 사용하세요</h2>
        <ol>
          <li>요구사항별 통과 여부와 이유를 확인하고, 납득하기 어려운 판단은 직접 검증하세요.</li>
          <li>
            힌트를 먼저 활용하고 정답은 자신의 풀이와 비교하세요. 힌트와 정답을 본 이력은 풀이
            기록에 표시됩니다.
          </li>
          <li>
            실행 확인이 필요하면 자신의 개발 환경에서 테스트하세요. 다른 올바른 구현도 인정하도록
            검토 지침을 관리하고 있습니다.
          </li>
        </ol>
      </section>
      <section>
        <h2>공개 이용과 기록 보관</h2>
        <p>
          문제 풀이는 가입이나 암호 없이 시작할 수 있습니다. 로그인 전 기록은 브라우저별로, 로그인
          후 기록은 계정별로 저장합니다. Google 또는 GitHub로 로그인하면 하루 3회 AI 문제를 생성할
          수 있으며 한국 시간 자정에 갱신됩니다.
        </p>
        <p>
          AI 생성과 검토에는 무료 이용 한도가 있습니다. 현재 남은 횟수는 환경 설정에서 확인할 수
          있습니다. AI 요청 시 문제와 제출 코드를 제공자에게 보내며, 별도 사용량 기록에는 코드 대신
          모델, 지침 버전, 처리 시간과 토큰 수만 저장합니다.
        </p>
      </section>
      <section>
        <h2>검증 과정을 살펴보세요</h2>
        <p>평가 입력, 실제 응답, 변경 전 결과, 테스트와 저장소 구조를 공개했습니다.</p>
        <Link
          href="https://github.com/kwakhyun/codefit/blob/main/docs/engineering.md"
          className="secondary-button"
        >
          설계와 검증 근거 보기 →
        </Link>
      </section>
    </main>
  );
}
