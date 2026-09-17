"use client";
import {
  HANDOFF_FIELDS,
  HANDOFF_MIN_LENGTH,
  readHandoffDraft,
  writeHandoffDraft,
} from "@/lib/handoff/draft";

export function HandoffFields({
  value,
  onChange,
  section,
  readOnly = false,
  prefix = "handoff",
}: {
  value: string;
  onChange?: (value: string) => void;
  section?: "before" | "after";
  readOnly?: boolean;
  prefix?: string;
}) {
  const { implementation, notes, training } = readHandoffDraft(value);
  const fields =
    section === "before"
      ? HANDOFF_FIELDS.slice(0, 2)
      : section === "after"
        ? HANDOFF_FIELDS.slice(2)
        : HANDOFF_FIELDS;
  return (
    <div className="handoff-fields">
      {fields.map((field) => (
        <label key={field.key} htmlFor={`${prefix}-${field.key}`}>
          <strong id={`${prefix}-${field.key}-label`}>{field.label}</strong>
          <span id={`${prefix}-${field.key}-help`}>{field.prompt}</span>
          <textarea
            id={`${prefix}-${field.key}`}
            aria-labelledby={`${prefix}-${field.key}-label`}
            aria-describedby={`${prefix}-${field.key}-help`}
            placeholder={field.outline}
            value={notes[field.key]}
            readOnly={readOnly}
            maxLength={field.max}
            rows={section === "after" ? 5 : 3}
            onChange={(event) =>
              onChange?.(
                writeHandoffDraft(
                  implementation,
                  { ...notes, [field.key]: event.target.value },
                  training,
                ),
              )
            }
          />
          {!readOnly && (
            <small>
              {HANDOFF_MIN_LENGTH}자 이상 · {notes[field.key].length}/{field.max}자 · 코드와 함께
              자동 저장
            </small>
          )}
        </label>
      ))}
    </div>
  );
}

export function HandoffGuide({ starterCode }: { starterCode: string }) {
  return (
    <section className="handoff-guide" aria-label="인수인계 훈련 안내">
      <span className="eyebrow">AI CODE HANDOFF</span>
      <h2>코드 분석과 인수인계 메모</h2>
      <p>
        코드의 동작과 수정 이유를 설명하고, 변경한 내용을 테스트하세요. 각 단계는 필요한 순서로
        이동할 수 있습니다.
      </p>
      <nav aria-label="인수인계 작성 단계">
        {[
          ["understanding", "1. 이해"],
          ["diagnosis", "2. 판단"],
          ["code", "3. 수정·확장"],
          ["verification", "4. 검증"],
          ["decision", "5. 인수인계"],
        ].map(([id, label]) => (
          <button
            type="button"
            className="secondary-button"
            key={id}
            onClick={() => {
              const target =
                id === "code"
                  ? document.querySelector<HTMLElement>(".monaco-editor textarea")
                  : document.getElementById(`handoff-${id}`);
              target?.focus();
              target?.scrollIntoView({
                block: "center",
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "instant"
                  : "smooth",
              });
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <details className="handoff-original">
        <summary>인수받은 원본 코드 보기</summary>
        <p>원본은 바뀌지 않습니다. 아래 편집 중인 코드와 비교하며 수정 이유를 설명하세요.</p>
        <pre>
          <code>{starterCode}</code>
        </pre>
      </details>
      <small>
        교육용 시나리오 · 참고 코드와 예제는 자동 테스트 확인 · 내 풀이와 테스트는 AI 정적 검토
      </small>
    </section>
  );
}
