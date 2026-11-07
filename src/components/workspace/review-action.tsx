"use client";
import { GuestLogin } from "@/components/account/guest-login";
import { Button } from "@/components/ui/primitives";
import { allowanceWindow, guestAllowance, memberAllowance } from "@/lib/ai-access";
import { reviewResetLabel } from "@/lib/review-quota";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";

/** The review request with its remaining allowance. At zero the button is disabled and the
 * time the allowance frees up again is shown (24 hours from first use, not "today"). */
export function ReviewAction({
  busy,
  disabled,
  aiReady,
  remaining,
  resetsAt,
  member,
  loginReturnTo,
  alternative,
  onReview,
}: {
  busy: boolean;
  disabled: boolean;
  aiReady: boolean;
  remaining: number | null;
  resetsAt: string | null;
  member: boolean;
  loginReturnTo: string;
  /** What still works without a review, e.g. "예시 테스트". */
  alternative: string;
  onReview: () => void;
}) {
  const exhausted = aiReady && remaining === 0 && !busy;
  const reset = reviewResetLabel(resetsAt);
  return (
    <>
      <div className="review-action">
        <span>
          <kbd>⌘ / Ctrl</kbd> + <kbd>Enter</kbd>
          <small>
            AI가 요구사항을 검토합니다.
            {aiReady &&
              remaining !== null &&
              !exhausted &&
              ` · ${allowanceWindow("review")} 기준 ${remaining}회 남음`}
          </small>
        </span>
        <Button
          className="primary-button"
          onClick={onReview}
          disabled={disabled || exhausted}
          aria-describedby={exhausted ? "review-quota-note" : undefined}
        >
          {busy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
          {busy ? "풀이 검토 중" : "AI 풀이 검토"}
          {!busy && <ArrowRight size={16} />}
        </Button>
      </div>
      {exhausted && (
        <div className="review-quota" id="review-quota-note">
          <p>
            <strong>
              {member
                ? `${allowanceWindow("review")} 기준 AI 검토 ${memberAllowance("review")}회를 모두 사용했습니다.`
                : `로그인 없이 쓸 수 있는 ${allowanceWindow("review")} 기준 AI 검토 ${guestAllowance("review")}회를 모두 사용했습니다.`}
            </strong>{" "}
            {reset
              ? `${reset} 이후 다시 검토할 수 있어요.`
              : `첫 검토부터 ${allowanceWindow("review")}이 지나면 다시 검토할 수 있어요.`}
          </p>
          <p>
            코드 작성과 저장, {alternative} 기능은 계속 이용할 수 있습니다. 검토 횟수는 AI 코드 이해
            훈련과 함께 씁니다.
          </p>
          {!member && (
            <GuestLogin
              compact
              returnTo={loginReturnTo}
              label={`로그인하면 ${allowanceWindow("review")} 기준 ${memberAllowance("review")}회 검토할 수 있어요`}
            />
          )}
        </div>
      )}
    </>
  );
}
