import { loader } from "@monaco-editor/react";
import { configureMonaco } from "./monaco-setup";

type EmitOutput = { outputFiles: { name: string; text: string }[] };
type TypeScriptApi = {
  getTypeScriptWorker(): Promise<
    (...uris: unknown[]) => Promise<{ getEmitOutput(fileName: string): Promise<EmitOutput> }>
  >;
};
const TRANSPILE_TIMEOUT_MS = 20_000;
let sequence = 0;

/** Strips TypeScript types with the editor's own TypeScript worker, so example tests need no
 * extra compiler download. Type errors do not block the output; the editor still shows them. */
export async function transpileTypeScript(code: string): Promise<string> {
  const monaco = await loader.init();
  configureMonaco(monaco as unknown as Parameters<typeof configureMonaco>[0]);
  const api =
    (monaco.languages as unknown as { typescript?: TypeScriptApi }).typescript ??
    (monaco as unknown as { typescript?: TypeScriptApi }).typescript;
  if (!api?.getTypeScriptWorker) throw new Error("TypeScript 변환기를 불러오지 못했습니다.");
  const uri = monaco.Uri.parse(`file:///example-tests/run-${++sequence}.ts`);
  const model = monaco.editor.createModel(code, "typescript", uri);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const output = await Promise.race([
      api
        .getTypeScriptWorker()
        .then((worker) => worker(uri))
        .then((client) => client.getEmitOutput(uri.toString())),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("TypeScript 변환이 오래 걸립니다. 잠시 후 다시 실행해 주세요.")),
          TRANSPILE_TIMEOUT_MS,
        );
      }),
    ]);
    const js = output.outputFiles.find((file) => file.name.endsWith(".js"))?.text;
    if (js === undefined)
      throw new Error("TypeScript 코드를 실행할 수 있는 형태로 바꾸지 못했습니다.");
    return js;
  } finally {
    clearTimeout(timer);
    model.dispose();
  }
}
