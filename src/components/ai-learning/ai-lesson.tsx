"use client";
import { catalogLessonUrl } from "@/lib/ai-learning/catalog-navigation";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { AppLink as Link, Anchor, Button, Progress } from "@/components/ui/primitives";
import {
  AI_LESSONS,
  AI_TRACKS,
  AI_CONTENT_REVIEWED,
  type AiLessonId,
} from "@/lib/ai-learning/catalog";
import type { AiLessonContent } from "@/lib/ai-learning/content";
import { EMPTY_AI_PROGRESS, type AiProgress } from "@/lib/ai-learning/progress";
import { useAiLearningProgress } from "@/hooks/use-ai-learning-progress";

const stages = ["개념 이해", "선택하며 실습", "확인 문제"];
export function AiLesson({
  id,
  content,
  returnTo = "/learn/ai",
}: {
  id: AiLessonId;
  content: AiLessonContent;
  returnTo?: string;
}) {
  const lesson = AI_LESSONS.find((item) => item.id === id)!;
  const category = AI_TRACKS.find((item) => item.id === lesson.track)!;
  const { records, save, ready, storageError } = useAiLearningProgress();
  const progress = records[id] || EMPTY_AI_PROGRESS;
  const { step, experiment, completed } = progress;
  const answer = progress.answer ?? null;
  const checked = progress.checked ?? false;
  const [retry, setRetry] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const next = AI_LESSONS[AI_LESSONS.findIndex((item) => item.id === id) + 1];
  function update(patch: Partial<AiProgress>) {
    save(id, { ...progress, ...patch });
  }
  function move(to: 0 | 1 | 2) {
    update({ step: to });
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(content.example.code);
      setCopyStatus("예시를 복사했어요.");
    } catch {
      setCopyStatus("복사하지 못했어요. 예시의 텍스트를 선택해서 복사해 주세요.");
    }
  }
  return (
    <>
      <nav className="ai-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <Link href={returnTo}>
          {returnTo.includes("?") ? "검색 결과로 돌아가기" : "AI 실무 배우기"}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{category.title}</span>
      </nav>
      <header className="ai-lesson-header">
        <span className="eyebrow">
          {lesson.level} / 약 {lesson.minutes}분
        </span>
        <h1>{lesson.title}</h1>
        <p>{content.goal}</p>
        <div className="ai-tool-tags">
          {lesson.tools.map((tool) => (
            <span key={tool}>{tool}</span>
          ))}
        </div>
      </header>
      <div className="ai-lesson-layout">
        <aside className="ai-lesson-sidebar">
          <nav aria-label="수업 단계">
            <ol>
              {stages.map((label, index) => (
                <li key={label}>
                  <Button
                    aria-current={step === index ? "step" : undefined}
                    disabled={!ready || (index === 2 && experiment === null)}
                    onClick={() => move(index as 0 | 1 | 2)}
                  >
                    <span>{index + 1}</span>
                    {label}
                    {completed && index === 2 && <CheckCircle2 size={16} aria-label="완료" />}
                  </Button>
                </li>
              ))}
            </ol>
          </nav>
          <Progress aria-label="현재 수업 진행 단계" value={completed ? 3 : step} max={3} />
          <p>
            {storageError
              ? "저장할 수 없어 현재 탭에서만 기록됩니다. 새로고침하면 기록이 사라질 수 있어요."
              : "이 브라우저에 학습 위치와 완료 기록이 저장됩니다."}
          </p>
          <Link href={returnTo}>
            {returnTo.includes("?") ? "검색 결과로 돌아가기" : "전체 수업으로 돌아가기"}
          </Link>
        </aside>
        <article className="ai-lesson-body">
          <span className="eyebrow">{step + 1} / 3단계</span>
          <h2 ref={heading} tabIndex={-1}>
            {step === 2 && completed && !retry ? "수업 완료" : stages[step]}
          </h2>
          {!ready ? (
            <ScreenSkeleton variant="lesson" label="학습 기록을 불러오는 중…" />
          ) : (
            <>
              {step === 0 && (
                <>
                  <dl className="ai-terms">
                    {content.terms.map((term) => (
                      <div key={term.word}>
                        <dt>{term.word}</dt>
                        <dd>{term.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                  <ol className="ai-flow" aria-label="작업 흐름">
                    {content.flow.map((item, index) => (
                      <li key={item}>
                        <span>{index + 1}</span>
                        {item}
                      </li>
                    ))}
                  </ol>
                  <div className="ai-guide">
                    {content.guide.map((item, index) => (
                      <section key={item.title}>
                        <h3>
                          {index + 1}. {item.title}
                        </h3>
                        <p>{item.body}</p>
                      </section>
                    ))}
                  </div>
                  <section className="ai-code-example" aria-label="따라 살펴볼 예시">
                    <div>
                      <h3>{content.example.title}</h3>
                      <Button onClick={copy}>
                        <Copy size={15} aria-hidden="true" />
                        예시 복사
                      </Button>
                    </div>
                    <span>{content.example.language}</span>
                    <pre tabIndex={0}>
                      <code>{content.example.code}</code>
                    </pre>
                    <p>{content.example.note}</p>
                    <p role="status">{copyStatus}</p>
                  </section>
                  <div className="ai-step-actions">
                    <Button className="primary-button" onClick={() => move(1)}>
                      선택하며 실습하기 <ArrowRight size={17} aria-hidden="true" />
                    </Button>
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <p className="ai-simulation-note">
                    방법을 하나 고르면 결과와 이유가 나타나요. 다른 방법도 눌러 비교해 보세요. 실제
                    도구를 실행하지 않는 모의 실습입니다.
                  </p>
                  <div className="ai-situation">
                    <span>이런 상황이라면</span>
                    <p>{content.exercise.situation}</p>
                  </div>
                  <fieldset className="ai-choices">
                    <legend>{content.exercise.question}</legend>
                    {content.exercise.choices.map((choice, index) => (
                      <label key={choice.label} data-selected={experiment === index}>
                        <input
                          type="radio"
                          name="experiment"
                          checked={experiment === index}
                          onChange={() => update({ experiment: index })}
                        />
                        <span>{choice.label}</span>
                      </label>
                    ))}
                  </fieldset>
                  <div aria-live="polite" aria-atomic="true">
                    {experiment !== null && (
                      <section className="ai-feedback">
                        <span className="eyebrow">선택한 방식의 결과</span>
                        <h3>{content.exercise.choices[experiment].result}</h3>
                        <p>{content.exercise.choices[experiment].explanation}</p>
                        <small>다른 선택지도 눌러 결과를 비교해 보세요.</small>
                      </section>
                    )}
                  </div>
                  <div className="ai-step-actions">
                    <Button onClick={() => move(0)}>개념 다시 보기</Button>
                    <Button
                      className="primary-button"
                      disabled={experiment === null}
                      onClick={() => move(2)}
                    >
                      확인 문제 풀기 <ArrowRight size={17} aria-hidden="true" />
                    </Button>
                  </div>
                  {experiment === null && (
                    <p className="ai-help">
                      선택지를 하나 눌러 결과를 확인하면 다음 단계로 갈 수 있어요.
                    </p>
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  {(!completed || retry) && (
                    <>
                      <p>새로운 상황에도 배운 원리를 적용해 보세요. 틀려도 다시 풀 수 있습니다.</p>
                      <fieldset className="ai-choices">
                        <legend>{content.quiz.question}</legend>
                        {content.quiz.choices.map((choice, index) => (
                          <label key={choice} data-selected={answer === index}>
                            <input
                              type="radio"
                              name="quiz"
                              checked={answer === index}
                              onChange={() => {
                                update({ answer: index, checked: false });
                              }}
                            />
                            <span>{choice}</span>
                          </label>
                        ))}
                      </fieldset>
                      <Button
                        className="primary-button"
                        disabled={answer === null}
                        onClick={() => {
                          const correct = answer === content.quiz.answer && experiment !== null;
                          update({ checked: true, ...(correct ? { completed: true } : {}) });
                          if (correct) {
                            setRetry(false);
                            requestAnimationFrame(() => heading.current?.focus());
                          }
                        }}
                      >
                        답 확인하기
                      </Button>
                      <div aria-live="polite" aria-atomic="true">
                        {checked && (
                          <section
                            className={`ai-feedback ${answer === content.quiz.answer ? "is-correct" : ""}`}
                          >
                            <h3>
                              {answer === content.quiz.answer
                                ? "맞았어요. 이 수업을 마쳤습니다!"
                                : "다시 생각해 볼까요?"}
                            </h3>
                            <p>{content.quiz.explanation}</p>
                            {answer !== content.quiz.answer && (
                              <p>설명을 참고해 다른 답을 골라 보세요.</p>
                            )}
                          </section>
                        )}
                      </div>
                    </>
                  )}
                  {completed && !retry && (
                    <section className="ai-completion">
                      <p className="ai-complete-label">
                        {next
                          ? "확인 문제까지 마쳤어요. 다음 수업으로 이어가세요."
                          : "확인 문제까지 마쳤어요. 배운 내용을 내 프로젝트에 적용해 보세요."}
                      </p>
                      <CheckCircle2 size={28} aria-hidden="true" />
                      <h3>기억할 한 가지</h3>
                      <p>{content.takeaway}</p>
                      <details className="ai-review">
                        <summary>내 선택과 해설 다시 보기</summary>
                        {experiment !== null && (
                          <p>
                            <strong>실습에서 고른 방법</strong>
                            <br />
                            {content.exercise.choices[experiment].label}
                            <br />
                            {content.exercise.choices[experiment].explanation}
                          </p>
                        )}
                        <p>
                          <strong>확인 문제의 답</strong>
                          <br />
                          {content.quiz.choices[content.quiz.answer]}
                        </p>
                        <p>{content.quiz.explanation}</p>
                      </details>
                      <div className="ai-step-actions">
                        {next ? (
                          <Link
                            className="primary-button"
                            href={catalogLessonUrl(next.id, returnTo)}
                          >
                            다음 수업: {next.title} <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        ) : (
                          <Link className="primary-button" href={returnTo}>
                            학습 현황 보기
                          </Link>
                        )}
                        <Link href={returnTo}>
                          {returnTo.includes("?") ? "검색 결과로 돌아가기" : "다른 수업 고르기"}
                        </Link>
                        <Button
                          onClick={() => {
                            setRetry(true);
                            update({ answer: null, checked: false });
                            requestAnimationFrame(() => heading.current?.focus());
                          }}
                        >
                          확인 문제 다시 풀기
                        </Button>
                      </div>
                    </section>
                  )}
                  <div className="ai-step-actions">
                    <Button onClick={() => move(1)}>실습 다시 살펴보기</Button>
                  </div>
                </>
              )}
            </>
          )}
          <details className="ai-sources">
            <summary>공식 문서로 더 알아보기</summary>
            <p>
              자료 확인: <time dateTime={AI_CONTENT_REVIEWED}>{AI_CONTENT_REVIEWED}</time>. 도구의
              기능과 설치 방법은 바뀔 수 있습니다.
            </p>
            <ul>
              {content.sources.map((source) => (
                <li key={source.url}>
                  <Anchor href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                    <ExternalLink size={13} aria-hidden="true" />
                    <span className="sr-only"> (새 탭)</span>
                  </Anchor>
                </li>
              ))}
            </ul>
          </details>
        </article>
      </div>
    </>
  );
}
