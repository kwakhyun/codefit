"use client";

import { api, errorMessage, setWorkspaceScope } from "@/lib/client-api";
import type { Attempt, Progress, Workspace } from "@/lib/problem";
import { useCallback, useEffect, useRef, useState } from "react";

export function usePracticeSession(activeId?: string, libraryHref = "/", attemptId?: string) {
  const [data, setData] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const requestVersion = useRef(0);
  const initial = useRef(true);
  const signatures = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (activeId) params.set("problem", activeId);
      if (initial.current) {
        params.set("include", "initial");
        params.set("library", libraryHref);
        if (attemptId) params.set("attempt", attemptId);
      }
      const workspace = await api<Workspace>(`/api/workspace?${params}`);
      if (version !== requestVersion.current) return;
      setWorkspaceScope(workspace.scope);
      initial.current = false;
      setData((previous) => ({
        ...workspace,
        bootstrap:
          workspace.bootstrap ??
          (previous?.scope === workspace.scope ? previous.bootstrap : undefined),
      }));
      setLoadError("");
      try {
        const legacyText = localStorage.getItem("recode-progress-v1");
        if (legacyText && !localStorage.getItem("recode-legacy-archived-v2")) {
          const legacy = JSON.parse(legacyText);
          if (Array.isArray(legacy.generatedLessons)) {
            await api("/api/workspace", { method: "POST", body: legacy });
            localStorage.setItem("recode-legacy-archived-v2", "yes");
            setData((d) => (d ? { ...d, legacyCount: legacy.generatedLessons.length } : d));
          }
        }
      } catch {
        /* Legacy browser data stays intact if archival fails. */
      }
    } catch (error) {
      if (version === requestVersion.current) setLoadError(errorMessage(error));
    } finally {
      if (version === requestVersion.current) setRefreshing(false);
    }
  }, [activeId, libraryHref, attemptId]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const version = requestVersion;
    return () => {
      version.current++;
    };
  }, [load]);
  const onProgress = useCallback(
    (progress: Progress, attempt?: Attempt) => {
      // Code autosaves do not repeatedly refresh the catalog and aggregate statistics.
      const signature = JSON.stringify([
        progress.status,
        progress.bookmarked,
        progress.hintsViewed,
        progress.solutionViewed,
      ]);
      if (attempt || signatures.current.get(progress.problemId) !== signature) {
        signatures.current.set(progress.problemId, signature);
        void load();
      }
    },
    [load],
  );
  return { data, loadError, refreshing, load, onProgress };
}
