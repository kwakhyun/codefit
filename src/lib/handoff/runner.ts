import { z } from "zod";
import { executionResultSchema, type ExecutionResult } from "./training";

export function runInSandbox(
  code: string,
  cases: { id: string; expression: string }[],
  signal: AbortSignal,
): Promise<ExecutionResult[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("실행을 취소했습니다."));
      return;
    }
    const worker = new Worker(new URL("./runner.worker.ts", import.meta.url), { type: "module" });
    let finished = false;
    const end = (error?: Error, results?: ExecutionResult[]) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(results!);
    };
    const abort = () => end(new Error("실행을 취소했습니다. 작성한 내용은 유지됩니다."));
    const timer = setTimeout(
      () => end(new Error("실행 시간이 초과됐습니다. 반복문과 Promise 종료 조건을 확인해 주세요.")),
      12000,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => end(new Error("실행 환경을 불러오지 못했습니다. 다시 시도해 주세요."));
    worker.onmessage = (event) => {
      const parsed = z
        .object({ results: z.array(executionResultSchema).max(8) })
        .safeParse(event.data);
      if (
        !parsed.success ||
        parsed.data.results.length !== cases.length ||
        parsed.data.results.some((r, i) => r.id !== cases[i].id)
      )
        end(new Error("실행 결과를 확인하지 못했습니다. 다시 시도해 주세요."));
      else end(undefined, parsed.data.results);
    };
    worker.postMessage({ code, cases });
  });
}
