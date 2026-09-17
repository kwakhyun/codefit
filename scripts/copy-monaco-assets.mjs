import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const source = path.join(projectRoot, "node_modules", "monaco-editor", "min", "vs");
const target = path.join(projectRoot, "public", "monaco", "vs");

await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true, force: true });

console.log("Monaco Editor assets are ready in public/monaco/vs.");

// QuickJS is served locally; executing a draft never fetches third-party scripts.
await mkdir(path.join(projectRoot, "public", "quickjs"), { recursive: true });
await cp(
  path.join(
    projectRoot,
    "node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm",
  ),
  path.join(projectRoot, "public/quickjs/quickjs-0.32.0.wasm"),
);
await cp(
  path.join(projectRoot, "node_modules/@jitl/quickjs-wasmfile-release-sync/LICENSE"),
  path.join(projectRoot, "public/quickjs/LICENSE.txt"),
);
