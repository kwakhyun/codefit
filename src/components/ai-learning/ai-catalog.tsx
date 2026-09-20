"use client";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
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
import { filterAiLessons } from "@/lib/ai-learning/progress";
import { useAiLearningProgress } from "@/hooks/use-ai-learning-progress";

const icons = { workflow: Workflow, monitor: Monitor, search: Search, sparkles: Sparkles };
const paths = [
  {
    title: "처음이라면",
    description: "맥락 전달부터 도구 연결까지",
    ids: ["prompt-context", "agent-workflow", "langchain", "langgraph"],
  },
  {
    title: "내 컴퓨터에서 써보고 싶다면",
    description: "설치 준비부터 채팅 화면까지",
    ids: ["local-start", "local-connect", "local-ui"],
  },
  {
    title: "내 문서로 답하는 AI를 만든다면",
    description: "검색부터 답변 평가까지",
    ids: ["llamaindex", "vector-search", "rag-eval"],
  },
];

export function AiCatalog() {
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("all");
  const [level, setLevel] = useState("all");
  const { records, ready, storageError } = useAiLearningProgress();
  const completed = AI_LESSONS.filter((lesson) => records[lesson.id]?.completed).length;
  const resume = AI_LESSONS.filter(
    (lesson) => records[lesson.id] && !records[lesson.id]?.completed,
  ).sort((a, b) => (records[b.id]?.updatedAt || 0) - (records[a.id]?.updatedAt || 0))[0];
  const next =
    resume || AI_LESSONS.find((lesson) => !records[lesson.id]?.completed) || AI_LESSONS[0];
  const visible = filterAiLessons(query, track, level);
  const filtered = query.trim() !== "" || track !== "all" || level !== "all";
  function reset() {
    setQuery("");
    setTrack("all");
    setLevel("all");
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
          <Link className="primary-button" href={`/learn/ai/${next.id}`}>
            {completed === AI_LESSONS.length
              ? "첫 수업 복습하기"
              : resume
                ? "이어서 학습하기"
                : "첫 수업 시작하기"}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="ai-progress-summary">
          <strong>{ready ? `${completed} / ${AI_LESSONS.length}` : "기록 확인 중"}</strong>
          <span>수업 완료</span>
          <Progress aria-label="AI 수업 완료 수" value={completed} max={AI_LESSONS.length} />
          <small>
            {storageError
              ? "브라우저 저장이 차단되어 현재 탭에서만 기록됩니다."
              : "이 브라우저에 학습 위치와 완료 기록을 저장합니다. 계정이나 다른 기기와 동기화하지 않습니다."}
          </small>
        </div>
      </section>
      <section className="ai-paths" aria-label="추천 학습 순서">
        {paths.map((path) => (
          <div key={path.title}>
            <h2>{path.title}</h2>
            <p>{path.description}</p>
            <ol>
              {path.ids.map((id) => {
                const lesson = AI_LESSONS.find((item) => item.id === id)!;
                return (
                  <li key={id}>
                    <Link href={`/learn/ai/${id}`}>{lesson.title}</Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
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
              onChange={(event) => setQuery(event.target.value)}
            />
          </FieldLabel>
          <FieldLabel>
            학습 수준
            <NativeSelect value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="all">모든 수준</option>
              <option value="입문">입문 — 처음 시작해요</option>
              <option value="기초">기초 — 원리를 적용해요</option>
              <option value="응용">응용 — 운영과 개선을 배워요</option>
            </NativeSelect>
          </FieldLabel>
        </div>
        <div className="ai-category-filters" role="group" aria-label="학습 카테고리">
          <Button aria-pressed={track === "all"} onClick={() => setTrack("all")}>
            전체 <span>{AI_LESSONS.length}</span>
          </Button>
          {AI_TRACKS.map((item) => (
            <Button
              key={item.id}
              aria-pressed={track === item.id}
              onClick={() => setTrack(item.id)}
            >
              {item.title}
              <span>{AI_LESSONS.filter((lesson) => lesson.track === item.id).length}</span>
            </Button>
          ))}
        </div>
        <div className="ai-results-count">
          <p role="status" aria-live="polite">
            {visible.length}개 수업{filtered ? "을 찾았어요" : "을 자유롭게 시작할 수 있어요"}
          </p>
          {filtered && <Button onClick={reset}>검색과 필터 초기화</Button>}
        </div>
      </section>
      {visible.length === 0 && (
        <div className="ai-empty">
          <Search aria-hidden="true" />
          <h2>일치하는 수업이 없어요</h2>
          <p>도구 이름을 짧게 입력하거나 카테고리와 수준을 바꿔 보세요.</p>
          <Button onClick={reset}>전체 수업 보기</Button>
        </div>
      )}
      {AI_TRACKS.map((category) => {
        const lessons = visible.filter((lesson) => lesson.track === category.id);
        if (!lessons.length) return null;
        const Icon = icons[category.icon];
        return (
          <section
            className="ai-course-group"
            key={category.id}
            aria-labelledby={`category-${category.id}`}
          >
            <div className="ai-group-title">
              <Icon aria-hidden="true" />
              <div>
                <h2 id={`category-${category.id}`}>{category.title}</h2>
                <p>{category.description}</p>
              </div>
            </div>
            <div className="ai-lesson-grid">
              {lessons.map((lesson) => {
                const record = records[lesson.id];
                return (
                  <Link key={lesson.id} className="ai-lesson-card" href={`/learn/ai/${lesson.id}`}>
                    <div className="ai-card-meta">
                      <span>{lesson.level}</span>
                      <span>
                        <Clock3 size={14} aria-hidden="true" />
                        {lesson.minutes}분
                      </span>
                    </div>
                    <h3>{lesson.title}</h3>
                    <p>{lesson.summary}</p>
                    <div className="ai-tool-tags">
                      {lesson.tools
                        .filter(
                          (tool) =>
                            !["랭체인", "랭그래프", "라마인덱스", "허깅페이스", "올라마"].includes(
                              tool,
                            ),
                        )
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
              })}
            </div>
          </section>
        );
      })}
      <aside className="ai-catalog-note">
        <h2>설치 없이 먼저 이해하고, 필요할 때 직접 써보세요</h2>
        <p>
          모든 수업은 교육용 사례와 모의 결과로 진행합니다. 실제 모델 호출이나 도구 설치는 하지
          않습니다. 수업의 공식 문서에서 설치 방법, 지원 환경과 이용 조건을 확인할 수 있습니다.
        </p>
      </aside>
    </>
  );
}
