"use client";
import { ToggleButton } from "@/components/ui/primitives";
import { useState } from "react";
import { FileText, LockKeyhole, UserRound } from "lucide-react";
/** An explanatory state preview, never a request to a real service. */
export function AccessPreview() {
  const [owner, setOwner] = useState(true);
  return (
    <div className="access-preview" aria-label="접근 권한 설명용 예시">
      <div className="access-preview-title">
        <LockKeyhole size={18} />
        <strong>같은 메모, 다른 사용자</strong>
        <small>설명용 예시</small>
      </div>
      <div className="result-filter" role="group" aria-label="예시 요청자">
        <ToggleButton type="button" aria-pressed={owner} onClick={() => setOwner(true)}>
          <UserRound size={16} /> 지민 (소유자)
        </ToggleButton>
        <ToggleButton type="button" aria-pressed={!owner} onClick={() => setOwner(false)}>
          <UserRound size={16} /> 민수 (다른 사용자)
        </ToggleButton>
      </div>
      <div
        className={`access-preview-result ${owner ? "is-owner" : "is-blocked"}`}
        aria-live="polite"
      >
        {owner ? <FileText size={28} /> : <LockKeyhole size={28} />}
        <div>
          <strong>
            {owner ? "지민의 메모를 보여줘야 합니다" : "메모 내용을 보내지 않아야 합니다"}
          </strong>
          <p>
            {owner
              ? "서버가 요청자와 메모 소유자가 같다는 것을 확인한 경우입니다."
              : "로그인했어도 메모 주인이 다르면 서버에서 접근을 거절해야 합니다."}
          </p>
        </div>
      </div>
      <p className="learn-fineprint">
        기대 동작을 비교하는 그림입니다. 실제 서버 요청이나 AI 평가를 실행하지 않습니다.
      </p>
    </div>
  );
}
