"use client";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { ToggleButton, Button, Card } from "@/components/ui/primitives";

import { configureMonaco } from "@/lib/editor/monaco-setup";

import { LANGUAGES, type Language } from "@/lib/catalog";
import Editor, { type OnMount } from "@monaco-editor/react";
import { AlignLeft, Code2, Redo2, Save, Undo2, WrapText } from "lucide-react";
import type { editor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";
export function CodeEditor({
  value,
  language,
  problemId,
  onChange,
  onCheck,
  onSave,
  fontSize = 14,
  focusRequest = 0,
}: {
  value: string;
  language: Language;
  problemId: string;
  onChange: (value: string) => void;
  onCheck: (value: string) => void;
  onSave?: () => void;
  fontSize?: number;
  focusRequest?: number;
}) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const onCheckRef = useRef(onCheck);
  const onSaveRef = useRef(onSave);
  const [editorNotice, setEditorNotice] = useState("");
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [wrap, setWrap] = useState(false);
  useEffect(() => {
    onCheckRef.current = onCheck;
    onSaveRef.current = onSave;
  }, [onCheck, onSave]);
  useEffect(() => {
    if (focusRequest && editorRef.current) {
      editorRef.current.layout();
      editorRef.current.focus();
    }
  }, [focusRequest]);
  const handleMount: OnMount = (mountedEditor, monaco) => {
    editorRef.current = mountedEditor;
    if (focusRequest) mountedEditor.focus();
    let preferredWrap = window.matchMedia("(max-width: 600px)").matches;
    try {
      const saved = localStorage.getItem("codefit-editor-wrap");
      if (saved !== null) preferredWrap = saved === "on";
    } catch {
      /* Use screen size if storage is unavailable. */
    }
    setWrap(preferredWrap);
    mountedEditor.getModel()?.updateOptions({
      bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false },
    });
    const command = mountedEditor.addAction({
      id: "recode.review",
      label: "AI 풀이 검토",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => onCheckRef.current(mountedEditor.getValue()),
    });
    const saveCommand = mountedEditor.addAction({
      id: "codefit.save",
      label: "지금 저장",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => onSaveRef.current?.(),
    });
    const listener = mountedEditor.onDidChangeCursorPosition(({ position }) =>
      setCursor({ line: position.lineNumber, column: position.column }),
    );
    mountedEditor.onDidDispose(() => {
      command.dispose();
      saveCommand.dispose();
      listener.dispose();
    });
  };
  return (
    <div className="code-editor">
      <div className="editor-filebar">
        <span>
          <Code2 size={15} />
          <strong>
            {language === "dockerfile" ? "Dockerfile" : "solution." + LANGUAGES[language].ext}
          </strong>
          <span className="file-dot" />
        </span>
        <div>
          <ToggleButton
            className={`icon-button ${wrap ? "active" : ""}`}
            aria-label="자동 줄바꿈"
            aria-pressed={wrap}
            onClick={() => {
              setWrap(!wrap);
              try {
                localStorage.setItem("codefit-editor-wrap", wrap ? "off" : "on");
              } catch {
                /* Session setting still works. */
              }
            }}
            title="자동 줄바꿈"
          >
            <WrapText size={16} />
          </ToggleButton>
          <Button
            className="icon-button"
            aria-label="실행 취소"
            title="실행 취소 (Ctrl / ⌘ Z)"
            onClick={() => {
              editorRef.current?.trigger("toolbar", "undo", null);
              editorRef.current?.focus();
            }}
          >
            <Undo2 size={16} />
          </Button>
          <Button
            className="icon-button"
            aria-label="다시 실행"
            title="다시 실행"
            onClick={() => {
              editorRef.current?.trigger("toolbar", "redo", null);
              editorRef.current?.focus();
            }}
          >
            <Redo2 size={16} />
          </Button>
          {onSave && (
            <Button
              className="icon-button"
              aria-label="지금 저장"
              title="지금 저장 (Ctrl / ⌘ S)"
              onClick={onSave}
            >
              <Save size={16} />
            </Button>
          )}
          <Button
            className="icon-button"
            aria-label="코드 정리"
            title="코드 정리 (지원 언어)"
            onClick={async () => {
              const action = editorRef.current?.getAction("editor.action.formatDocument");
              if (!action?.isSupported()) {
                setEditorNotice("이 언어는 자동 코드 정리를 지원하지 않습니다.");
                return;
              }
              try {
                await action.run();
                setEditorNotice("코드 정리를 완료했습니다.");
              } catch {
                setEditorNotice("코드를 정리하지 못했습니다. 문법을 확인해 주세요.");
              }
            }}
          >
            <AlignLeft size={16} />
          </Button>
        </div>
      </div>
      {editorNotice && (
        <Card as="div" className="editor-notice" role="status">
          <span>{editorNotice}</span>
          <Button aria-label="편집기 안내 닫기" onClick={() => setEditorNotice("")}>
            ×
          </Button>
        </Card>
      )}
      <div className="monaco-shell">
        <Editor
          height="100%"
          path={"file:///practice/" + problemId + "." + LANGUAGES[language].ext}
          language={LANGUAGES[language].monaco}
          value={value}
          theme="recode-terminal"
          beforeMount={configureMonaco}
          onMount={handleMount}
          onChange={(next) => onChange(next ?? "")}
          loading={
            <div className="editor-loading">
              <ScreenSkeleton variant="code" label="코드 편집기 준비 중…" />
            </div>
          }
          options={{
            ariaLabel: "문제 풀이 코드 편집기",
            automaticLayout: true,
            minimap: { enabled: false },
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
            fontSize,
            lineHeight: Math.round(fontSize * 1.8),
            padding: { top: 24, bottom: 24 },
            tabSize: 2,
            insertSpaces: true,
            scrollBeyondLastLine: false,
            wordWrap: wrap ? "on" : "off",
            cursorStyle: "block",
            cursorBlinking: "solid",
            fontLigatures: false,
            contextmenu: true,
            editContext: false,
            lineNumbersMinChars: 3,
            folding: true,
            glyphMargin: false,
            bracketPairColorization: { enabled: false },
            stickyScroll: { enabled: false },
            renderLineHighlight: "all",
            roundedSelection: false,
            fixedOverflowWidgets: true,
            formatOnPaste: false,
          }}
          saveViewState
        />
      </div>
      <div className="editor-statusbar">
        <span>
          {LANGUAGES[language].label}
          <span>UTF-8</span>
        </span>
        <span>
          줄 {cursor.line}, 열 {cursor.column}
          <span>공백: 2</span>
        </span>
      </div>
    </div>
  );
}
