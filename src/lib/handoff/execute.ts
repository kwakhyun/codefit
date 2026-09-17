import type { QuickJSWASMModule, QuickJSHandle } from "quickjs-emscripten-core";
import type { ExecutionResult } from "./training";

const EXECUTION_LIMITS = { timeMs: 600, memoryBytes: 16 * 1024 * 1024, stackBytes: 256 * 1024 };

/** Only called in a dedicated browser Worker (or isolated developer tests).
 * No host functions, module loader, timers, network, DOM, or filesystem are exposed.
 */
export function executeCase(
  engine: QuickJSWASMModule,
  code: string,
  test: { id: string; expression: string },
): ExecutionResult {
  const runtime = engine.newRuntime();
  runtime.setMemoryLimit(EXECUTION_LIMITS.memoryBytes);
  runtime.setMaxStackSize(EXECUTION_LIMITS.stackBytes);
  const deadline = performance.now() + EXECUTION_LIMITS.timeMs;
  runtime.setInterruptHandler(() => performance.now() > deadline);
  const vm = runtime.newContext();
  let result: QuickJSHandle | undefined;
  try {
    // Evaluate separately so comments in the learner's source cannot absorb the test.
    const loaded = vm.evalCode(code, "learner.js", { type: "global" });
    if (loaded.error) {
      const error = vm.dump(loaded.error);
      loaded.error.dispose();
      throw new Error(String(error?.message || "코드를 읽지 못했습니다."));
    }
    loaded.value.dispose();
    const evaluated = vm.evalCode(
      `(async () => JSON.stringify(await (${test.expression})))()`,
      "check.js",
    );
    if (evaluated.error) {
      const error = vm.dump(evaluated.error);
      evaluated.error.dispose();
      throw new Error(String(error?.message || "테스트를 시작하지 못했습니다."));
    }
    result = evaluated.value;
    while (runtime.hasPendingJob() && performance.now() <= deadline) {
      const jobs = runtime.executePendingJobs(1);
      if (jobs.error) {
        jobs.error.dispose();
        throw new Error("비동기 작업 실행 중 오류가 발생했습니다.");
      }
    }
    const state = vm.getPromiseState(result);
    if (state.type === "pending")
      throw new Error("완료되지 않은 Promise 또는 실행 시간 초과입니다.");
    if (state.type === "rejected") {
      const error = vm.dump(state.error);
      state.error.dispose();
      throw new Error(String(error?.message || "실행 중 오류가 발생했습니다."));
    }
    const actual = vm.getString(state.value);
    state.value.dispose();
    if (actual.length > 1600) throw new Error("출력은 1,600자까지만 확인할 수 있습니다.");
    return { id: test.id, status: "ok", actual: actual || "undefined" };
  } catch (error) {
    return {
      id: test.id,
      status: "error",
      actual: (error instanceof Error ? error.message : "실행 오류").slice(0, 1600),
    };
  } finally {
    result?.dispose();
    vm.dispose();
    runtime.dispose();
  }
}
