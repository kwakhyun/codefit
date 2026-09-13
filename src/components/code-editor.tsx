"use client";
import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";
import { AlignLeft, WrapText, Code2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { LANGUAGES, type Language } from "@/lib/catalog";
loader.config({ paths: { vs: "/monaco/vs" } });
const REACT_EDITOR_TYPES = [
  "declare namespace JSX {",
  "  interface IntrinsicElements {",
  "    [elementName: string]: any;",
  "  }",
  "}",
  "",
  "declare module \"react\" {",
  "  export type ReactNode = unknown;",
  "  export type SetStateAction<S> = S | ((previous: S) => S);",
  "  export type Dispatch<A> = (value: A) => void;",
  "  export interface SyntheticEvent<T = Element> {",
  "    currentTarget: T;",
  "    preventDefault(): void;",
  "  }",
  "  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}",
  "  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> {",
  "    target: T;",
  "  }",
  "  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];",
  "  export function useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void;",
  "  export function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;",
  "  export function useCallback<T extends (...args: any[]) => any>(callback: T, dependencies: readonly unknown[]): T;",
  "  export function useRef<T>(initial: T): { current: T };",
  "  export function useReducer<R extends (state: any, action: any) => any>(",
  "    reducer: R,",
  "    initialState: Parameters<R>[0],",
  "  ): [ReturnType<R>, Dispatch<Parameters<R>[1]>];",
  "  export function useId(): string;",
  "  export function useDeferredValue<T>(value: T): T;",
  "}",
  "",
  "declare module \"react/jsx-runtime\" {",
  "  export const Fragment: any;",
  "  export function jsx(type: any, props: any, key?: any): any;",
  "  export function jsxs(type: any, props: any, key?: any): any;",
  "}",
].join("\n");

let isMonacoConfigured = false;
function configureMonaco(monaco: Parameters<BeforeMount>[0]) {
  if (isMonacoConfigured) return;
  isMonacoConfigured = true;

  monaco.editor.defineTheme("recode-terminal", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "D4D4D4", background: "000000" },
      { token: "comment", foreground: "808080", fontStyle: "italic" },
      { token: "keyword", foreground: "93C5FD" },
      { token: "string", foreground: "A7D7B8" },
      { token: "number", foreground: "F2C879" },
      { token: "type", foreground: "C4B5FD" },
      { token: "identifier", foreground: "D4D4D4" },
      { token: "delimiter", foreground: "A0A0A0" },
      { token: "tag", foreground: "93C5FD" },
      { token: "attribute.name", foreground: "C4B5FD" },
      { token: "attribute.value", foreground: "A7D7B8" },
      { token: "invalid", foreground: "FF9A9A", fontStyle: "underline" },
    ],
    colors: {
      "focusBorder": "#93C5FD",
      "foreground": "#D4D4D4",
      "editor.background": "#000000",
      "editor.foreground": "#D4D4D4",
      "editorLineNumber.foreground": "#707070",
      "editorLineNumber.activeForeground": "#FFFFFF",
      "editorCursor.foreground": "#FFFFFF",
      "editorCursor.background": "#000000",
      "editor.selectionBackground": "#244363",
      "editor.inactiveSelectionBackground": "#333333",
      "editor.selectionHighlightBackground": "#40404080",
      "editor.selectionHighlightBorder": "#707070",
      "editor.wordHighlightBackground": "#40404080",
      "editor.wordHighlightStrongBackground": "#50505080",
      "editor.findMatchBackground": "#66502D",
      "editor.findMatchHighlightBackground": "#3C321E",
      "editor.lineHighlightBackground": "#101010",
      "editorIndentGuide.background1": "#242424",
      "editorIndentGuide.activeBackground1": "#606060",
      "editorBracketMatch.background": "#404040",
      "editorBracketMatch.border": "#A0A0A0",
      "editorBracketHighlight.foreground1": "#D4D4D4",
      "editorBracketHighlight.foreground2": "#D4D4D4",
      "editorBracketHighlight.foreground3": "#D4D4D4",
      "editorBracketHighlight.foreground4": "#D4D4D4",
      "editorBracketHighlight.foreground5": "#D4D4D4",
      "editorBracketHighlight.foreground6": "#D4D4D4",
      "editorBracketHighlight.unexpectedBracket.foreground": "#FF9A9A",
      "editorGutter.background": "#000000",
      "editorWidget.background": "#141414",
      "editorWidget.border": "#606060",
      "editorWidget.foreground": "#D4D4D4",
      "editorSuggestWidget.background": "#141414",
      "editorSuggestWidget.border": "#606060",
      "editorSuggestWidget.foreground": "#D4D4D4",
      "editorSuggestWidget.selectedBackground": "#404040",
      "editorSuggestWidget.highlightForeground": "#FFFFFF",
      "editorSuggestWidget.focusHighlightForeground": "#FFFFFF",
      "editorHoverWidget.background": "#141414",
      "editorHoverWidget.border": "#606060",
      "editorHoverWidget.foreground": "#D4D4D4",
      "editorHoverWidget.statusBarBackground": "#242424",
      "editorError.foreground": "#FF9A9A",
      "editorWarning.foreground": "#F2C879",
      "editorInfo.foreground": "#93C5FD",
      "editorOverviewRuler.errorForeground": "#FF9A9A",
      "editorOverviewRuler.warningForeground": "#F2C879",
      "editorOverviewRuler.infoForeground": "#93C5FD",
      "input.background": "#080808",
      "input.foreground": "#D4D4D4",
      "input.border": "#606060",
      "inputOption.activeBackground": "#404040",
      "inputOption.activeBorder": "#A0A0A0",
      "inputOption.activeForeground": "#FFFFFF",
      "inputValidation.errorBackground": "#211314",
      "inputValidation.errorBorder": "#FF9A9A",
      "list.activeSelectionBackground": "#404040",
      "list.activeSelectionForeground": "#FFFFFF",
      "list.focusBackground": "#404040",
      "list.focusForeground": "#FFFFFF",
      "list.focusOutline": "#A0A0A0",
      "list.highlightForeground": "#FFFFFF",
      "list.hoverBackground": "#242424",
      "list.hoverForeground": "#FFFFFF",
      "textLink.foreground": "#93C5FD",
      "textLink.activeForeground": "#BFDBFE",
      "scrollbarSlider.background": "#80808045",
      "scrollbarSlider.hoverBackground": "#A0A0A070",
      "scrollbarSlider.activeBackground": "#C0C0C090",
    },
  });

  const sharedCompilerOptions = {
    allowNonTsExtensions: true,
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution:
      monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  };

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    ...sharedCompilerOptions,
    allowJs: true,
    checkJs: false,
  });
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    ...sharedCompilerOptions,
    strict: true,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  });
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    REACT_EDITOR_TYPES,
    "file:///node_modules/@types/react/index.d.ts",
  );
}


