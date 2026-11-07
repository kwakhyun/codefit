"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import {
  gradeResults,
  hasImport,
  summarizeResults,
  toScript,
  type ExampleTest,
  type ExampleTestResult,
} from "@/lib/example-tests";
import { runInSandbox } from "@/lib/handoff/runner";
import type { Language } from "@/lib/catalog";
import type { ProblemCheck } from "@/lib/problem";

/** Runs a problem's example tests against the editor code in the browser sandbox.
 * A full pass is recorded as "예시 테스트 통과"; it never marks the problem solved. */
export function useExampleTests({
  problemId,
  scope,
  language,
  tests,
  code,
  onRecorded,
}: {
  problemId: string;
  scope: string;
  language: Language;
  tests: ExampleTest[] | null;
  code: string;
  onRecorded: (check: ProblemCheck) => void;
}) {
  const [run, setRun] = useState<{ code: string; results: ExampleTestResult[] } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const recorded = useRef(onRecorded);
  useEffect(() => {
    recorded.current = onRecorded;
  }, [onRecorded]);
  useEffect(() => () => active.current?.abort(), []);

  const execute = useCallback(async () => {
    if (!tests || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const snapshot = code;
    setRunning(true);
    setError("");
    try {
      const source =
        language === "typescript"
          ? await (await import("@/lib/editor/transpile")).transpileTypeScript(snapshot)
          : snapshot;
      if (hasImport(source))
        throw new Error(
          "예시 테스트는 import 없이 실행합니다. import 문을 지우고 필요한 코드를 파일 안에 작성해 주세요.",
        );
      const raw = await runInSandbox(
        toScript(source),
        tests.map(({ id, expression }) => ({ id, expression })),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const results = gradeResults(tests, raw);
      setRun({ code: snapshot, results });
      const summary = summarizeResults(results);
      if (summary.passed === summary.total) {
        try {
          const { check } = await api<{ check: ProblemCheck }>(
            `/api/problems/${encodeURIComponent(problemId)}/check`,
            { method: "POST", scope, body: { kind: "tests", ...summary }, track: false },
          );
          if (!controller.signal.aborted) recorded.current(check);
        } catch {
          /* The status is a convenience; the results on screen stay accurate. */
        }
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (active.current === controller) {
        active.current = null;
        setRunning(false);
      }
    }
  }, [tests, code, language, problemId, scope]);

  const summary = run ? summarizeResults(run.results) : null;
  return {
    results: run?.results ?? null,
    summary,
    /** The shown results belong to different code than the editor now holds. */
    stale: Boolean(run && run.code !== code),
    running,
    error,
    run: execute,
    cancel: () => {
      active.current?.abort();
      active.current = null;
      setRunning(false);
    },
    /** The latest run, only when it was made on exactly this code (sent with a review). */
    summaryFor: (value: string) => (run && run.code === value ? summary! : undefined),
  };
}
export type ExampleTestsController = ReturnType<typeof useExampleTests>;
