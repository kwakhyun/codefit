"use client";
import type { DraftStatus } from "@/lib/drafts/draft-controller";

export function DraftConflict({
  status,
  localSaved,
  code,
  onChange,
  onResolve,
}: {
  status: DraftStatus;
  localSaved: boolean;
  code: string;
  onChange: (code: string) => void;
  onResolve: () => Promise<boolean>;
}) {
  if (status.kind !== "conflict" && status.kind !== "resolving") return null;
  return (
    <section className="draft-conflict" aria-label="코드 저장 충돌">
      <p role="alert">
        <strong>다른 곳에서 저장한 코드가 있습니다.</strong>{" "}
        {localSaved
          ? "내 초안은 그대로 보관 중입니다."
          : "현재 화면에 초안이 남아 있습니다. 브라우저 보관에 실패했으니 창을 닫기 전에 복사해 주세요."}{" "}
        비교하며 수정한 뒤 다시 저장해 주세요.
      </p>
      <details>
        <summary>내 초안과 서버 저장본 비교</summary>
        <div className="draft-comparison">
          <label>
            내 초안 · 계속 편집 가능
            <textarea
              aria-label="비교 화면의 내 초안"
              value={code}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
            />
          </label>
          <label>
            서버 저장본 · 리비전 {status.server.codeRevision}
            <textarea
              aria-label="서버 저장본"
              readOnly
              value={status.server.code ?? ""}
              spellCheck={false}
            />
          </label>
        </div>
        <p>
          서버본에서 필요한 부분을 복사해 내 초안에 합칠 수 있습니다. 아래 편집기에도 바로
          반영됩니다.
        </p>
      </details>
      <button
        className="secondary-button"
        disabled={status.kind === "resolving"}
        onClick={async (e) => {
          const trigger = e.currentTarget;
          const saved = await onResolve();
          if (
            saved &&
            (document.activeElement === trigger || document.activeElement === document.body)
          )
            document.querySelector<HTMLTextAreaElement>(".monaco-editor textarea")?.focus();
        }}
      >
        {status.kind === "resolving" ? "서버 버전 확인하며 저장 중" : "비교한 버전에 내 초안 저장"}
      </button>
      <small>그사이 서버 코드가 바뀌면 다시 비교를 안내합니다.</small>
    </section>
  );
}
