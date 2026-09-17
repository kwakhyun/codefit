"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
const slides = [
  {
    tag: "01 / 앱의 원리 배우기",
    title: "앱이 작동하는 원리를\n기초부터 배워보세요",
    description:
      "코딩 경험이 없어도 시작할 수 있습니다. 예제 앱으로 실습하며 데이터 저장, 서버 통신, 접근 권한을 배웁니다.",
    href: "/learn",
    cta: "앱의 원리부터 배우기",
    image: "app-foundations",
    accent: "mint",
  },
  {
    tag: "02 / 앱 오류 해결 실습",
    title: "앱 오류를 찾고\n수정하는 방법을 익혀보세요",
    description:
      "메모 저장 실패부터 중복 예약까지. 예제 앱의 오류를 재현하고, AI에게 보낼 수정 요청을 작성한 뒤 수정 결과를 확인합니다.",
    href: "/learn#labs",
    cta: "앱 오류 해결 연습하기",
    image: "debug-lab",
    accent: "amber",
  },
  {
    tag: "03 / AI 코드 이해 훈련",
    title: "AI가 작성한 코드를\n읽고 분석해 보세요",
    description:
      "실행 결과를 예상하고 실제 결과와 비교해 보세요. 코드를 수정하고 테스트하며, 각 코드가 어떤 역할을 하는지 확인합니다.",
    href: "/handoff",
    cta: "AI 코드 이해 훈련",
    image: "read-code",
    accent: "blue",
  },
  {
    tag: "04 / AI 문제 생성",
    title: "원하는 분야와 난이도로\n코딩 문제를 만들어보세요",
    description:
      "기능 구현, 오류 수정, 리팩터링 중 연습할 내용을 고르세요. 로그인하면 하루 3회까지 AI로 문제를 만들 수 있습니다.",
    href: null,
    cta: "AI 문제 만들기",
    image: "practice-builder",
    accent: "violet",
  },
];
function subscribeMotion(fn: () => void) {
  const q = window.matchMedia("(prefers-reduced-motion: reduce)");
  q.addEventListener("change", fn);
  return () => q.removeEventListener("change", fn);
}
export function FeatureBanner({ onGenerate }: { onGenerate: () => void }) {
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const playing = !paused && !reduced && !hover && !hidden;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 8000);
    return () => clearInterval(timer);
  }, [playing]);
  const slide = slides[index];
  const go = (next: number) => {
    setPaused(true);
    setIndex((next + slides.length) % slides.length);
  };
  return (
    <section
      className={`feature-banner ${slide.accent}`}
      aria-label="코드핏 핵심 기능"
      aria-roledescription="캐러셀"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setPaused(true)}
    >
      <div className="feature-banner-top">
        <span>CODE:FIT / 이렇게 연습해요</span>
        <span>{String(index + 1).padStart(2, "0")} / 04</span>
      </div>
      <div className="feature-stage">
        {slides.map((slide, slideIndex) => (
          <div
            className={`feature-slide ${slideIndex === index ? "is-active" : ""}`}
            style={{ left: `${-100 * slideIndex}%` }}
            key={slide.tag}
            inert={slideIndex !== index}
            aria-hidden={slideIndex !== index}
            role="group"
            aria-roledescription="슬라이드"
            aria-label={`${slideIndex + 1} / 4`}
            aria-live={paused && slideIndex === index ? "polite" : "off"}
          >
            <div>
              <span className="eyebrow">{slide.tag}</span>
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
                src={`/images/features/${slide.image}.webp`}
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
      <div className="feature-banner-controls">
        <div className="feature-dots">
          {slides.map((s, i) => (
            <button
              key={s.tag}
              aria-label={`${i + 1}번 기능: ${s.cta}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i)}
            >
              <span />
            </button>
          ))}
        </div>
        <span className="feature-rotation-label">
          {reduced ? "동작 줄이기 적용" : paused ? "자동 전환 멈춤" : "8초마다 다음 기능"}
        </span>
        <button className="icon-button" aria-label="이전 기능" onClick={() => go(index - 1)}>
          <ChevronLeft size={18} />
        </button>
        <button className="icon-button" aria-label="다음 기능" onClick={() => go(index + 1)}>
          <ChevronRight size={18} />
        </button>
        <button
          className="icon-button"
          aria-label={paused ? "배너 자동 전환 시작" : "배너 자동 전환 멈춤"}
          disabled={reduced}
          onClick={() => setPaused((p) => !p)}
        >
          {paused || reduced ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
    </section>
  );
}
