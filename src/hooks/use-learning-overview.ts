"use client";
import { useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import type { Progress } from "@/lib/problem";

type Overview = { scope: string; signedIn: boolean; progress: Progress[] };
/** Private, component-local state. Recheck ownership when the user returns to this tab. */
export function useLearningOverview(scope?: string) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let version = 0;
    async function load() {
      const current = ++version;
      setData(null);
      setError("");
      try {
        const value = await api<Overview>("/api/learn", {
          scope,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (scope && value.scope !== scope)
          throw new ApiError("계정이 변경되었습니다. 새로고침해 주세요.", 409);
        if (!controller.signal.aborted && current === version) setData(value);
      } catch (e) {
        if (!controller.signal.aborted && current === version) setError(errorMessage(e));
      }
    }
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [scope, retry]);
  return {
    data: data && (!scope || data.scope === scope) ? data : null,
    error,
    reload: () => setRetry((v) => v + 1),
  };
}