export function CodeEditor({ value, language, problemId, onChange, onCheck, fontSize = 14 }: {
  value: string; language: Language; problemId: string; onChange: (value: string) => void;
  onCheck: (value: string) => void; fontSize?: number;
}) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const onCheckRef = useRef(onCheck);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [wrap, setWrap] = useState(false);
  useEffect(() => { onCheckRef.current = onCheck; }, [onCheck]);
  const handleMount: OnMount = (mountedEditor, monaco) => {
    editorRef.current = mountedEditor;
    mountedEditor.getModel()?.updateOptions({
      bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false },
    });
    const command = mountedEditor.addAction({ id: "recode.review", label: "AI 풀이 검토", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => onCheckRef.current(mountedEditor.getValue()) });
    const listener = mountedEditor.onDidChangeCursorPosition(({ position }) => setCursor({ line: position.lineNumber, column: position.column }));
    mountedEditor.onDidDispose(() => { command.dispose(); listener.dispose(); });
  };
  return <div className="code-editor">
    <div className="editor-filebar"><span><Code2 size={15} /><strong>{language === "dockerfile" ? "Dockerfile" : "solution." + LANGUAGES[language].ext}</strong><span className="file-dot" /></span><div>
      <button className={`icon-button ${wrap ? "active" : ""}`} aria-label="자동 줄바꿈" aria-pressed={wrap} onClick={() => setWrap(!wrap)} title="자동 줄바꿈"><WrapText size={16} /></button>
      <button className="icon-button" aria-label="코드 정리" title="코드 정리 (지원 언어)" onClick={() => editorRef.current?.getAction("editor.action.formatDocument")?.run()}><AlignLeft size={16} /></button>
    </div></div>
    <div className="monaco-shell"><Editor height="100%" path={"file:///practice/" + problemId + "." + LANGUAGES[language].ext}
      language={LANGUAGES[language].monaco} value={value} theme="recode-terminal" beforeMount={configureMonaco} onMount={handleMount}
      onChange={next => onChange(next ?? "")} loading={<div className="editor-loading"><span className="blink">▋</span> 코드 편집기 준비 중…</div>}
      options={{ ariaLabel: "문제 풀이 코드 편집기", automaticLayout: true, minimap: { enabled: false }, fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
        fontSize, lineHeight: Math.round(fontSize * 1.8), padding: { top: 24, bottom: 24 }, tabSize: 2, insertSpaces: true, scrollBeyondLastLine: false,
        wordWrap: wrap ? "on" : "off", cursorStyle: "block", cursorBlinking: "solid", fontLigatures: false, contextmenu: true, editContext: false,
        lineNumbersMinChars: 3, folding: true, glyphMargin: false, bracketPairColorization: { enabled: false }, stickyScroll: { enabled: false },
        renderLineHighlight: "all", roundedSelection: false, fixedOverflowWidgets: true, formatOnPaste: false,
      }} saveViewState />
    </div>
    <div className="editor-statusbar"><span>{LANGUAGES[language].label}<span>UTF-8</span></span><span>줄 {cursor.line}, 열 {cursor.column}<span>공백: 2</span></span></div>
  </div>;
}
