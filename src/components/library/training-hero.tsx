"use client";

import { problemUrl } from "@/lib/library-state";
import type { ProblemSummary, ProgressSummary } from "@/lib/problem";
import { ArrowUpRight, Check, FileCode2, Terminal } from "lucide-react";
import Link from "next/link";
interface TrainingHeroProps {
  recommended: ProblemSummary | undefined;
  libraryHref: string;
  resume: ProgressSummary | undefined;
}
export function TrainingHero({ recommended, libraryHref, resume }: TrainingHeroProps) {
  return (
    <section className="library-hero">
      <div className="hero-copy">
        <span className="eyebrow">
          <span className="status-dot" /> AI 시대의 코딩 근력, CODE:FIT
        </span>
        <h1>
          <span className="hero-headline-line">AI가 코드를 짜도,</span>
          <span className="hero-headline-line">
            내 실력은 녹슬지 않게<span className="accent">_</span>
          </span>
        </h1>
        <p>
          AI에게 코딩을 맡기는 동안, 내 손으로 푸는 감각도 챙기세요.
          <br /> 기능 구현, 버그 수정, 리팩터링을 직접 풀며 실력을 단련합니다.
        </p>
        <div className="training-principle">
          <FileCode2 size={19} />
          <span>문제는 AI가 출제하고, 풀이는 직접. 막힐 때는 힌트와 피드백.</span>
        </div>
        <Link href="/handoff" className="handoff-entry">
          <strong>NEW / AI 코드 인수인계 훈련</strong>
          <span>
            이해하고, 고치고, 검증하며 내 코드로 만들기 <ArrowUpRight size={16} />
          </span>
        </Link>
        {recommended && (
          <Link href={problemUrl(recommended.id, libraryHref)} className="hero-start">
            {resume ? "이어서 훈련하기" : "오늘의 코딩 훈련 시작"}
            <ArrowUpRight size={16} />
            <span>
              {resume
                ? "저장된 코드부터 이어서"
                : `약 ${recommended.minutes}분 / 난이도 ${recommended.difficulty}`}
            </span>
          </Link>
        )}
      </div>
      <div className="hero-terminal" aria-label="코딩 근력 훈련 과정">
        <div className="terminal-title">
          <span>
            <i />
            <i />
            <i />
          </span>
          <span>CODE:FIT / DAILY TRAINING</span>
          <Terminal size={13} />
        </div>
        <div className="terminal-body">
          <div>
            <span className="terminal-prompt">C:\CODEFIT&gt;</span>{" "}
            <span className="muted">train.exe</span>
          </div>
          <p>
            <span className="terminal-flag">/mode:</span>
            <span className="terminal-value">hands-on</span>
          </p>
          <div className="terminal-output">
            <span>
              <Check size={12} />
              구현 — 요구사항을 코드로 옮기기
            </span>
            <span>
              <Check size={12} />
              디버깅 — 원인을 찾고 직접 고치기
            </span>
            <span>
              <Check size={12} />
              리팩터링 — 더 나은 구조로 다듬기
            </span>
          </div>
          <div className="terminal-bottom">
            <span className="accent">C:\CODEFIT&gt;</span>
            <span className="block-cursor" />
          </div>
        </div>
        <div className="terminal-foot">
          <span className="status-dot" /> KEEP YOUR CODING MUSCLE.
        </div>
      </div>
    </section>
  );
}
