"use client";
import { ThemeSelect } from "@/components/theme/theme-select";
import { FieldLabel, Input, Button, Status } from "@/components/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { AiUsage } from "./ai-usage";
import { Modal } from "@/components/ui/modal";
import { api, errorMessage } from "@/lib/client-api";
import type { Workspace } from "@/lib/problem";
import { useEditorPreferences } from "@/hooks/use-editor-preferences";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { ArrowDownToLine, LoaderCircle, Upload } from "lucide-react";

type WorkspaceInfo = Pick<Workspace, "scope" | "aiReady" | "legacyCount">;

/** Available on every screen: theme, code font size, AI usage and backups. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { fontSize, changeFontSize } = useEditorPreferences();
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [infoError, setInfoError] = useState("");
  const [retry, setRetry] = useState(0);
  const lookup = useRef<Promise<WorkspaceInfo | undefined> | null>(null);
  useEffect(() => {
    if (!open) return;
    // Read the current session each time: the account may have changed in another tab.
    const request = api<Workspace>("/api/workspace", { scope: null, track: false }).then(
      (workspace) => {
        const value = {
          scope: workspace.scope,
          aiReady: workspace.aiReady,
          legacyCount: workspace.legacyCount,
        };
        setInfo(value);
        setInfoError("");
        return value;
      },
      (error) => {
        setInfoError(errorMessage(error));
        return undefined;
      },
    );
    lookup.current = request;
  }, [open, retry]);
  const { settingsNotice, exporting, importing, importFile, exportData, importBackup } =
    useWorkspaceActions({
      scope: async () => (await lookup.current)?.scope,
    });
  return (
    <Modal open={open} onClose={onClose} title="환경 설정">
      <div className="settings-content">
        <span className="eyebrow">화면과 학습 기록 관리</span>
        <h2>내게 맞는 연습 환경</h2>
        <ThemeSelect />
        <FieldLabel className="font-setting">
          코드 글자 크기 <strong>{fontSize}px</strong>
          <Input
            type="range"
            min={12}
            max={20}
            step={1}
            value={fontSize}
            onChange={(e) => changeFontSize(Number(e.target.value))}
          />
        </FieldLabel>
        <div className="font-preview mono" style={{ fontSize }}>
          const practice = () =&gt; progress++;
        </div>
        {open && <AiUsage />}
        {info && !info.aiReady && (
          <p className="inline-warning">
            현재 AI 기능을 이용할 수 없습니다. 기존 문제와 학습 기록은 계속 이용할 수 있습니다.
          </p>
        )}
        <p className="muted">
          생성한 문제는 누구나 볼 수 있습니다. 풀이와 진도는 로그인한 계정에 저장되며, 로그인 전
          기록은 현재 브라우저에서 이어서 볼 수 있습니다. 로그인 전 기록은 계정으로 자동으로
          합쳐지지 않습니다. 옮기려면 로그인 전에 백업을 내보내고, 로그인한 뒤 가져오세요. 계정에
          이미 작성한 코드는 유지됩니다.
        </p>
        {Boolean(info?.legacyCount) && (
          <p className="inline-warning">
            이전 버전의 생성 예제 {info?.legacyCount}개도 서버에 별도로 보관했습니다. 내보내기에
            원본이 포함됩니다.
          </p>
        )}
        {infoError && (
          <Status className="inline-error" role="alert">
            {infoError}{" "}
            <Button className="text-button" onClick={() => setRetry((value) => value + 1)}>
              다시 확인
            </Button>
          </Status>
        )}
        <Button
          className="secondary-button full-width"
          onClick={exportData}
          disabled={exporting || importing || (!info && !infoError)}
        >
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
          disabled={importing || exporting || (!info && !infoError)}
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
          내 코딩 기록, 서비스 원리 미션, AI 실무 배우기 수업 진도와 프로젝트 평가·학습 기록을 함께
          백업합니다. 프로젝트 주소와 작성한 답변도 파일에 포함됩니다. 기존 백업 파일도 가져올 수
          있습니다.
        </p>
        <p className="import-note">
          기록이 많으면 작은 조각을 담은 파일 하나로 내보냅니다. 가져오기가 중단되면 같은 파일을
          다시 선택하세요. 완료된 조각과 기존 기록은 유지됩니다.
        </p>
      </div>
    </Modal>
  );
}
