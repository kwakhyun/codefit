"use client";
import type { Dispatch, SetStateAction } from "react";

import { Modal } from "@/components/ui/modal";
interface HelpDialogProps {
  helpOpen: boolean;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
}
export function HelpDialog({ helpOpen, setHelpOpen }: HelpDialogProps) {
  return (
    <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="QUICK START">
      <div className="help-content">
        <span className="eyebrow">WELCOME TO CODE:FIT</span>
        <h2>코드핏 시작하기</h2>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>지금 나에게 맞는 출발점을 고르세요.</strong>
              <p>
                처음이라면 앱의 원리 배우기에서 시작하세요. 코드를 읽을 수 있다면 AI 코드 이해
                훈련이나 문제 보관함을 이용하세요.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>예상하고, 직접 확인하세요.</strong>
              <p>
                앱을 조작하거나 코드를 실행하며 예상과 실제 결과를 비교하세요. 단계별 힌트를 볼 수
                있고 작성 내용은 자동 저장됩니다.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>수정 결과를 검사하고 응용하세요.</strong>
              <p>
                정상과 실패 상황을 모두 확인해 보세요. AI 질문과 풀이 검토는 선택 사항이며 실제
                제품의 검증이나 안전성 인증을 대신하지 않습니다.
              </p>
            </div>
          </li>
        </ol>
        <div className="shortcut-help">
          <span>
            <kbd>/</kbd> 문제 검색
          </span>
          <span>
            <kbd>⌘ / Ctrl + Enter</kbd> AI 풀이 검토
          </span>
        </div>
      </div>
    </Modal>
  );
}
