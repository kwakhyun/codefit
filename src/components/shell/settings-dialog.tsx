"use client";
import { FieldLabel, Input, Button } from "@/components/ui/primitives";

import type { RefObject } from "react";
import type { Dispatch, SetStateAction } from "react";

import { AiUsage } from "./ai-usage";
import { Modal } from "@/components/ui/modal";
import type { Workspace } from "@/lib/problem";
import { ArrowDownToLine, LoaderCircle, Upload } from "lucide-react";
interface SettingsDialogProps {
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  fontSize: number;
  setFontSize: (size: number) => void;
  data: Workspace | null;
  exportData: () => Promise<void>;
  exporting: boolean;
  importFile: RefObject<HTMLInputElement | null>;
  importBackup: (file: File) => Promise<void>;
  importing: boolean;
  settingsNotice: { text: string; error: boolean } | null;
}
export function SettingsDialog({
  settingsOpen,
  setSettingsOpen,
  fontSize,
  setFontSize,
  data,
  exportData,
  exporting,
  importFile,
  importBackup,
  importing,
  settingsNotice,
}: SettingsDialogProps) {
  return (
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="환경 설정">
      <div className="settings-content">
        <span className="eyebrow">MAKE YOURSELF AT HOME</span>
        <h2>내게 맞는 연습 환경</h2>
        <FieldLabel className="font-setting">
          코드 글자 크기 <strong>{fontSize}px</strong>
          <Input
            type="range"
            min={12}
            max={20}
            step={1}
            value={fontSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setFontSize(size);
            }}
          />
        </FieldLabel>
        <div className="font-preview mono" style={{ fontSize }}>
          const practice = () =&gt; progress++;
        </div>
        {settingsOpen && <AiUsage />}
        {data && !data.aiReady && (
          <p className="inline-warning">
            현재 AI 기능을 이용할 수 없습니다. 기존 문제와 학습 기록은 계속 이용할 수 있습니다.
          </p>
        )}
        <p className="muted">
          생성한 문제는 누구나 볼 수 있습니다. 풀이와 진도는 로그인한 계정에 저장되며, 로그인 전
          기록은 현재 브라우저에서 이어서 볼 수 있습니다. 게스트 코딩 기록을 계정으로 옮기려면
          로그인 전에 백업을 내보내고, 로그인한 뒤 가져오세요. 계정에 이미 작성한 코드는 유지됩니다.
        </p>
        {Boolean(data?.legacyCount) && (
          <p className="inline-warning">
            이전 버전의 생성 예제 {data?.legacyCount}개도 서버에 별도로 보관했습니다. 내보내기에
            원본이 포함됩니다.
          </p>
        )}
        <Button className="secondary-button full-width" onClick={exportData} disabled={exporting}>
          {exporting ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}
          내 학습 기록 내보내기
        </Button>
        <Input
          ref={importFile}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="학습 기록 백업 파일"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
          }}
        />
        <Button
          className="secondary-button full-width import-button"
          onClick={() => importFile.current?.click()}
          disabled={importing}
        >
          {importing ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}백업
          가져오기
        </Button>
        {settingsNotice && (
          <p
            className={settingsNotice.error ? "inline-error" : "draft-notice"}
            role={settingsNotice.error ? "alert" : "status"}
          >
            {settingsNotice.text}
          </p>
        )}
        <p className="import-note">이미 있는 문제와 작성 코드는 유지하고 새 기록을 추가합니다.</p>
        <p className="import-note">
          내 코딩 기록, 입문 실습과 프로젝트 평가와 학습 기록을 함께 백업합니다. 프로젝트 주소와
          작성한 답변도 파일에 포함됩니다. 기존 백업 파일도 가져올 수 있습니다.
        </p>
      </div>
    </Modal>
  );
}
