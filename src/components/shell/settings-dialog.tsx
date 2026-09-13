"use client";

import type { RefObject } from "react";
import type { Dispatch, SetStateAction } from "react";

import { AiUsage } from "./ai-usage";
import { Modal } from "@/components/ui/modal";
import type { Workspace } from "@/lib/problem";
import { ArrowDownToLine, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
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
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="WORKSPACE SETTINGS">
      <div className="settings-content">
        <span className="eyebrow">MAKE YOURSELF AT HOME</span>
        <h2>내게 맞는 연습 환경</h2>
        <label className="font-setting">
          코드 글자 크기 <strong>{fontSize}px</strong>
          <input
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
        </label>
        <div className="font-preview mono" style={{ fontSize }}>
          const practice = () =&gt; progress++;
        </div>
        {settingsOpen && <AiUsage />}
        <div className="settings-info">
          <span>
            <span className={`status-dot ${!data?.aiReady ? "waiting" : ""}`} />
            AI 연결
          </span>
          <strong>{data?.aiReady ? "서버에 연결 정보 설정됨" : "API 키 설정 필요"}</strong>
        </div>
        <div className="settings-info">
          <span>
            <ShieldCheck size={15} />
            저장소
          </span>
          <strong>{data ? "서버 데이터베이스" : "연결 확인 중"}</strong>
        </div>
        <p className="muted">
          문제는 연습실 전체에 공유되며, 풀이와 진도는 이 브라우저의 개인 세션에 저장됩니다.
          브라우저 쿠키를 삭제하기 전 기록을 내보내세요. 다른 브라우저에서는 백업을 가져와 이어갈 수
          있습니다.
        </p>
        {Boolean(data?.legacyCount) && (
          <p className="inline-warning">
            이전 버전의 생성 예제 {data?.legacyCount}개도 서버에 별도로 보관했습니다. 내보내기에
            원본이 포함됩니다.
          </p>
        )}
        <button className="secondary-button full-width" onClick={exportData} disabled={exporting}>
          {exporting ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}
          전체 문제와 내 학습 기록 내보내기
        </button>
        <input
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
        <button
          className="secondary-button full-width import-button"
          onClick={() => importFile.current?.click()}
          disabled={importing}
        >
          {importing ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}백업
          가져오기
        </button>
        {settingsNotice && (
          <p
            className={settingsNotice.error ? "inline-error" : "draft-notice"}
            role={settingsNotice.error ? "alert" : "status"}
          >
            {settingsNotice.text}
          </p>
        )}
        <p className="import-note">이미 있는 문제와 작성 코드는 유지하고 새 기록을 추가합니다.</p>
      </div>
    </Modal>
  );
}
