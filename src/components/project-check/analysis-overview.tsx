import { Anchor } from "@/components/ui/primitives";
import type { Check } from "@/lib/project-check/types";

export function AnalysisOverview({ check }: { check: Check }) {
  const review = check.review;
  return (
    <div className="analysis-overview">
      <p className="analysis-lead">{check.analysis.summary}</p>
      <dl className="analysis-facts">
        <div>
          <dt>분석 자료</dt>
          <dd>{check.page.repository ? "공개 코드 발췌" : "공개 서비스 자료"}</dd>
        </div>
        <div>
          <dt>점검할 관점</dt>
          <dd>5가지 설계 질문</dd>
        </div>
        <div>
          <dt>현재 단계</dt>
          <dd>{review ? "피드백 확인과 보완" : "내 설명 작성"}</dd>
        </div>
      </dl>
      <nav className="analysis-journey" aria-label="프로젝트 점검 순서">
        <Anchor href="#project-analysis-overview">
          <span>01</span>
          <strong>프로젝트 이해</strong>
          <small>무엇을 분석했는지 확인</small>
        </Anchor>
        <Anchor href="#project-question-workspace" aria-current={!review ? "step" : undefined}>
          <span>02</span>
          <strong>{review ? "설명과 피드백" : "내 말로 설명"}</strong>
          <small>한 번에 한 질문씩</small>
        </Anchor>
        <Anchor
          href={review ? "#project-follow-up" : "#project-question-workspace"}
          aria-current={review ? "step" : undefined}
        >
          <span>03</span>
          <strong>직접 확인과 보완</strong>
          <small>{review ? "확인 계획을 실제 기록으로" : "답변 후 확인 계획 받기"}</small>
        </Anchor>
      </nav>
      <div className="analysis-next-action">
        <div>
          <strong>
            {review ? "설명한 내용에서 다음 확인으로" : "내가 아는 부분부터 시작하세요"}
          </strong>
          <p>
            {review
              ? "피드백에서 확인할 일을 고르고, 테스트 결과를 남겨 설명을 보완해 보세요."
              : "정답을 외우는 점검이 아닙니다. 근거를 읽고, 아는 내용과 아직 확인할 내용을 나누어 적어보세요."}
          </p>
        </div>
        <Anchor
          className="primary-button"
          href={review ? "#project-follow-up" : "#project-question-workspace"}
        >
          {review ? "확인 계획 보기" : "첫 질문 살펴보기"} →
        </Anchor>
      </div>
    </div>
  );
}
