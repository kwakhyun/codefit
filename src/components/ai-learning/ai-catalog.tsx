"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  catalogFilters,
  catalogUrl,
  catalogLessonUrl,
  catalogScrollKey,
} from "@/lib/ai-learning/catalog-navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Search,
  Workflow,
  Monitor,
  Sparkles,
} from "lucide-react";
import {
  AppLink as Link,
  Button,
  FieldLabel,
  Input,
  NativeSelect,
  Progress,
} from "@/components/ui/primitives";
import { AI_LESSONS, AI_TRACKS, AI_CONTENT_REVIEWED } from "@/lib/ai-learning/catalog";
import { aiProgressNote, filterAiLessons, lessonsToReview } from "@/lib/ai-learning/progress";
import { AI_PATHS, type LessonContext } from "@/lib/ai-learning/lesson-paths";
import { useAiLearningProgress } from "@/hooks/use-ai-learning-progress";

const icons = { workflow: Workflow, monitor: Monitor, search: Search, sparkles: Sparkles };
const hiddenAliases = ["랭체인", "랭그래프", "라마인덱스", "허깅페이스", "올라마"];
type Lesson = (typeof AI_LESSONS)[number];

export function AiCatalog() {
  const params = useSearchParams();
  const filters = catalogFilters(params);
  const { query, track, level } = filters;
  const returnTo = catalogUrl(filters);
  function change(patch: Partial<typeof filters>) {
    window.history.replaceState(null, "", catalogUrl({ ...filters, ...patch }));
  }
  function rememberPosition() {
    try {
      sessionStorage.setItem(catalogScrollKey(returnTo), String(window.scrollY));
    } catch {
      /* Navigation remains available without storage. */
    }
  }
  const status = useAiLearningProgress();
  const { records, ready } = status;
  useEffect(() => {
    if (!ready) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        try {
          const saved = sessionStorage.getItem(catalogScrollKey(returnTo));
          const y = Number(saved);
          if (saved !== null && Number.isFinite(y) && y >= 0) {
            window.scrollTo({ top: y, behavior: "instant" });
            sessionStorage.removeItem(catalogScrollKey(returnTo));
          }
        } catch {
          /* Browser history still restores scroll when storage is unavailable. */
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, returnTo]);
  const completed = AI_LESSONS.filter((lesson) => records[lesson.id]?.completed).length;
  const resume = AI_LESSONS.filter(
    (lesson) => records[lesson.id] && !records[lesson.id]?.completed,
  ).sort((a, b) => (records[b.id]?.updatedAt || 0) - (records[a.id]?.updatedAt || 0))[0];
  // Without a lesson in progress, recommend the first path before the rest of the catalog.
  const pathNext = AI_PATHS[0].ids.find((id) => !records[id]?.completed);
  const next =
    resume ||
    AI_LESSONS.find((lesson) => lesson.id === pathNext) ||
    AI_LESSONS.find((lesson) => !records[lesson.id]?.completed) ||
    AI_LESSONS[0];
  const nextContext: LessonContext =
    !resume && next.id === pathNext ? { path: AI_PATHS[0].id } : {};
  const review = lessonsToReview(records);
  // Search and level filters show flat results; otherwise tracks open one at a time.
  const searching = query.trim() !== "" || level !== "all";
  const visible = filterAiLessons(query, "all", level);
  const announced = useSettledValue(searching ? `${visible.length}개 수업을 찾았어요.` : "", 600);
  function reset() {
    change({ query: "", track: "all", level: "all" });
  }
  function lessonCard(lesson: Lesson, showTrack = false) {
    const record = records[lesson.id];
    return (
      <Link
        key={lesson.id}
        className="ai-lesson-card"
        href={catalogLessonUrl(lesson.id, returnTo)}
        onNavigate={rememberPosition}
      >
        <div className="ai-card-meta">
          <span>
            {showTrack && `${AI_TRACKS.find((item) => item.id === lesson.track)!.title} · `}
            {lesson.level}
          </span>
          <span>
            <Clock3 size={14} aria-hidden="true" />
            {lesson.minutes}분
          </span>
        </div>
        <h3>{lesson.title}</h3>
        <p>{lesson.summary}</p>
        <div className="ai-tool-tags">
          {lesson.tools
            .filter((tool) => !hiddenAliases.includes(tool))
            .map((tool) => (
              <span key={tool}>{tool}</span>
            ))}
        </div>
        <strong>
          {record?.completed ? (
            <>
              <CheckCircle2 size={16} aria-hidden="true" />
              완료 · 복습하기
            </>
          ) : record ? (
            "이어서 학습하기"
          ) : (
            "수업 시작하기"
          )}
          <ArrowRight size={16} aria-hidden="true" />
        </strong>
      </Link>
    );
  }
  return (
    <>
      <section className="ai-resume" aria-label="AI 학습 현황">
        <div>
          <span className="eyebrow">
            {completed === AI_LESSONS.length
              ? "모든 수업을 마쳤어요"
              : resume
                ? "이어서 배워보세요"
                : "한 수업부터 가볍게"}
          </span>
          <h2>{next.title}</h2>
          <p>
            {resume
              ? "학습하던 단계부터 이어갈 수 있습니다."
              : `약 ${next.minutes}분이면 개념과 적용 방법을 함께 살펴볼 수 있어요.`}
          </p>
          <Link
            className="primary-button"
            href={catalogLessonUrl(next.id, returnTo, nextContext)}
            onNavigate={rememberPosition}
          >
            {completed === AI_LESSONS.length
              ? "첫 수업 복습하기"
              : resume
                ? "이어서 학습하기"
                : completed
                  ? "다음 수업 시작하기"
                  : "첫 수업 시작하기"}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="ai-progress-summary">
          <strong>{ready ? `${completed} / ${AI_LESSONS.length}` : "기록 확인 중"}</strong>
          <span>수업 완료</span>
          <Progress aria-label="AI 수업 완료 수" value={completed} max={AI_LESSONS.length} />
          <small>{aiProgressNote(status)}</small>
        </div>
      </section>
      {review.length > 0 && (
        <section className="ai-review-list" aria-labelledby="ai-review-title">
          <h2 id="ai-review-title">다시 볼 수업</h2>
          <p>확인 문제를 처음에 틀린 수업이에요. 해설을 다시 읽고 확인 문제를 풀어 보세요.</p>
          <ul>
            {review.map((lesson) => (
              <li key={lesson.id}>
                <Link href={catalogLessonUrl(lesson.id, returnTo)} onNavigate={rememberPosition}>
                  {lesson.title}
                </Link>
                <span>{records[lesson.id]?.completed ? "완료" : "푸는 중"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="ai-paths" aria-label="추천 학습 순서">
        {AI_PATHS.map((path) => {
          const done = path.ids.filter((id) => records[id]?.completed).length;
          return (
            <div key={path.id}>
              <h2>{path.title}</h2>
              <p>
                {path.description}
                <span className="ai-path-count">
                  {" "}
                  · {done}/{path.ids.length} 완료
                </span>
              </p>
              <ol>
                {path.ids.map((id) => {
                  const lesson = AI_LESSONS.find((item) => item.id === id)!;
                  const finished = records[id]?.completed;
                  return (
                    <li key={id} data-completed={finished || undefined}>
                      {finished && (
                        <CheckCircle2 size={15} className="ai-path-check" aria-hidden="true" />
                      )}
                      <Link
                        href={catalogLessonUrl(id, returnTo, { path: path.id })}
                        onNavigate={rememberPosition}
                      >
                        {lesson.title}
                        {finished && <span className="sr-only"> (완료)</span>}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </section>
      <section id="ai-catalog" className="ai-catalog-controls" aria-labelledby="ai-catalog-title">
        <div className="ai-section-heading">
          <div>
            <span className="eyebrow">목적에 맞게 골라 배우기</span>
            <h2 id="ai-catalog-title">AI 기술과 도구 둘러보기</h2>
          </div>
          <span>
            공식 자료 확인 <time dateTime={AI_CONTENT_REVIEWED}>{AI_CONTENT_REVIEWED}</time>
          </span>
        </div>
        <div className="ai-filter-row">
          <FieldLabel>
            기술이나 도구 검색
            <Input
              type="search"
              placeholder="예: 랭체인, RAG, Ollama, 음성"
              value={query}
              onChange={(event) => change({ query: event.target.value })}
            />
          </FieldLabel>
          <FieldLabel>
            학습 수준
            <NativeSelect value={level} onChange={(event) => change({ level: event.target.value })}>
              <option value="all">모든 수준</option>
              <option value="입문">입문 — 처음 시작해요</option>
              <option value="기초">기초 — 원리를 적용해요</option>
              <option value="응용">응용 — 운영과 개선을 배워요</option>
            </NativeSelect>
          </FieldLabel>
        </div>
        <div className="ai-results-count">
          <p>
            {searching
              ? `${visible.length}개 수업을 찾았어요`
              : `${AI_TRACKS.length}개 분야, ${AI_LESSONS.length}개 수업 · 분야를 눌러 수업을 펼쳐 보세요`}
          </p>
          <span className="sr-only" role="status">
            {announced}
          </span>
          {searching && <Button onClick={reset}>검색과 필터 초기화</Button>}
        </div>
      </section>
      {searching && visible.length === 0 && (
        <div className="ai-empty">
          <Search aria-hidden="true" />
          <h2>일치하는 수업이 없어요</h2>
          <p>도구 이름을 짧게 입력하거나 학습 수준을 바꿔 보세요.</p>
          <Button onClick={reset}>전체 수업 보기</Button>
        </div>
      )}
      {searching ? (
        visible.length > 0 && (
          <section className="ai-search-results" aria-label="검색 결과">
            <div className="ai-lesson-grid">
              {visible.map((lesson) => lessonCard(lesson, true))}
            </div>
          </section>
        )
      ) : (
        <section className="ai-track-overview" aria-label="분야별 수업">
          {AI_TRACKS.map((category) => {
            const lessons = AI_LESSONS.filter((lesson) => lesson.track === category.id);
            const done = lessons.filter((lesson) => records[lesson.id]?.completed).length;
            const open = track === category.id;
            const Icon = icons[category.icon];
            return (
              <div className="ai-track" data-open={open} key={category.id}>
                <h3 id={`category-${category.id}`}>
                  <Button
                    className="ai-track-toggle"
                    aria-expanded={open}
                    aria-controls={`track-${category.id}`}
                    onClick={(event) => {
                      const button = event.currentTarget;
                      change({ track: open ? "all" : category.id });
                      requestAnimationFrame(() => button.scrollIntoView({ block: "nearest" }));
                    }}
                  >
                    <Icon aria-hidden="true" />
                    <span className="ai-track-copy">
                      <span className="ai-track-title">{category.title}</span>
                      <span className="ai-track-description">{category.description}</span>
                    </span>
                    <span className="ai-track-count">
                      {lessons.length}개 수업
                      {done > 0 && (
                        <>
                          {" "}
                          · <CheckCircle2 size={14} aria-hidden="true" /> {done}개 완료
                        </>
                      )}
                    </span>
                    <ChevronDown className="ai-track-chevron" size={18} aria-hidden="true" />
                  </Button>
                </h3>
                {open && (
                  <div id={`track-${category.id}`} className="ai-lesson-grid">
                    {lessons.map((lesson) => lessonCard(lesson))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
      <aside className="ai-catalog-note">
        <h2>설치 없이 먼저 이해하고, 필요할 때 직접 써보세요</h2>
        <p>
          기본 {AI_LESSONS.length}개 수업은 교육용 사례와 모의 결과로 진행합니다. 수업 안에서 모델
          호출이나 도구 설치는 하지 않습니다. 수업의 공식 문서에서 설치 방법, 지원 환경과 이용
          조건을 확인할 수 있습니다.
        </p>
      </aside>
    </>
  );
}

/** Announce a value only after it stops changing, e.g. a result count while typing. */
function useSettledValue(value: string, delay: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
