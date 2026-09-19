import type { QuickJSWASMModule, QuickJSHandle } from "quickjs-emscripten-core";
import type { ExecutionResult } from "./training";
import { SANDBOX_BOOTSTRAP } from "./sandbox-bootstrap";

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
  let serialize: QuickJSHandle | undefined;
  try {
    serialize = vm.unwrapResult(vm.evalCode(SANDBOX_BOOTSTRAP, "bootstrap.js"));
    // Evaluate separately so comments in the learner's source cannot absorb the test.
    const loaded = vm.evalCode(code, "learner.js", { type: "global" });
    if (loaded.error) {
      const error = vm.dump(loaded.error);
      loaded.error.dispose();
      throw new Error(String(error?.message || "코드를 읽지 못했습니다."));
    }
    loaded.value.dispose();
    const evaluated = vm.evalCode(`(async () => await (${test.expression}))()`, "check.js");
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
    if (performance.now() > deadline || runtime.hasPendingJob())
      throw new Error("실행 시간이 초과됐습니다. 비동기 작업의 종료 조건을 확인해 주세요.");
    const state = vm.getPromiseState(result);
    if (state.type === "pending")
      throw new Error("완료되지 않은 Promise 또는 실행 시간 초과입니다.");
    if (state.type === "rejected") {
      const error = vm.dump(state.error);
      state.error.dispose();
      throw new Error(String(error?.message || "실행 중 오류가 발생했습니다."));
    }
    try {
      const serialized = vm.callFunction(serialize, vm.undefined, state.value);
      if (serialized.error) {
        const error = vm.dump(serialized.error);
        serialized.error.dispose();
        throw new Error(String(error?.message || "실행 결과를 비교할 수 없습니다."));
      }
      try {
        return { id: test.id, status: "ok", actual: vm.getString(serialized.value) };
      } finally {
        serialized.value.dispose();
      }
    } finally {
      state.value.dispose();
    }
  } catch (error) {
    return {
      id: test.id,
      status: "error",
      actual: (error instanceof Error ? error.message : "실행 오류").slice(0, 1600),
    };
  } finally {
    result?.dispose();
    serialize?.dispose();
    vm.dispose();
    runtime.dispose();
  }
}
