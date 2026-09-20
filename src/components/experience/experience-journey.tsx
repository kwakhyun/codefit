"use client";
import { useFadeTransition } from "@/components/ui/use-fade-transition";
import { ToggleButton } from "@/components/ui/primitives";
import { useId, useState } from "react";
import { ArrowRight, Check, MousePointer2, Play, Search } from "lucide-react";
const journeys = {
  principles: [
    [
      "예상하기",
      "새로고침하면 입력한 내용은 어디에 남을까요?",
      "정답을 보기 전에 내 생각을 선택합니다.",
    ],
    [
      "직접 조작하기",
      "저장, 새로고침, 사용자 전환 버튼을 눌러 보세요.",
      "실행 결과가 예상과 어떻게 다른지 관찰합니다.",
    ],
    [
      "수정하고 확인하기",
      "관찰 기록으로 수정 요청을 만들고 변경 결과를 비교해요.",
      "문제가 해결됐는지와 원래 기능이 유지되는지 함께 검사합니다.",
    ],
  ],
  code: [
    [
      "실행 전 예상",
      "코드를 읽고 어떤 값이 나올지 먼저 적어 보세요.",
      "아직 실행하지 않은 나의 첫 생각을 남깁니다.",
    ],
    [
      "두 결과 비교",
      "원본과 수정 코드를 실행해 차이를 확인하세요.",
      "예상과 실제 결과를 나란히 비교하고 근거를 찾습니다.",
    ],
    [
      "내 말로 설명",
      "수정한 이유와 확인한 사례를 정리해 보세요.",
      "새 조건의 과제에서 같은 원리를 적용합니다.",
    ],
  ],
  project: [
    [
      "프로젝트 자료 읽기",
      "서비스 주소나 GitHub 저장소로 시작하세요.",
      "화면 또는 코드의 근거와 확인하지 못한 범위를 구분합니다.",
    ],
    [
      "설계 질문에 답하기",
      "저장, 권한, 실패 처리와 설계 선택을 설명해요.",
      "확인한 사실과 아직 확인할 계획을 구별해서 적습니다.",
    ],
    [
      "확인하고 보완하기",
      "피드백에 나온 확인 과제를 내 프로젝트에서 수행하세요.",
      "첫 답변을 보관하고 보완 답변을 추가할 수 있습니다.",
    ],
  ],
  security: [
    [
      "점검 범위 정하기",
      "내가 소유하거나 점검 권한이 있는 공개 주소를 입력하세요.",
      "기본 점검은 공개 응답을 읽고, CORS 테스트는 로그인과 소유권 확인 후 실행합니다.",
    ],
    [
      "관찰 근거 확인",
      "보안 설정별 관찰 내용과 보완 방법을 확인하세요.",
      "헤더의 유무와 실제 취약점의 존재는 서로 다릅니다.",
    ],
    [
      "내 환경에서 검증",
      "소유권 확인 후 CORS를 비교하거나 ZAP 보고서를 가져오세요.",
      "요청과 응답 근거, 수정 요청과 재검사 기록표를 내려받습니다.",
    ],
  ],
} as const;
const icons = [Search, Play, Check];
export function ExperienceJourney({ topic }: { topic: keyof typeof journeys }) {
  const [active, setActive] = useState(0);
  const fade = useFadeTransition<HTMLDivElement>(active);
  const id = useId();
  const steps = journeys[topic];
  return (
    <section className="experience-journey" aria-label="진행 방식 미리보기">
      <div className="journey-label">
        <MousePointer2 size={15} aria-hidden="true" /> 단계를 눌러 진행 방식을 살펴보세요
      </div>
      <div className="journey-options" role="group" aria-label="미리 볼 단계">
        {steps.map(([title], index) => {
          const Icon = icons[index];
          return (
            <ToggleButton
              key={title}
              type="button"
              aria-pressed={index === active}
              aria-controls={id}
              onClick={() => setActive(index)}
            >
              <span className="journey-number">0{index + 1}</span>
              <Icon size={19} aria-hidden="true" />
              <strong>{title}</strong>
              <ArrowRight size={16} aria-hidden="true" />
            </ToggleButton>
          );
        })}
      </div>
      <div ref={fade} id={id} className="journey-detail" aria-live="polite">
        <strong>{steps[active][1]}</strong>
        <p>{steps[active][2]}</p>
      </div>
    </section>
  );
}
