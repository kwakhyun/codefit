"use client";
import { readHandoffDraft, writeHandoffDraft } from "@/lib/handoff/draft";
import type { ConfirmationAction } from "@/components/workspace/types";
import type { Dispatch, SetStateAction } from "react";

import { Modal } from "@/components/ui/modal";
import type { Attempt, PublicProblem } from "@/lib/problem";
interface WorkspaceConfirmationProps {
  confirm: ConfirmationAction;
  setConfirm: Dispatch<SetStateAction<ConfirmationAction>>;
  reveal: (kind: "hint" | "solution") => Promise<void>;
  selectedAttempt: Attempt | null;
  replaceCode: (value: string, message: string) => void;
  problem: PublicProblem;
  code: string;
}
export function WorkspaceConfirmation({
  confirm,
  setConfirm,
  reveal,
  selectedAttempt,
  replaceCode,
  problem,
  code,
}: WorkspaceConfirmationProps) {
  return (
    <Modal
      open={confirm !== null}
      onClose={() => setConfirm(null)}
      title={
        confirm === "solution"
          ? "VIEW SOLUTION"
          : confirm === "restore"
            ? "RESTORE SUBMISSION"
            : "RESET CODE"
      }
      className="confirm-modal"
    >
      <div className="confirm-content">
        <h2>
          {confirm === "solution"
            ? "참고 정답을 열까요?"
            : confirm === "restore"
              ? "이 제출본으로 이어 풀까요?"
              : "시작 코드로 돌아갈까요?"}
        </h2>
        <p>
          {confirm === "solution"
            ? "작성한 코드는 유지됩니다. 정답을 본 이력이 풀이 기록에 남습니다."
            : confirm === "restore"
              ? "선택한 제출본을 편집기로 불러옵니다. 변경 전 코드는 안내의 변경 취소 버튼으로 되돌릴 수 있습니다."
              : "현재 코드를 시작 코드로 바꿉니다. 변경 취소로 되돌릴 수 있으며, 이전 제출 기록은 유지됩니다."}
        </p>
        {problem.handoff && (
          <p>
            {confirm === "restore"
              ? "인수인계 메모도 선택한 제출본으로 복원되며, 변경 취소로 함께 되돌릴 수 있습니다."
              : confirm === "reset"
                ? "작성한 인수인계 메모는 유지됩니다."
                : "작성한 인수인계 메모도 유지됩니다."}
          </p>
        )}
        <div className="modal-buttons">
          <button className="secondary-button" onClick={() => setConfirm(null)}>
            계속 풀기
          </button>
          <button
            className="primary-button"
            onClick={() => {
              if (confirm === "solution") void reveal("solution");
              else if (confirm === "restore" && selectedAttempt)
                replaceCode(
                  selectedAttempt.code,
                  "선택한 제출본을 불러왔습니다. 수정하고 다시 검토해 보세요.",
                );
              else
                replaceCode(
                  problem.handoff
                    ? writeHandoffDraft(
                        problem.starterCode,
                        readHandoffDraft(code).notes,
                        readHandoffDraft(code).training,
                      )
                    : problem.starterCode,
                  "시작 코드로 초기화했습니다.",
                );
            }}
          >
            {confirm === "solution"
              ? "정답 열기"
              : confirm === "restore"
                ? "제출본 불러오기"
                : "시작 코드로 초기화"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
