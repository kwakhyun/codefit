"use client";
import { AiLearningEntry } from "@/components/ai-learning/ai-learning-entry";
import { Card, Status } from "@/components/ui/primitives";
import { SectionArtwork, type ArtworkTopic } from "@/components/experience/section-artwork";
import { LearningPreferencePicker } from "./learning-preference";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { useRef } from "react";
import { problemUrl } from "@/lib/library-state";
import type { ProblemSummary, ProgressSummary } from "@/lib/problem";
import { AppLink as Link } from "@/components/ui/primitives";
import { FeatureBanner } from "./feature-banner";
import { LearningResume } from "@/components/learn/learning-resume";
import { ProjectResume } from "./project-resume";
import { GuestLogin } from "@/components/account/guest-login";
interface TrainingHeroProps {
  recommended: ProblemSummary | undefined;
  libraryHref: string;
  resume: ProgressSummary | undefined;
  scope: string;
  onGenerate: () => void;
}
const paths = {
  starter: [
    [
      "/learn/broken-memo",
      "연결이 끊겼는데 저장 완료라면",
      "저장 실패를 알아보고 다시 시도하는 흐름을 확인해요.",
    ],
    [
      "/learn/private-board",
      "누가 읽을 수 있나요?",
      "다른 사용자의 비공개 글에 접근하는 상황을 실험해요.",
    ],
  ],
  coder: [
    [
      "/problems/handoff-cart?from=%2Fhandoff",
      "장바구니 코드 인수인계",
      "예상 → 실행 → 수정 → 설명 순서로 훈련해요.",
    ],
    ["/?view=browse", "분야별 코드 문제", "구현, 오류 수정, 리팩터링 문제를 골라요."],
  ],
  maker: [
    [
      "/learn/private-board",
      "내 서비스의 접근 권한 이해하기",
      "예제에서 권한 문제를 재현하고 AI 수정 요청을 연습해요.",
    ],
    ["/learn/double-booking", "예약이 두 번 생긴다면", "같은 작업의 재시도와 새 요청을 구분해요."],
  ],
  builder: [
    [
      "/security-check",
      "공개 설정과 수동 확인 기록",
      "공개 응답을 확인하고 내 테스트 환경의 검증 결과를 남겨요.",
    ],
    [
      "/project-check",
      "설계 설명과 보완 답변",
      "저장, 권한, 실패 처리의 근거를 질문으로 점검해요.",
    ],
  ],
} as const;
export function TrainingHero({
  recommended,
  libraryHref,
  resume,
  scope,
  onGenerate,
}: TrainingHeroProps) {
  const { type, profile, hasChosen, storageError } = useLearningPreference();
  const heading = useRef<HTMLHeadingElement>(null);
  const codeResume =
    resume && recommended ? (
      <Card as="section" className="resume-card illustrated-resume" aria-label="코딩 문제 이어하기">
        <SectionArtwork topic="code" />
        <div>
          <span className="eyebrow">작성 중인 코드</span>
          <h2>{recommended.title}</h2>
          <p>저장된 코드부터 이어서 풀어보세요.</p>
        </div>
        <Link className="primary-button" href={problemUrl(recommended.id, libraryHref)}>
          이어서 훈련하기 →
        </Link>
      </Card>
    ) : null;
  return (
    <div className="training-welcome" data-learner-type={type}>
      <div className="home-heading">
        <span className="eyebrow">{profile.name} · 나에게 맞는 연습실</span>
        <h1 ref={heading} tabIndex={-1}>
          {profile.title}
        </h1>
        <p>{profile.description}</p>
      </div>
      <ProjectResume key={scope} scope={scope} />
      <section aria-label={!hasChosen ? "처음 방문한 분의 시작점" : "추천 시작점"}>
        <FeatureBanner onGenerate={onGenerate} />
      </section>
      {!hasChosen && (
        <LearningPreferencePicker
          onSelect={() => requestAnimationFrame(() => heading.current?.focus())}
        />
      )}
      {hasChosen && storageError && (
        <Status role="status">
          브라우저에 저장할 수 없어 현재 화면에서만 적용됩니다. 재방문할 때 다시 선택해 주세요.
        </Status>
      )}
      <AiLearningEntry />
      <div className="persona-home-primary">
        {type === "coder" &&
          (codeResume || (
            <Card
              as="section"
              className="resume-card illustrated-resume"
              aria-label="추천 코드 훈련"
            >
              <SectionArtwork topic="code" />
              <div>
                <span className="eyebrow">첫 코드 이해 훈련</span>
                <h2>장바구니 상태를 인수인계해 보세요</h2>
                <p>실행 결과를 먼저 예상하고, 원본과 수정 코드를 비교합니다.</p>
              </div>
              <Link className="primary-button" href="/problems/handoff-cart?from=%2Fhandoff">
                코드 훈련 시작 →
              </Link>
            </Card>
          ))}
        {type === "builder" && (
          <Card as="section" className="persona-security-start illustrated-panel">
            <SectionArtwork topic="security" />
            <span className="eyebrow">공개 설정부터 확인하기</span>
            <h2>배포 전 확인할 항목을 정리하세요</h2>
            <p>
              서비스 링크의 공개 보안 설정을 확인하고 권한과 중복 요청의 수동 확인 메모를 남깁니다.
              취약점 전체를 자동 검증하는 기능은 아닙니다.
            </p>
            <Link className="primary-button" href="/security-check">
              보안 설정과 확인 기록 열기 →
            </Link>
          </Card>
        )}
      </div>
      <section className="persona-next-steps" aria-label={`${profile.name} 추천 경로`}>
        <h2>
          {type === "starter"
            ? "점검 중 막힌 부분을 예제로 확인하기"
            : type === "coder"
              ? "코드로 이어가는 연습"
              : type === "maker"
                ? "점검에서 발견한 빈틈을 이해하는 보조 실습"
                : "설계와 실제 동작을 함께 확인하기"}
        </h2>
        <div>
          {paths[type].map(([href, title, description]) => (
            <Link key={href} href={href} className="visual-path-card">
              <SectionArtwork topic={pathArtwork(href)} />
              <strong>{title} →</strong>
              <p>{description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="persona-other-records" aria-label="다른 학습 이어하기">
        <div className="section-heading">
          <SectionArtwork topic="progress" className="section-heading-art" />
          <h2>다른 학습도 이어갈 수 있어요</h2>
          <Link href="/?view=history">모든 학습 기록 →</Link>
        </div>
        <LearningResume key={scope} scope={scope} />
        {type !== "coder" && codeResume}
        <p>타입을 바꿔도 이전 학습 기록과 작성 중인 코드는 그대로 남습니다.</p>
      </section>
      {scope.startsWith("guest:") && <GuestLogin returnTo="/" />}
    </div>
  );
}

function pathArtwork(href: string): ArtworkTopic {
  if (href.includes("security") || href.includes("private-board")) return "security";
  if (href.includes("project")) return "project";
  if (href.includes("handoff") || href.includes("browse")) return "code";
  return "principles";
}
