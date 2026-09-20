"use client";
import { ProjectAiEntry } from "@/components/ai-learning/project-ai-entry";
import Image from "next/image";
import { ProjectQuickStart } from "@/components/project-practice/project-quick-start";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ProjectExample } from "@/components/project-check/project-example";
import {
  ArrowRight,
  ShieldCheck,
  ClipboardCheck,
  Workflow,
  Code2,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { AppLink as Link, Button, Card, Status } from "@/components/ui/primitives";
import { LearningPreferencePicker } from "./learning-preference";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { useAiLearningProgress } from "@/hooks/use-ai-learning-progress";
import { AI_LESSONS } from "@/lib/ai-learning/catalog";
import { DOMAINS } from "@/lib/catalog";
import { DomainIcon } from "@/components/ui/problem-badges";
import { problemUrl } from "@/lib/library-state";
import type { ProblemSummary, ProgressSummary } from "@/lib/problem";
import { FeatureBanner } from "./feature-banner";
import { ProjectResume } from "./project-resume";
import { LearningResume } from "@/components/learn/learning-resume";
interface TrainingHeroProps {
  recommended: ProblemSummary | undefined;
  libraryHref: string;
  resume: ProgressSummary | undefined;
  scope: string;
  onGenerate: () => void;
}
export function TrainingHero({
  recommended,
  libraryHref,
  resume,
  scope,
  onGenerate,
}: TrainingHeroProps) {
  const { type, profile, hasChosen, storageError } = useLearningPreference();
  const home = useRef<HTMLDivElement>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  if (!hasChosen)
    return (
      <div className="workspace-welcome" ref={home}>
        <span className="eyebrow">나의 CODE:FIT</span>
        <h1>내 프로젝트로 배우고, 직접 확인하세요</h1>
        <ProjectQuickStart key={scope} scope={scope} />
        <h2>관심 있는 학습 공간도 골라보세요</h2>
        <LearningPreferencePicker
          onSelect={() =>
            requestAnimationFrame(() => home.current?.querySelector<HTMLElement>("h1")?.focus())
          }
        />
        <FeatureBanner onGenerate={onGenerate} />
      </div>
    );
  return (
    <div
      ref={home}
      className={`workspace-home workspace-${type}`}
      key={type}
      data-learner-type={type}
    >
      {storageError && (
        <Status role="status">선택을 저장하지 못했어요. 현재 화면에는 적용됩니다.</Status>
      )}
      {type === "service" && (
        <>
          <section
            className="service-home-hero service-home-connected"
            aria-label="서비스 점검 시작"
          >
            <div className="workspace-hero-copy">
              <span className="eyebrow">{profile.name}</span>
              <h1 tabIndex={-1}>{profile.title}</h1>
              <p>
                저장소 링크 하나로 내 코드의 빈틈을 살펴보세요.
                <br />
                프로젝트 점검부터 코드 이해와 서비스 동작 연습까지.
              </p>
              <ProjectQuickStart key={scope} scope={scope} embedded />
            </div>
            <WorkspaceArt image={profile.image} />
          </section>
          <ProjectResume key={scope} scope={scope} />
          <section className="service-check-path" aria-label="서비스 확인 순서">
            <h2>질문에서 끝내지 않고, 확인까지</h2>
            <ol>
              {[
                ["01", "설계 설명하기", "저장, 권한, 실패 처리에 관한 질문에 내 구현을 설명해요."],
                ["02", "빈틈 찾기", "확인한 사실과 아직 검증하지 않은 부분을 구분해요."],
                ["03", "다시 확인하기", "내 서비스에서 직접 검사하고 보완 답변을 남겨요."],
              ].map(([n, title, copy]) => (
                <li key={n}>
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </li>
              ))}
            </ol>
          </section>
          <div className="service-support-grid">
            <Link href="/security-check" className="workspace-tool">
              <ShieldCheck />
              <div>
                <h3>공개 보안 설정도 확인하세요</h3>
                <p>공개 응답을 점검하고 직접 검증한 결과를 기록해요.</p>
              </div>
              <ArrowRight />
            </Link>
            <Button className="workspace-tool" onClick={() => setExampleOpen(true)}>
              <ClipboardCheck />
              <div>
                <h3>점검 예시 먼저 살펴보기</h3>
                <p>어떤 질문과 피드백을 받는지 확인하세요.</p>
              </div>
              <ArrowRight />
            </Button>
          </div>
          <Modal
            open={exampleOpen}
            onClose={() => setExampleOpen(false)}
            title="프로젝트 점검 예시"
          >
            <ProjectExample />
          </Modal>
          <section className="workspace-secondary">
            <div className="section-heading">
              <h2>필요한 원리만 보충하기</h2>
              <Link href="/learn">서비스 원리 배우기 →</Link>
            </div>
            <LearningResume scope={scope} />
            <div className="workspace-inline-links">
              <Link href="/learn/private-board">비공개 글 접근 권한</Link>
              <Link href="/learn/double-booking">중복 요청과 재시도</Link>
              <Link href="/learn/broken-memo">저장 실패와 복구</Link>
            </div>
          </section>
        </>
      )}
      {type === "ai" && <AiWorkshop image={profile.image} title={profile.title} />}
      {type === "code" && (
        <>
          <section className="code-home-hero" aria-label="코딩 연습 시작">
            <div className="workspace-hero-copy">
              <span className="eyebrow">{profile.name}</span>
              <h1 tabIndex={-1}>{profile.title}</h1>
              <p>
                분야를 고르고 바로 코딩하세요.
                <br />
                원하는 문제가 없다면 AI로 새 과제를 만들 수 있어요.
              </p>
              <div className="workspace-inline-links">
                <Link className="primary-button" href="#problem-library">
                  문제 골라 풀기 <ArrowRight size={18} />
                </Link>
                <Button className="secondary-button" onClick={onGenerate}>
                  <Sparkles size={17} /> AI 문제 만들기
                </Button>
              </div>
            </div>
            <WorkspaceArt image={profile.image} />
          </section>
          {resume && recommended && (
            <Card className="code-resume">
              <Code2 />
              <div>
                <span className="eyebrow">작성 중인 코드</span>
                <h2>{recommended.title}</h2>
              </div>
              <Link className="primary-button" href={problemUrl(recommended.id, libraryHref)}>
                이어서 풀기 →
              </Link>
            </Card>
          )}
          <section className="code-domain-section" aria-label="연습할 분야 선택">
            <h2>어느 분야를 연습할까요?</h2>
            <div className="code-domain-grid">
              {DOMAINS.map((d) => (
                <Link key={d.id} href={`/?domain=${d.id}`}>
                  <DomainIcon domain={d.id} />
                  <span>{d.label}</span>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          </section>
          <Link className="code-reading-link" href="/handoff">
            <Code2 />
            <div>
              <h2>AI 코드, 실행 전에 읽어보기</h2>
              <p>내 프로젝트 코드로 연습하거나 준비된 샘플 12개를 체험해 보세요.</p>
            </div>
            <ArrowRight />
          </Link>
        </>
      )}
    </div>
  );
}
function WorkspaceArt({ image }: { image: string }) {
  return (
    <div className="workspace-art" aria-hidden="true">
      <Image
        src={`/images/personas/${image}.webp`}
        width={1200}
        height={800}
        alt=""
        sizes="(max-width: 700px) 90vw, 480px"
        priority
      />
    </div>
  );
}
function AiWorkshop({ image, title }: { image: string; title: string }) {
  const { records, ready, storageError } = useAiLearningProgress();
  const completed = AI_LESSONS.filter((l) => records[l.id]?.completed).length;
  const recent = AI_LESSONS.filter((l) => records[l.id] && !records[l.id]?.completed).sort(
    (a, b) => (records[b.id]?.updatedAt || 0) - (records[a.id]?.updatedAt || 0),
  )[0];
  const next = recent || AI_LESSONS.find((l) => !records[l.id]?.completed);
  return (
    <>
      <section className="ai-home-hero" aria-label="AI 실무 학습 시작">
        <div className="workspace-hero-copy">
          <span className="eyebrow">AI 워크숍 / 15개 분야, 32개 수업</span>
          <h1 tabIndex={-1}>{title}</h1>
          <p>
            내 프로젝트에는 어떤 AI가 어울릴까요? <br />
            사용 중인 기술부터 새로운 적용 아이디어까지, 코드로 배워요.
          </p>
          <ProjectAiEntry />
          <Link className="ai-home-catalog-link" href="/learn/ai#ai-catalog">
            전체 수업 둘러보기 <ArrowRight size={18} />
          </Link>
        </div>
        <WorkspaceArt image={image} />
      </section>
      <div className="ai-home-grid">
        <section className="ai-home-resume">
          <span className="eyebrow">내 학습 여정</span>
          <div className="ai-home-count">
            <strong>{ready ? completed : "—"}</strong>
            <span>/ 32개 수업 완료</span>
          </div>
          <h2>{ready ? next?.title || "모든 수업을 마쳤어요" : "학습 기록 확인 중"}</h2>
          <p>
            {recent
              ? "학습하던 단계부터 이어갑니다."
              : next
                ? "한 가지 개념을 익히고, 선택에 따른 결과를 비교해 보세요."
                : "관심 있는 수업을 다시 살펴보세요."}
          </p>
          <Link className="primary-button" href={next ? `/learn/ai/${next.id}` : "/learn/ai"}>
            {recent ? "이어서 배우기" : next ? "이 수업 시작하기" : "수업 다시 보기"}{" "}
            <ArrowRight size={17} />
          </Link>
          <small>
            {storageError
              ? "현재 탭에서만 기록돼요. 브라우저 저장을 사용할 수 없습니다."
              : "학습 위치는 이 브라우저에 저장돼요."}
          </small>
        </section>
        <section className="ai-home-routes">
          <h2>해보고 싶은 일로 고르세요</h2>
          {[
            [
              "agent-workflow",
              "01",
              "AI에게 반복 업무 맡기기",
              "에이전트 → 도구 연결 → 워크플로우",
            ],
            ["llamaindex", "02", "내 문서에서 답 찾기", "문서 검색 → RAG → 답변 평가"],
            ["local-start", "03", "내 컴퓨터에서 AI 쓰기", "실행 준비 → 연결 → 채팅 화면"],
          ].map(([id, n, name, desc]) => (
            <Link key={id} href={`/learn/ai/${id}`}>
              <span>{n}</span>
              <div>
                <h3>{name}</h3>
                <p>{desc}</p>
              </div>
              <ArrowRight size={18} />
            </Link>
          ))}
        </section>
      </div>
      <section className="ai-home-topics">
        <h2>다음에 확장할 주제</h2>
        <div>
          {[
            ["langchain", "LangChain과 LangGraph", "모델과 도구를 연결하는 구조", Workflow],
            ["n8n", "업무 자동화", "입력부터 결과까지 흐름 만들기", Sparkles],
            ["output-validation", "AI 결과 검증", "출력 형식과 실패 처리 확인하기", ShieldCheck],
          ].map(([id, name, desc, Icon]) => (
            <Link href={`/learn/ai/${id}`} key={id as string}>
              {typeof Icon !== "string" && <Icon size={24} />}
              <h3>{name as string}</h3>
              <p>{desc as string}</p>
              <span>수업 살펴보기 →</span>
            </Link>
          ))}
        </div>
      </section>
      <Link className="workspace-tool" href="/project-check">
        <BookOpen />
        <div>
          <h3>배운 내용을 내 서비스에 적용해 볼까요?</h3>
          <p>프로젝트 점검에서 설계를 설명하고 확인할 일을 찾아보세요.</p>
        </div>
        <ArrowRight />
      </Link>
    </>
  );
}
