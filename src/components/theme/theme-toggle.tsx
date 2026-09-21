"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { resolved, setPreference } = useTheme();
  const dark = resolved === "dark";
  return (
    <Button
      className="icon-button theme-toggle"
      aria-label="다크 모드"
      aria-pressed={dark}
      title={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      onClick={() => setPreference(dark ? "light" : "dark")}
    >
      <Sun className="theme-sun" size={20} aria-hidden="true" />
      <Moon className="theme-moon" size={20} aria-hidden="true" />
    </Button>
  );
}
