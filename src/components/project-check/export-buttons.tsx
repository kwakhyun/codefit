"use client";
import { useId } from "react";
import { Button } from "@/components/ui/primitives";
import { downloadFile } from "@/lib/project-check/download";

/** One export control: Markdown for notes and AI tools, plain text for anything else. */
export function ExportButtons({
  label,
  fileName,
  markdown,
  text,
  note,
  disabled = false,
}: {
  label: string;
  /** File name without an extension. */
  fileName: string;
  markdown: () => string;
  text: () => string;
  /** e.g. that unsaved drafts are included. */
  note?: string;
  disabled?: boolean;
}) {
  const noteId = useId();
  return (
    <div className="export-buttons" role="group" aria-label={label}>
      <span className="export-buttons-label">{label}</span>
      <Button
        className="secondary-button"
        disabled={disabled}
        aria-describedby={note ? noteId : undefined}
        onClick={() => downloadFile(`${fileName}.md`, markdown(), "text/markdown")}
      >
        Markdown으로 저장
      </Button>
      <Button
        className="text-button"
        disabled={disabled}
        aria-describedby={note ? noteId : undefined}
        onClick={() => downloadFile(`${fileName}.txt`, text())}
      >
        텍스트로 저장
      </Button>
      {note && (
        <small id={noteId} className="project-help">
          {note}
        </small>
      )}
    </div>
  );
}
