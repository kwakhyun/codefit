"use client";

import { useLearningHistory } from "@/hooks/use-learning-history";
import type { LibraryController } from "@/hooks/use-library-controller";

import { dateLabel } from "@/lib/client-api";
import { problemUrl } from "@/lib/library-state";
import type { Workspace } from "@/lib/problem";
import {
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCode2,
  History,
} from "lucide-react";
import Link from "next/link";
interface LearningHistoryProps {
  data: Workspace;
  library: LibraryController;
}
export function LearningHistory({ data, library }: LearningHistoryProps) {
  const history = useLearningHistory(data);
  const { solved, inProgress, saved, training, libraryHref } = library;
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">YOUR LEARNING LOG</span>
        <h1>쌓이는 코드, 선명해지는 실력.</h1>
        <p>지난 풀이를 돌아보고 다음 시도를 이어가세요.</p>
      </div>
      <div className="stats-row history-stats">
        <div>
          <span>
            <CheckCircle2 size={16} />
            해결한 문제
          </span>
          <strong>
            {solved}
            <small>문제</small>
          </strong>
        </div>
        <div>
          <span>
            <FileCode2 size={16} />
            검토한 풀이
          </span>
          <strong>
            {data.stats.attempts}
            <small>회</small>
          </strong>
        </div>
        <div>
          <span>
            <Clock3 size={16} />
            진행 중
          </span>
          <strong>
            {inProgress}
            <small>문제</small>
          </strong>
        </div>
        <div>
          <span>
            <Bookmark size={16} />
            다시 풀 문제
          </span>
          <strong>
            {saved}
            <small>문제</small>
          </strong>
        </div>
      </div>
      <section className="training-overview" aria-label="최근 7일 훈련 현황">
        <div>
          <span className="eyebrow">꾸준함이 실력이 됩니다</span>
          <h2>
            {training.streak ? `${training.streak}일 연속 훈련 중` : "오늘의 첫 풀이를 남겨 보세요"}
          </h2>
          <p>
            최근 7일 중 {training.activeDays}일 훈련 · 도움 없이 해결한 문제{" "}
            {training.independentSolved}개
          </p>
          <small>AI 검토를 완료한 날 기준 · 한국 시간</small>
        </div>
        <div className="training-week">
          {training.week.map((day) => (
            <span
              key={day.label}
              className={day.active ? "active" : ""}
              aria-label={`${day.label} ${day.active ? "훈련 완료" : "검토 기록 없음"}`}
            >
              <Check size={16} />
              <small>{day.label}</small>
            </span>
          ))}
        </div>
      </section>
      <section className="history-section">
        <div className="section-heading">
          <h2>
            풀이 타임라인 <span>{data.stats.attempts}</span>
          </h2>
          <span className="muted">최근 검토 순</span>
        </div>
        {history.loading && !history.attempts.length ? (
          <p role="status">풀이 기록을 불러오는 중입니다.</p>
        ) : !history.error && data.stats.attempts === 0 ? (
          <div className="empty-state bordered">
            <History size={36} />
            <h2>첫 번째 기록을 남겨 보세요.</h2>
            <p>문제를 풀고 AI 검토를 받으면 풀이와 피드백이 여기에 쌓입니다.</p>
            <Link className="primary-button" href="/">
              문제 고르기
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="timeline">
            {history.attempts.map((a) => {
              return (
                <Link
                  href={problemUrl(a.problemId, libraryHref, a.id)}
                  className="timeline-item"
                  key={a.id}
                >
                  <span className={a.review.passed ? "timeline-icon solved" : "timeline-icon"}>
                    {a.review.passed ? <CheckCircle2 size={20} /> : <FileCode2 size={19} />}
                  </span>
                  <div>
                    <div>
                      <span className="mono">{dateLabel(a.createdAt)}</span>
                      <span>{a.assisted ? "힌트 / 정답 참고" : "직접 풀이"}</span>
                    </div>
                    <h3>{a.problemTitle}</h3>
                    <p>{a.review.summary}</p>
                  </div>
                  <strong className={a.review.passed ? "success-text" : "muted"}>
                    {a.review.score}%
                  </strong>
                  <ChevronRight size={18} />
                </Link>
              );
            })}
          </div>
        )}
        {history.error && (
          <p className="inline-error" role="alert">
            {history.error}
          </p>
        )}
        {(history.nextCursor || history.error) && (
          <button
            className="secondary-button"
            onClick={history.loadMore}
            disabled={history.loading}
          >
            {history.loading
              ? "불러오는 중…"
              : history.error
                ? "다시 불러오기"
                : "이전 풀이 더 보기"}
          </button>
        )}
      </section>
    </>
  );
}
