import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const source = path.join(projectRoot, "node_modules", "monaco-editor", "min", "vs");
const target = path.join(projectRoot, "public", "monaco", "vs");

await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true, force: true });

console.log("Monaco Editor assets are ready in public/monaco/vs.");
