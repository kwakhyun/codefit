"use client";

import Link from "next/link";
import { DOMAIN_IDS, LANGUAGES } from "@/lib/catalog";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <span className="mono">&gt; CODE:FIT / KEEP YOUR SKILLS SHARP.</span>
      <Link href="/quality">AI 검토 방식과 검증 결과</Link>
      <span>
        {DOMAIN_IDS.length}개 분야<span>/</span>
        {Object.keys(LANGUAGES).length}개 언어와 기술
      </span>
    </footer>
  );
}
