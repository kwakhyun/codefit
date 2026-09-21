"use client";

import { useTheme, type ThemePreference } from "./theme-provider";

export function ThemeSelect() {
  const { preference, setPreference } = useTheme();
  return (
    <label className="theme-select">
      <span>화면 테마</span>
      <select
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
      >
        <option value="system">시스템 설정</option>
        <option value="light">라이트</option>
        <option value="dark">다크</option>
      </select>
    </label>
  );
}
