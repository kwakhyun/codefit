"use client";
import { useProjectReview } from "@/hooks/use-project-review";
import type { ProjectClassDetail } from "@/lib/project-check/project-class";
import { Button, Card, FieldLabel, Textarea } from "@/components/ui/primitives";
import { PracticeSources } from "@/components/project-practice/practice-sources";
export function ProjectReview({ detail, scope }: { detail: ProjectClassDetail; scope: string }) {
  const items = [
    ...detail.check.analysis.questions.map((q, i) => ({
      title: q.question,
      prompt: "내 말로 다시 설명해 보세요.",
      evidence: [q.evidence],
      answer:
        detail.check.review?.answers[i] ||
        "아직 저장한 답변이 없습니다. 프로젝트 점검에서 첫 답변을 남겨 보세요.",
      choices: undefined as string[] | undefined,
      correct: undefined as number | undefined,
    })),
    ...(["code", "service"] as const).flatMap((mode) =>
      (detail.practice?.exercises[mode] ?? []).map((t) => ({
        title: t.title,
        prompt: `${t.situation}\n${t.assumptions}\n${t.question}`,
        evidence: t.evidence,
        answer: t.explanation,
        choices: t.choices,
        correct: t.answer,
      })),
    ),
    ...(detail.workshop?.plan.topics ?? []).map((t) => ({
      title: t.title,
      prompt: t.question,
      evidence: t.evidence,
      answer: t.feedback,
      choices: t.choices,
      correct: t.answer,
    })),
  ];
  // Content keys keep drafts attached to their question when new courses are added.
  const keys = items.map((item) => JSON.stringify([item.title, item.prompt, item.choices]));
  const { saved, update, reset, failed } = useProjectReview(scope, detail.check.id);
  const index = Math.max(0, keys.indexOf(saved.active));
  const item = items[index];
  const key = keys[index];
  const draft = saved.entries[key];
  const note = draft?.note ?? "";
  const choice =
    draft?.choice !== undefined &&
    draft.choice !== null &&
    item?.choices &&
    draft.choice < item.choices.length
      ? draft.choice
      : null;
  const revealed = !!draft?.revealed && (!item?.choices || choice !== null);
  if (!item) return null;
  function move(next: number) {
    update(keys[next]);
  }
  return (
    <Card className="class-review">
      <div className="class-section-heading">
        <div>
          <span className="eyebrow">기존 답변과 진도를 바꾸지 않는 복습</span>
          <h2>기억나는 만큼 다시 풀어보세요</h2>
        </div>
        <span>
          {index + 1} / {items.length}
        </span>
      </div>
      <p className="muted" role="status">
        {failed
          ? "브라우저에 복습을 저장하지 못했습니다. 이 화면을 벗어나면 메모가 사라질 수 있어요."
          : "복습 위치와 메모는 이 브라우저에 저장됩니다. 다른 기기에는 동기화되지 않아요."}
      </p>
      <h3>{item.title}</h3>
      <p className="class-multiline">{item.prompt}</p>
      {detail.check.page.repository && (
        <PracticeSources
          repository={detail.check.page.repository}
          evidence={item.evidence}
          expanded={false}
        />
      )}
      {item.choices ? (
        <fieldset className="class-options">
          <legend>예상하는 결과</legend>
          {item.choices.map((text, i) => (
            <label key={i}>
              <input
                type="radio"
                name="review-choice"
                checked={choice === i}
                onChange={() => update(key, { choice: i })}
                disabled={revealed}
              />
              {text}
            </label>
          ))}
        </fieldset>
      ) : (
        <>
          <FieldLabel htmlFor="class-review-note">지금 떠오르는 설명</FieldLabel>
          <Textarea
            id="class-review-note"
            value={note}
            onChange={(e) => update(key, { note: e.target.value })}
            maxLength={2000}
            placeholder="기억나는 내용을 적어 보세요."
          />
        </>
      )}
      {!revealed ? (
        <Button
          className="primary-button"
          disabled={!!item.choices && choice === null}
          onClick={() => update(key, { revealed: true })}
        >
          {item.choices ? "정답과 해설 확인" : "이전 답변과 비교"}
        </Button>
      ) : (
        <div className="class-review-answer" role="status">
          {item.choices && (
            <strong>
              {choice === item.correct ? "잘 기억하고 있어요." : "이 조건을 다시 살펴보세요."} 정답:{" "}
              {item.choices[item.correct!]}
            </strong>
          )}
          <p>{item.answer}</p>
        </div>
      )}
      <div className="class-actions">
        <Button disabled={!index} onClick={() => move(index - 1)}>
          이전
        </Button>
        {index < items.length - 1 ? (
          <Button disabled={!revealed} onClick={() => move(index + 1)}>
            다음 복습
          </Button>
        ) : (
          <Button disabled={!revealed} onClick={() => reset(keys[0])}>
            복습 기록을 비우고 다시 시작
          </Button>
        )}
      </div>
    </Card>
  );
}
