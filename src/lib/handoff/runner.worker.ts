import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant, newVariant } from "quickjs-emscripten-core";
import { executeCase } from "./execute";

self.onmessage = async (
  event: MessageEvent<{ code: string; cases: { id: string; expression: string }[] }>,
) => {
  try {
    const { code, cases } = event.data;
    if (code.length > 30000 || cases.length > 8) throw new Error("실행할 내용이 너무 큽니다.");
    const engine = await newQuickJSWASMModuleFromVariant(
      newVariant(variant, {
        wasmLocation: new URL("/quickjs/quickjs-0.32.0.wasm", self.location.origin).href,
      }),
    );
    const results = cases.map((test) => executeCase(engine, code, test));
    self.postMessage({ results });
  } catch {
    self.postMessage({
      error: "실행 환경을 준비하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
    });
  }
};
