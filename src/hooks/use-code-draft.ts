"use client";

import { api, ApiError } from "@/lib/client-api";
import { browserDraft, type StoredDraft } from "@/lib/drafts/browser-draft";
import { DraftController } from "@/lib/drafts/draft-controller";
import type { Progress } from "@/lib/problem";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

export function useCodeDraft({
  id,
  scope,
  mounted,
  onSaved,
  onError,
  endpoint,
}: {
  endpoint?: string;
  id: string;
  scope: string;
  mounted: RefObject<boolean>;
  onSaved: (progress: Progress) => void;
  onError: (message: string) => void;
}) {
  const callbacks = useRef({ onSaved, onError });
  useEffect(() => {
    callbacks.current = { onSaved, onError };
  }, [onSaved, onError]);
  const handleError = useCallback(
    (message: string) => {
      if (mounted.current) callbacks.current.onError(message);
    },
    [mounted],
  );
  const handleSaved = useCallback(
    (progress: Progress) => {
      if (mounted.current) callbacks.current.onSaved(progress);
    },
    [mounted],
  );
  const [storage] = useState(() => browserDraft(scope, id));
  const [machine] = useState(
    () =>
      new DraftController({
        online: () => navigator.onLine,
        persist: storage.write,
        onSaved: () => {},
        save: async (code, baseRevision) => {
          try {
            const { progress } = await api<{ progress: Progress }>(
              endpoint ?? `/api/progress/${encodeURIComponent(id)}`,
              {
                method: "PUT",
                scope,
                body: { code, baseRevision },
                keepalive: new TextEncoder().encode(code).length < 45000,
              },
            );
            return { saved: progress };
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.status === 409 &&
              error.payload?.kind === "code_conflict" &&
              error.payload.current
            )
              return { conflict: error.payload.current as Progress };
            throw error;
          }
        },
      }),
  );
  useEffect(() => {
    storage.setErrorHandler(handleError);
    machine.setSavedHandler(handleSaved);
  }, [storage, machine, handleError, handleSaved]);
  useEffect(() => {
    storage.claim();
    return () => storage.release();
  }, [storage]);
  const { code, status, localSaved } = useSyncExternalStore(
    machine.subscribe,
    machine.getSnapshot,
    machine.getSnapshot,
  );
  const [recoverable, setRecoverable] = useState<StoredDraft[]>([]);
  // A closed tab's unsaved draft built on the current server code, offered for loading.
  const [orphan, setOrphan] = useState<StoredDraft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const server = useRef<{ progress: Progress | null; starter: string }>({
    progress: null,
    starter: "",
  });
  const refreshRecoverable = useCallback(async () => {
    const drafts = await storage.others();
    if (!mounted.current) return;
    const { progress, starter } = server.current;
    setRecoverable(drafts);
    setOrphan(
      machine.hasUnsaved()
        ? null
        : (drafts.find(
            (d) =>
              d.live === false &&
              !storage.isRecovered(d.key) &&
              d.record.code !== (progress?.code ?? starter) &&
              d.record.baseRevision === (progress?.codeRevision ?? 0),
          ) ?? null),
    );
  }, [machine, storage, mounted]);
  const initialize = useCallback(
    (progress: Progress | null, starter: string) => {
      server.current = { progress, starter };
      const restored = machine.initialize(progress, starter, storage.read());
      void refreshRecoverable();
      return restored;
    },
    [machine, storage, refreshRecoverable],
  );
  const discardDraft = useCallback(
    (key: string) => {
      storage.discard(key);
      setOrphan((current) => (current?.key === key ? null : current));
      void refreshRecoverable();
    },
    [storage, refreshRecoverable],
  );
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return machine.flush();
  }, [machine]);
  const changeCode = useCallback(
    (value: string) => {
      if (value.length > 30000) {
        callbacks.current.onError("코드는 30,000자까지 작성할 수 있습니다.");
        return;
      }
      machine.change(value);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void machine.flush();
      }, 700);
    },
    [machine],
  );
  const restoreImportedCode = useCallback(
    (progress: Progress | null) => {
      if (!machine.hasUnsaved() && progress)
        machine.initialize(progress, server.current.starter, null);
    },
    [machine],
  );
  const saveBeforeReview = useCallback(async () => {
    if (!(await flush())) throw new Error("초안을 먼저 저장하거나 충돌을 해결한 뒤 검토해 주세요.");
  }, [flush]);
  useEffect(() => {
    const retry = () => {
      void flush();
    };
    const hide = () => {
      if (document.visibilityState === "hidden") retry();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (machine.hasUnsaved()) {
        retry();
        event.preventDefault();
      }
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [flush, machine]);
  return {
    code,
    localSaved,
    saveState: status.kind,
    draftStatus: status,
    recoverable,
    orphan,
    discardDraft,
    // Recovery copies into the editor; the existing text can be restored with the usual undo action.
    initialize,
    changeCode,
    flush,
    saveNow: flush,
    saveBeforeReview,
    restoreImportedCode,
    resolveConflict: () => machine.resolve(),
    getCode: () => machine.getSnapshot().code,
  };
}
