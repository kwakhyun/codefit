"use client";

import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client-api";
import type { ProblemSummary, Progress } from "@/lib/problem";
import { useRef, useState } from "react";

/** Bookmarks and backups. Results go to the app-wide toast; errors stay until dismissed. */
export function useWorkspaceActions({
  onProgress,
  scope,
}: {
  onProgress?: (progress: Progress) => void;
  /** The account scope, or a lookup that resolves it when the caller has not loaded it yet. */
  scope: string | undefined | (() => Promise<string | undefined>);
}) {
  const toast = useToast();
  const [settingsNotice, setSettingsNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFile = useRef<HTMLInputElement>(null);
  const [bookmarking, setBookmarking] = useState<ReadonlySet<string>>(new Set());
  const bookmarkRequests = useRef(new Set<string>());
  async function currentScope() {
    const value = typeof scope === "function" ? await scope() : scope;
    if (!value) throw new Error("계정 정보를 불러온 뒤 다시 시도해 주세요.");
    return value;
  }
  async function bookmark(
    problem: ProblemSummary,
    bookmarked: boolean,
    show?: (bookmarked: boolean) => void,
  ) {
    // Rows are independent; only a repeated click on the same row waits for its request.
    const requests = bookmarkRequests.current;
    if (requests.has(problem.id)) return;
    requests.add(problem.id);
    setBookmarking(new Set(requests));
    show?.(!bookmarked);
    try {
      const { progress } = await api<{ progress: Progress }>(`/api/progress/${problem.id}`, {
        method: "PUT",
        body: { bookmarked: !bookmarked },
      });
      onProgress?.(progress);
    } catch (e) {
      show?.(bookmarked);
      toast.show(errorMessage(e), "error");
    } finally {
      requests.delete(problem.id);
      setBookmarking(new Set(requests));
    }
  }
  async function exportData() {
    setExporting(true);
    setSettingsNotice(null);
    try {
      const owner = await currentScope();
      const { downloadBackup } = await import("@/lib/backup-client");
      const result = await downloadBackup(owner, (text) =>
        setSettingsNotice({ text, error: false }),
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `codefit-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const message =
        result.version === 4
          ? `문제와 학습 기록을 ${result.parts.length}개 조각이 담긴 묶음 파일로 내보냈습니다. 이 파일 하나로 복원할 수 있습니다.`
          : "문제와 학습 기록을 내보냈습니다.";
      toast.show(message);
      setSettingsNotice({ text: message, error: false });
    } catch (e) {
      const message = errorMessage(e);
      toast.show(message, "error");
      setSettingsNotice({ text: message, error: true });
    } finally {
      setExporting(false);
    }
  }
  async function importBackup(file: File) {
    setImporting(true);
    setSettingsNotice(null);
    try {
      const owner = await currentScope();
      const { restoreBackup } = await import("@/lib/backup-client");
      let body: unknown;
      try {
        body = JSON.parse(await file.text());
      } catch {
        throw new Error("올바른 JSON 백업 파일이 아닙니다. 내보낸 백업 파일을 선택해 주세요.");
      }
      const result = await restoreBackup(body, owner, (text) =>
        setSettingsNotice({ text, error: false }),
      );
      // Open screens (problem lists, projects, lessons) refresh their own records.
      window.dispatchEvent(new Event("codefit:backup-imported"));
      const message = `백업을 가져왔습니다. 새 문제 ${result.problems}개, 풀이 ${result.attempts}개, 서비스 원리 미션 ${result.learning ?? 0}개, 프로젝트 ${result.projects ?? 0}개가 추가되었습니다. 기존 기록은 유지했습니다.`;
      toast.show(message);
      setSettingsNotice({ text: message, error: false });
    } catch (e) {
      // A previous part may have committed. Refresh those records even if a later part failed.
      window.dispatchEvent(new Event("codefit:backup-imported"));
      const message = errorMessage(e);
      toast.show(message, "error");
      setSettingsNotice({ text: message, error: true });
    } finally {
      setImporting(false);
      if (importFile.current) importFile.current.value = "";
    }
  }
  return {
    settingsNotice,
    exporting,
    importing,
    importFile,
    bookmarking,
    bookmark,
    exportData,
    importBackup,
  };
}
