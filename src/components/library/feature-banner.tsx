"use client";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import type { LearnerType } from "@/lib/learner-types";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
const SLIDE_DURATION = 8000;
const slideCatalog = [
  {
    tag: "01 / 서비스 원리 배우기",
    title: "서비스가 작동하는 원리를\n기초부터 배워보세요",
    description:
      "코딩 경험이 없어도 시작할 수 있습니다. 예제 서비스로 실습하며 데이터 저장, 서버 통신, 접근 권한을 배웁니다.",
    href: "/learn",
    cta: "서비스 원리 배우기",
    image: "/images/experience/principles.webp",
    accent: "mint",
  },
  {
    tag: "02 / 서비스 오류 해결 실습",
    title: "서비스 오류를 찾고\n수정하는 방법을 익혀보세요",
    description:
      "데이터 저장 실패부터 중복 요청까지. 예제 서비스의 오류를 재현하고, AI에게 보낼 수정 요청을 작성한 뒤 수정 결과를 확인합니다.",
    href: "/learn#labs",
    cta: "서비스 오류 해결 연습하기",
    image: "/images/features/debug-lab.webp",
    accent: "amber",
  },
  {
    tag: "03 / AI 코드 이해 훈련",
    title: "AI가 작성한 코드를\n읽고 분석해 보세요",
    description:
      "실행 결과를 예상하고 실제 결과와 비교해 보세요. 코드를 수정하고 테스트하며, 각 코드가 어떤 역할을 하는지 확인합니다.",
    href: "/handoff",
    cta: "AI 코드 이해 훈련",
    image: "/images/experience/code.webp",
    accent: "blue",
  },
  {
    tag: "04 / AI 문제 생성",
    title: "원하는 분야와 난이도로\n코딩 문제를 만들어보세요",
    description:
      "기능 구현, 오류 수정, 리팩터링 중 연습할 내용을 고르세요. 로그인하면 하루 3회까지 AI로 문제를 만들 수 있습니다.",
    href: null,
    cta: "AI 문제 만들기",
    image: "/images/features/practice-builder.webp",
    accent: "violet",
  },
  {
    tag: "내 프로젝트 점검",
    title: "내가 만든 서비스로\n설계 질문을 받아보세요",
    description:
      "서비스의 공개 화면을 바탕으로 질문받고, 빠진 설명과 직접 확인할 방법을 찾아보세요. 예시는 로그인 없이 볼 수 있습니다.",
    href: "/project-check",
    cta: "내 프로젝트 점검",
    image: "/images/experience/project.webp",
    accent: "blue",
  },
  {
    tag: "서비스 보안 점검",
    title: "배포하기 전에\n보안 설정을 확인하세요",
    description:
      "공개 설정을 읽고 권한과 중복 요청의 확인 기록을 남기세요. 공격을 실행하거나 모든 취약점을 검증하는 기능은 아닙니다.",
    href: "/security-check",
    cta: "서비스 보안 점검",
    image: "/images/experience/security.webp",
    accent: "mint",
  },
];
function subscribeMotion(fn: () => void) {
  const q = window.matchMedia("(prefers-reduced-motion: reduce)");
  q.addEventListener("change", fn);
  return () => q.removeEventListener("change", fn);
}
const order: Record<LearnerType, number[]> = {
  starter: [0, 1, 2, 3, 4, 5],
  coder: [2, 4, 3, 0, 1, 5],
  maker: [4, 0, 1, 5, 2, 3],
  builder: [5, 4, 2, 1, 0, 3],
};
export function FeatureBanner({ onGenerate }: { onGenerate: () => void }) {
  const { type } = useLearningPreference();
  return <FeatureCarousel key={type} type={type} onGenerate={onGenerate} />;
}
function FeatureCarousel({ type, onGenerate }: { type: LearnerType; onGenerate: () => void }) {
  const slides = order[type].map((index) => slideCatalog[index]);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [hidden, setHidden] = useState(false);
  const [remaining, setRemaining] = useState(SLIDE_DURATION);
  const [direction, setDirection] = useState("forward");
  const clock = useRef({ remaining: SLIDE_DURATION, updatedAt: 0 });
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const playing = !paused && !reduced && !hover && !hidden;
  useEffect(() => {
    if (!playing) return;
    clock.current.updatedAt = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      clock.current.remaining -= now - clock.current.updatedAt;
      clock.current.updatedAt = now;
      if (clock.current.remaining <= 0) {
        clock.current.remaining = SLIDE_DURATION;
        setDirection("forward");
        setIndex((i) => (i + 1) % slides.length);
      }
      setRemaining(clock.current.remaining);
    }, 100);
    return () => {
      clearInterval(timer);
      clock.current.remaining = Math.max(
        0,
        clock.current.remaining -
          (clock.current.updatedAt ? Date.now() - clock.current.updatedAt : 0),
      );
    };
  }, [playing, slides.length]);
  const slide = slides[index];
  const handleGo = (next: number) => {
    setPaused(true);
    setDirection(next < index ? "backward" : "forward");
    clock.current = { remaining: SLIDE_DURATION, updatedAt: 0 };
    setRemaining(SLIDE_DURATION);
    setIndex((next + slides.length) % slides.length);
  };
  return (
    <section
      className={`feature-banner ${slide.accent}`}
      data-direction={direction}
      aria-label="코드핏 핵심 기능"
      aria-roledescription="캐러셀"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={(event) => {
        if (!(event.target as HTMLElement).closest("[data-playback]")) setPaused(true);
      }}
    >
      <div className="feature-banner-top">
        <span>CODE:FIT / 이렇게 연습해요</span>
        <span>
          {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>
      </div>
      <div className="feature-stage">
        {slides.map((slide, slideIndex) => (
          <div
            className={`feature-slide ${slide.accent} ${slideIndex === index ? "is-active" : ""}`}
            style={{ left: `${-100 * slideIndex}%` }}
            key={slide.tag}
            inert={slideIndex !== index}
            aria-hidden={slideIndex !== index}
            role="group"
            aria-roledescription="슬라이드"
            aria-label={`${slideIndex + 1} / ${slides.length}`}
            aria-live={paused && slideIndex === index ? "polite" : "off"}
          >
            <div className="feature-copy">
              <span className="eyebrow">{slide.tag.replace(/^\d+ \/ /, "")}</span>
              <h2>{slide.title}</h2>
              <p>{slide.description}</p>
              {slide.href ? (
                <Link className="primary-button" href={slide.href}>
                  {slide.cta}
                  <ArrowRight size={17} />
                </Link>
              ) : (
                <button
                  className="primary-button"
                  onClick={(event) => {
                    // Safari does not focus clicked buttons; give the dialog a return target.
                    event.currentTarget.focus();
                    onGenerate();
                  }}
                >
                  {slide.cta}
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
            <div className="feature-art" aria-hidden="true">
              <Image
                src={slide.image}
                alt=""
                width={960}
                height={640}
                loading={slideIndex === 0 ? "eager" : "lazy"}
                unoptimized
              />
            </div>
          </div>
        ))}
      </div>
      <div className="feature-time-track" aria-hidden="true">
        <span style={{ transform: `scaleX(${1 - remaining / SLIDE_DURATION})` }} />
      </div>
      <div className="feature-banner-controls">
        <div className="feature-dots feature-topic-rail" aria-label="기능 바로 선택">
          {slides.map((s, i) => (
            <button
              key={s.tag}
              aria-label={`${i + 1}번 기능: ${s.cta}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => handleGo(i)}
            >
              <span>{s.tag.replace(/^\d+ \/ /, "")}</span>
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          data-playback
          aria-label={!paused && !reduced ? "배너 자동 넘김 멈추기" : "배너 자동 넘김 시작하기"}
          onClick={() => setPaused((value) => !value)}
          disabled={reduced}
        >
          {!paused && !reduced ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="icon-button" aria-label="이전 기능" onClick={() => handleGo(index - 1)}>
          <ChevronLeft size={18} />
        </button>
        <button className="icon-button" aria-label="다음 기능" onClick={() => handleGo(index + 1)}>
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
