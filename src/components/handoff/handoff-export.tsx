"use client";
import { Button, Status } from "@/components/ui/primitives";
import { useState } from "react";
import { handoffDocument } from "@/lib/handoff/document";
export function HandoffExport({ title, id, value }: { title: string; id: string; value: string }) {
  const [error, setError] = useState("");
  return (
    <div className="handoff-export">
      <Button
        className="text-button"
        onClick={() => {
          try {
            const url = URL.createObjectURL(
              new Blob([handoffDocument(title, value)], { type: "text/markdown;charset=utf-8" }),
            );
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${id}-handoff.md`;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setError("");
          } catch {
            setError("문서를 저장하지 못했습니다. 코드와 메모는 그대로 남아 있습니다.");
          }
        }}
      >
        인수인계 문서 저장 ↓
      </Button>
      <small>현재 코드와 메모를 Markdown 초안으로 저장합니다.</small>
      {error && <Status role="alert">{error}</Status>}
    </div>
  );
}
