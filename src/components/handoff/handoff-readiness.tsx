"use client";
import { HANDOFF_FIELDS, missingHandoffFields, readHandoffDraft } from "@/lib/handoff/draft";

export function focusHandoffField(key: string) {
  const target = document.getElementById(`handoff-${key}`);
  target?.focus();
  target?.scrollIntoView({ block: "center", behavior: "auto" });
}
export function HandoffReadiness({ value }: { value: string }) {
  const { notes } = readHandoffDraft(value);
  const missing = missingHandoffFields(notes);
  return (
    <div className="handoff-readiness" aria-label="인수인계 작성 상태">
      <strong>
        메모 작성 {HANDOFF_FIELDS.length - missing.length}/{HANDOFF_FIELDS.length}
      </strong>
      <p>
        {missing.length
          ? "아래 항목을 작성한 뒤 검토할 수 있습니다. 항목을 누르면 입력 위치로 이동합니다."
          : "모든 항목을 작성했습니다. AI 풀이 검토를 요청하면 코드와 메모를 함께 검토합니다."}
      </p>
      {missing.map((f) => (
        <button key={f.key} className="text-button" onClick={() => focusHandoffField(f.key)}>
          {f.label} 작성하기 →
        </button>
      ))}
    </div>
  );
}
