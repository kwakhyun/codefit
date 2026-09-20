"use client";
import { useState, type ReactNode } from "react";
import { ArrowRight, GitBranch, FlaskConical } from "lucide-react";
import { AppLink, Button, Card } from "@/components/ui/primitives";
import type { PracticeMode } from "@/lib/project-check/generated-practice";
export function PracticeEntry({
  mode,
  children,
  initialSample = false,
}: {
  mode: PracticeMode;
  children: ReactNode;
  initialSample?: boolean;
}) {
  const [sample, setSample] = useState(initialSample);
  return (
    <div className="practice-entry">
      <div className="practice-origin" role="group" aria-label="연습 자료 선택">
        <Button aria-pressed={!sample} onClick={() => setSample(false)}>
          <GitBranch size={18} /> 내 프로젝트로 연습
        </Button>
        <Button aria-pressed={sample} onClick={() => setSample(true)}>
          <FlaskConical size={18} /> 샘플로 체험
        </Button>
      </div>
      {sample ? (
        <div className="practice-samples">
          <p className="muted">
            저장소 연결 없이 제공된 예제로 연습합니다. 내 프로젝트 코드와는 별개의 학습입니다.
          </p>
          {children}
        </div>
      ) : (
        <Card className="practice-entry-card">
          <span className="eyebrow">내 프로젝트 코드로 만드는 맞춤 연습</span>
          <h2>
            {mode === "code"
              ? "내 프로젝트의 코드를 설명할 수 있나요?"
              : "내 서비스가 이 상황에서는 어떻게 동작할까요?"}
          </h2>
          <p>
            {mode === "code"
              ? "실제 파일을 읽고 입력이 어떤 처리 과정을 거치는지 예상해 보세요. 코드 근거와 해설을 비교하며 이해를 점검합니다."
              : "내 코드와 연결된 정상 동작과 실패 상황을 모의 실습합니다. 어떤 조건에서 결과가 달라지는지 비교하고, 실제 서비스에서 확인할 일을 정리하세요."}
          </p>
          <ol>
            <li>공개 저장소 연결 또는 분석 기록 선택</li>
            <li>코드 이해 3개와 서비스 동작 3개 생성</li>
            <li>예상, 모의 결과, 내 프로젝트 확인 순서로 연습</li>
          </ol>
          <AppLink className="primary-button" href={`/project-practice?mode=${mode}`}>
            내 프로젝트로 시작하기 <ArrowRight size={18} />
          </AppLink>
          <p className="muted">
            코드를 실행하거나 저장소를 수정하지 않습니다. 저장된 연습은 추가 AI 호출 없이 이어갈 수
            있습니다.
          </p>
        </Card>
      )}
    </div>
  );
}
export function ProjectPracticeLinks({ id }: { id: string }) {
  return (
    <Card className="practice-entry-card">
      <h2>이 프로젝트로 직접 연습하기</h2>
      <p>
        분석한 코드에서 맞춤 문제를 만들고, 처리 흐름과 서비스 동작을 이해해 보세요. 점검 질문에
        모두 답하지 않아도 시작할 수 있습니다.
      </p>
      <div className="practice-origin">
        <AppLink className="primary-button" href={`/project-practice?check=${id}&mode=code`}>
          코드 이해 훈련 <ArrowRight size={16} />
        </AppLink>
        <AppLink className="secondary-button" href={`/project-practice?check=${id}&mode=service`}>
          서비스 동작 실습 <ArrowRight size={16} />
        </AppLink>
      </div>
    </Card>
  );
}
