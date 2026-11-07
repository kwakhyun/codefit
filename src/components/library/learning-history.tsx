"use client";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { Status, Button, ToggleButton } from "@/components/ui/primitives";
import { VisualIntro } from "@/components/experience/visual-intro";
import { LearningResume } from "@/components/learn/learning-resume";

import { useLearningHistory, type HistoryFilter } from "@/hooks/use-learning-history";
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
import { AppLink as Link } from "@/components/ui/primitives";
import { useState } from "react";
interface LearningHistoryProps {
  data: Workspace;
  library: LibraryController;
}
export function LearningHistory({ data, library }: LearningHistoryProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const history = useLearningHistory(data, filter);
  const today = library.training.today;
  const todayItems = today
    ? [
        ["코딩 문제 검토", today.coding, "회"],
        ["코드 이해 훈련 검토", today.understanding, "회"],
        ["서비스 원리 미션 완료", today.missions, "개"],
        ["AI 실무 수업 완료", today.lessons, "개"],
      ].filter(([, count]) => Number(count) > 0)
    : [];
  const { solved, inProgress, saved, training, libraryHref } = library;
  return (
    <>
      <VisualIntro topic="progress" className="page-title compact-visual-intro">
        <span className="eyebrow">나의 연습실</span>
        <h1>내 학습 기록</h1>
        <p>제출한 코드와 검토 결과를 확인하고, 보완할 문제를 다시 풀어보세요.</p>
      </VisualIntro>
      <LearningResume key={data.scope} scope={data.scope} showEmpty />
      <Link className="history-track-link" href="/learn/ai">
        <div>
          <strong>AI 실무 학습 기록</strong>
          <p>이 브라우저에서 배운 AI 수업을 확인하고 이어서 학습하세요.</p>
        </div>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <Link className="history-track-link" href="/handoff?source=sample">
        <div>
          <strong>AI 코드 이해 훈련 기록</strong>
          <p>분석한 과제와 복습할 내용을 확인하세요.</p>
        </div>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <h2 className="history-coding-title">코딩 문제 풀이 기록</h2>
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
            북마크
          </span>
          <strong>
            {saved}
            <small>문제</small>
          </strong>
        </div>
      </div>
      <section className="training-overview" aria-label="최근 7일 훈련 현황">
        <div>
          <span className="eyebrow">최근 7일 연습 기록</span>
          <h2>
            {training.streak
              ? `${training.streak}일 연속 학습 중`
              : "오늘의 첫 학습을 시작해 보세요"}
          </h2>
          <p>
            최근 7일 중 {training.activeDays}일 학습 · 도움 없이 해결한 문제{" "}
            {training.independentSolved}개
          </p>
          {today && (
            <p className="today-summary">
              <strong>오늘의 학습</strong>{" "}
              {todayItems.length
                ? todayItems.map(([label, count, unit]) => `${label} ${count}${unit}`).join(" · ")
                : "아직 완료한 학습이 없습니다."}
            </p>
          )}
          <small>
            코딩 문제 AI 검토, 코드 이해 훈련 검토, 서비스 원리 미션 완료, AI 실무 수업 완료 중
            하나라도 있는 날을 셉니다 · 한국 시간
          </small>
        </div>
        <div className="training-week">
          {training.week.map((day) => (
            <span
              key={day.label}
              className={day.active ? "active" : ""}
              aria-label={`${day.label} ${day.active ? "학습함" : "학습 기록 없음"}`}
            >
              <Check size={16} aria-hidden="true" />
              <small>{day.label}</small>
            </span>
          ))}
        </div>
      </section>
      <section className="history-section">
        <div className="section-heading">
          <h2>
            풀이 기록 <span>{data.stats.attempts}</span>
          </h2>
          <span className="muted">최근 검토 순</span>
        </div>
        <div className="history-filters" role="group" aria-label="풀이 기록 보기">
          {(
            [
              ["all", "전체 기록"],
              ["unsolved", "아직 해결하지 못한 문제"],
            ] as const
          ).map(([value, label]) => (
            <ToggleButton
              key={value}
              className={filter === value ? "selected" : ""}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </ToggleButton>
          ))}
        </div>
        {filter === "unsolved" && (
          <p className="history-filter-note">
            문제마다 가장 최근 검토만 보여 줍니다. AI 검토 기준을 모두 충족하면 목록에서 빠집니다.
          </p>
        )}
        {history.loading && !history.attempts.length ? (
          <ScreenSkeleton variant="list" label="풀이 기록을 불러오는 중입니다." />
        ) : !history.error && filter === "unsolved" && !history.attempts.length ? (
          <div className="empty-state bordered">
            <CheckCircle2 size={36} />
            <h2>검토 후 아직 해결하지 못한 문제가 없습니다.</h2>
            <p>검토한 문제를 모두 해결했거나 아직 검토한 풀이가 없습니다.</p>
          </div>
        ) : !history.error && data.stats.attempts === 0 ? (
          <div className="empty-state bordered">
            <History size={36} />
            <h2>아직 검토한 풀이가 없습니다.</h2>
            <p>
              문제를 풀고 AI 풀이 검토를 요청하면 제출한 코드와 피드백을 여기에서 볼 수 있습니다.
            </p>
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
          <Status className="inline-error" role="alert">
            {history.error}
          </Status>
        )}
        {(history.nextCursor || history.error) && (
          <Button
            className="secondary-button"
            onClick={history.loadMore}
            disabled={history.loading}
          >
            {history.loading
              ? "불러오는 중…"
              : history.error
                ? "다시 불러오기"
                : "이전 풀이 더 보기"}
          </Button>
        )}
      </section>
    </>
  );
}
