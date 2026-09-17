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
          AI가 작성한 코드, 왜 그렇게 동작하는지 설명할 수 있나요?
          <br /> 결과를 예상하고, 직접 실행하고, 고치며 이해하는 힘을 기릅니다.
        </p>
        <div className="training-principle">
          <FileCode2 size={19} />
          <span>내가 이해하고 판단할 수 있는 코드로. 예측부터 수정, 응용까지.</span>
        </div>
        <Link href="/handoff" className="handoff-entry">
          <strong>AI 코드 이해 훈련</strong>
          <span>
            짧은 코드로 시작하는 예측과 실행 연습 <ArrowUpRight size={16} />
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
            <span className="terminal-value">code-understanding</span>
          </p>
          <div className="terminal-output">
            <span>
              <Check size={12} />
              예측 — 실행 전에 내 생각 남기기
            </span>
            <span>
              <Check size={12} />
              확인 — 예상과 실제 결과 비교하기
            </span>
            <span>
              <Check size={12} />
              응용 — 다른 상황에서도 직접 풀기
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
