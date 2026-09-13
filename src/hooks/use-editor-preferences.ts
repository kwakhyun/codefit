"use client";

import { useEffect, useState } from "react";

export function useEditorPreferences() {
  const [fontSize, setFontSize] = useState(14);
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const saved = Number(localStorage.getItem("recode-editor-font"));
        if (saved >= 12 && saved <= 20) setFontSize(saved);
      } catch {
        /* Keep the default if browser storage is unavailable. */
      }
    });
  }, []);
  function changeFontSize(size: number) {
    setFontSize(size);
    try {
      localStorage.setItem("recode-editor-font", String(size));
    } catch {
      /* Settings still work for this session. */
    }
  }
  return { fontSize, changeFontSize };
}
