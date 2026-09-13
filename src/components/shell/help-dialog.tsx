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
        <h2>AI 시대에도, 스스로 풀 수 있도록.</h2>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>유지하고 싶은 코딩 감각을 고르세요.</strong>
              <p>분야, 언어, 난이도와 유형으로 찾거나 AI로 직접 만들 수 있습니다.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>요구사항을 읽고 코드를 작성하세요.</strong>
              <p>
                먼저 스스로 구현해 보세요. 막히는 지점에서는 힌트를 한 단계씩 확인할 수 있습니다.
                코드는 자동 저장됩니다.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>AI 피드백으로 풀이를 개선하세요.</strong>
              <p>
                힌트를 단계별로 확인하고 정답과 비교할 수 있습니다. AI 검토는 코드를 실행하지 않으며
                실제 실행 검증을 대신하지 않습니다.
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
