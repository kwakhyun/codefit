"use client";
import { useEffect } from "react";
import { applyStoredTheme, themeInitScript } from "@/lib/theme-init";
import { siteTitle } from "@/lib/site";
import "./globals.css";
import { fontVariables } from "./fonts";

/** Replaces the root layout when it fails, so it brings its own document, styles and theme. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    applyStoredTheme();
    console.error(error);
  }, [error]);
  return (
    <html lang="ko" className={fontVariables} suppressHydrationWarning>
      <head>
        <title>{siteTitle("오류가 발생했습니다")}</title>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <main id="main-content" tabIndex={-1} className="status-page global-status-page">
          <span className="eyebrow">CODE:FIT</span>
          <h1>서비스를 표시하지 못했습니다</h1>
          <p>
            일시적인 문제로 화면을 불러오지 못했습니다. 다시 시도하거나 잠시 후 새로고침해 주세요.
          </p>
          {error.digest && <p className="muted">오류 번호: {error.digest}</p>}
          <div className="status-page-actions">
            <button type="button" className="ui-button primary-button" onClick={() => retry()}>
              다시 시도
            </button>
            {/* A full page load recovers even when client navigation is unavailable. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="ui-link secondary-button" href="/">
              홈으로
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
