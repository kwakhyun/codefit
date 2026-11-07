"use client";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import type { ExampleTestsController } from "@/hooks/use-example-tests";
import type { ExampleTest } from "@/lib/example-tests";
import type { ProblemCheck } from "@/lib/problem";
import { ExampleTestsPanel, SelfCheckPanel } from "./example-tests-panel";

/** Example tests when the problem has them, otherwise the self-check status. */
export function CodingChecks({
  problemId,
  scope,
  tests,
  controller,
  check,
  onCheck,
  onError,
}: {
  problemId: string;
  scope: string;
  tests: ExampleTest[] | null;
  controller: ExampleTestsController;
  check: ProblemCheck | null | undefined;
  onCheck: (check: ProblemCheck | null) => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  if (tests) return <ExampleTestsPanel tests={tests} controller={controller} />;
  async function toggle(checked: boolean) {
    setPending(true);
    onError("");
    try {
      const url = `/api/problems/${encodeURIComponent(problemId)}/check`;
      const result = await api<{ check: ProblemCheck | null }>(
        url,
        checked ? { method: "POST", scope, body: { kind: "self" } } : { method: "DELETE", scope },
      );
      onCheck(result.check);
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <SelfCheckPanel check={check} pending={pending} onToggle={(value) => void toggle(value)} />
  );
}
