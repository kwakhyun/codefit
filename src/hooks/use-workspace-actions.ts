"use client";

import { api, errorMessage } from "@/lib/client-api";
import type { ProblemSummary, Progress, Workspace } from "@/lib/problem";
import { useEffect, useRef, useState } from "react";
export function useWorkspaceActions({
  data,
  load,
  onProgress,
}: {
  data: Workspace | null;
  load: () => Promise<void>;
  onProgress: (progress: Progress) => void;
}) {
  const [toast, setToast] = useState("");
  const [toastError, setToastError] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFile = useRef<HTMLInputElement>(null);
  const [bookmarking, setBookmarking] = useState<string | null>(null);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  async function bookmark(problem: ProblemSummary) {
    if (bookmarking) return;
    setBookmarking(problem.id);
    try {
      const { progress } = await api<{ progress: Progress }>(`/api/progress/${problem.id}`, {
        method: "PUT",
        body: { bookmarked: !data?.progress[problem.id]?.bookmarked },
      });
      onProgress(progress);
    } catch (e) {
      setToastError(true);
      setToast(errorMessage(e));
    } finally {
      setBookmarking(null);
    }
  }
  async function exportData() {
    setExporting(true);
    setSettingsNotice(null);
    try {
      const result = await api<unknown>("/api/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `codefit-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setToastError(false);
      setToast("문제와 학습 기록을 내보냈습니다.");
      setSettingsNotice({ text: "문제와 학습 기록을 내보냈습니다.", error: false });
    } catch (e) {
      const message = errorMessage(e);
      setToastError(true);
      setToast(message);
      setSettingsNotice({ text: message, error: true });
    } finally {
      setExporting(false);
    }
  }
  async function importBackup(file: File) {
    setImporting(true);
    setSettingsNotice(null);
    try {
      if (file.size > 10_000_000) throw new Error("백업 파일은 10 MB까지 가져올 수 있습니다.");
      let body: unknown;
      try {
        body = JSON.parse(await file.text());
      } catch {
        throw new Error("올바른 JSON 백업 파일이 아닙니다. 내보낸 백업 파일을 선택해 주세요.");
      }
      const result = await api<{ problems: number; attempts: number }>("/api/import", {
        method: "POST",
        body,
      });
      await load();
      window.dispatchEvent(new Event("codefit:backup-imported"));
      const message = `백업을 가져왔습니다. 새 문제 ${result.problems}개, 풀이 기록 ${result.attempts}개가 추가되었습니다.`;
      setToastError(false);
      setToast(message);
      setSettingsNotice({ text: message, error: false });
    } catch (e) {
      const message = errorMessage(e);
      setToastError(true);
      setToast(message);
      setSettingsNotice({ text: message, error: true });
    } finally {
      setImporting(false);
      if (importFile.current) importFile.current.value = "";
    }
  }
  return {
    toast,
    setToast,
    toastError,
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
