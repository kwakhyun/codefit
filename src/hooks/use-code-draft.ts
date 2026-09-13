"use client";

import { api } from "@/lib/client-api";
import type { Progress } from "@/lib/problem";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export function useCodeDraft({
  id,
  mounted,
  onSaved,
  onError,
}: {
  id: string;
  mounted: RefObject<boolean>;
  onSaved: (progress: Progress) => void;
  onError: (message: string) => void;
}) {
  const [code, setCode] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "local" | "failed">("saved");
  const latest = useRef({ code: "", dirty: false });
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const draftKey = `recode-draft:${id}`;

  const save = useCallback(
    (value: string, savedVersion: number) => {
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          if (mounted.current) setSaveState("saving");
          try {
            const { progress } = await api<{ progress: Progress }>(
              `/api/progress/${encodeURIComponent(id)}`,
              {
                method: "PUT",
                body: { code: value },
                keepalive: new TextEncoder().encode(value).length < 45000,
              },
            );
            if (!mounted.current) return;
            if (savedVersion === version.current) {
              latest.current.dirty = false;
              setSaveState("saved");
              try {
                const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
                if (draft?.code === value) localStorage.removeItem(draftKey);
              } catch {
                /* The server has already saved this version. */
              }
            }
            onSaved(progress);
          } catch {
            if (mounted.current) setSaveState("failed");
          }
        });
      return queue.current;
    },
    [id, mounted, draftKey, onSaved],
  );

  const initialize = useCallback(
    (progress: Progress | null, starterCode: string) => {
      let draft = progress?.code ?? starterCode;
      let localNewer = false;
      try {
        const local = JSON.parse(localStorage.getItem(draftKey) || "null");
        if (
          local &&
          typeof local.code === "string" &&
          local.code.length <= 30000 &&
          local.at > Date.parse(progress?.updatedAt || "1970-01-01")
        ) {
          draft = local.code;
          localNewer = draft !== progress?.code;
        }
      } catch {
        /* Fall back to the server when browser storage is unavailable. */
      }
      latest.current = { code: draft, dirty: localNewer };
      setCode(draft);
      setSaveState(localNewer ? "local" : "saved");
      return localNewer;
    },
    [draftKey],
  );

  const changeCode = useCallback(
    (value: string) => {
      if (value.length > 30000) {
        onError("코드는 30,000자까지 작성할 수 있습니다.");
        return;
      }
      setCode(value);
      latest.current = { code: value, dirty: true };
      version.current++;
      setSaveState("local");
      try {
        localStorage.setItem(draftKey, JSON.stringify({ code: value, at: Date.now() }));
      } catch {
        setSaveState("failed");
      }
      if (timer.current) clearTimeout(timer.current);
      const changedVersion = version.current;
      timer.current = setTimeout(() => {
        void save(value, changedVersion);
      }, 700);
    },
    [draftKey, onError, save],
  );

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return latest.current.dirty ? save(latest.current.code, version.current) : queue.current;
  }, [save]);
  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return save(latest.current.code, version.current);
  }, [save]);
  const saveBeforeReview = useCallback(
    (submittedCode: string) => {
      if (timer.current) clearTimeout(timer.current);
      return latest.current.dirty ? save(submittedCode, version.current) : queue.current;
    },
    [save],
  );
  const restoreImportedCode = useCallback((importedCode: string | null | undefined) => {
    if (!latest.current.dirty && version.current === 0 && importedCode != null) {
      latest.current.code = importedCode;
      setCode(importedCode);
    }
  }, []);

  useEffect(() => {
    const retry = () => {
      void flush();
    };
    const hide = () => {
      if (document.visibilityState === "hidden") retry();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.dirty) {
        retry();
        event.preventDefault();
      }
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [flush]);

  return {
    code,
    saveState,
    initialize,
    changeCode,
    flush,
    saveNow,
    saveBeforeReview,
    restoreImportedCode,
    getCode: () => latest.current.code,
  };
}
