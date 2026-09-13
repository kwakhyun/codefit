"use client";

import { latestProgress } from "@/lib/progress";

import { api, ApiError, errorMessage } from "@/lib/client-api";
import type { Attempt, Progress, Workspace } from "@/lib/problem";
import { useCallback, useEffect, useState, type FormEvent } from "react";
export function usePracticeSession(onExpire: () => void) {
  const [data, setData] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState("");
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [reauth, setReauth] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const workspace = await api<Workspace>("/api/workspace");
      setData(workspace);
      setLocked(false);
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
        /* Keep legacy browser data intact if archival or local storage fails. */
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setLocked(true);
      else setLoadError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    const expired = () => {
      if (data) {
        setReauth(true);
        onExpire();
      }
    };
    window.addEventListener("codefit:session-expired", expired);
    return () => window.removeEventListener("codefit:session-expired", expired);
  }, [data, onExpire]);
  const onProgress = useCallback((progress: Progress, attempt?: Attempt) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            progress: {
              ...prev.progress,
              [progress.problemId]: latestProgress(prev.progress[progress.problemId], progress),
            },
            attempts: attempt
              ? [attempt, ...prev.attempts.filter((a) => a.id !== attempt.id)]
              : prev.attempts,
          }
        : prev,
    );
  }, []);
  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoadError("");
    try {
      await api("/api/session", { method: "POST", body: { password } });
      setPassword("");
      setReauth(false);
      window.dispatchEvent(new Event("codefit:session-restored"));
      await load();
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoginBusy(false);
    }
  }
  return {
    data,
    setData,
    loadError,
    locked,
    password,
    setPassword,
    reauth,
    refreshing,
    loginBusy,
    load,
    onProgress,
    login,
  };
}
