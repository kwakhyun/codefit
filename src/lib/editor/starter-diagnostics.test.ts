import ts from "typescript";
import { describe, expect, it } from "vitest";
import { seedProblems } from "../../data/problems";
import { LANGUAGES } from "../catalog";
import { REACT_EDITOR_TYPES } from "./react-editor-types";

// Mirrors the TypeScript defaults in monaco-setup.ts. The editor bundles its own compiler,
// so this is a regression check for the provided code, not a byte-for-byte replica.
const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  moduleDetection: ts.ModuleDetectionKind.Force,
  strict: true,
  jsx: ts.JsxEmit.ReactJSX,
  types: [],
  noEmit: true,
};
const REACT_TYPES = "/node_modules/@types/react/index.d.ts";

function diagnostics(fileName: string, source: string) {
  const files = new Map([
    [REACT_TYPES, REACT_EDITOR_TYPES],
    [fileName, source],
  ]);
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => options,
    getScriptFileNames: () => [...files.keys()],
    getScriptVersion: () => "1",
    getScriptSnapshot: (name) => {
      const text = files.get(name) ?? ts.sys.readFile(name);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (name) => files.has(name) || ts.sys.fileExists(name),
    readFile: (name) => files.get(name) ?? ts.sys.readFile(name),
  };
  const service = ts.createLanguageService(host);
  return [
    ...service.getSyntacticDiagnostics(fileName),
    ...service.getSemanticDiagnostics(fileName),
  ].map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

const typed = seedProblems.filter(
  (p) => !p.handoff && LANGUAGES[p.language].monaco === "typescript",
);

describe("built-in TypeScript starters in the editor", () => {
  it("covers every TypeScript and TSX problem", () => {
    expect(typed.map((p) => p.id)).toContain("fe-search-race");
  });
  it.each(typed.map((p) => [p.id, p] as const))("%s starter shows no compiler errors", (_, p) => {
    const file = `/practice/${p.id}.${LANGUAGES[p.language].ext}`;
    expect(diagnostics(file, p.starterCode)).toEqual([]);
  });
  it.each(typed.map((p) => [p.id, p] as const))("%s reference solution type-checks", (_, p) => {
    const file = `/practice/${p.id}-solution.${LANGUAGES[p.language].ext}`;
    expect(diagnostics(file, p.solution)).toEqual([]);
  });
  it("still reports a genuine type error in learner code", () => {
    expect(diagnostics("/practice/check.ts", "const count: number = 'one';").length).toBe(1);
  });
});
