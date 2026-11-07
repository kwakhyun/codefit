import { AnalysisActivity } from "@/components/project-check/analysis-activity";
import { AppShell } from "@/components/shell/app-shell";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { RouteFeedback } from "@/components/ui/route-feedback";
import { GuideWidget } from "@/components/guide/guide-widget";
import { LearningPreferenceSeed } from "@/hooks/use-learning-preference";
import { preferenceSeed, WORKSPACE_COOKIE } from "@/lib/learning-preference";
import { shellAccount } from "@/lib/server/shell-account";
import { SITE_NAME, siteOrigin, TITLE_TEMPLATE } from "@/lib/site";
import { themeInitScript } from "@/lib/theme-init";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";

const description =
  "서비스 점검실, AI 워크숍, 코딩 트레이닝. 내 프로젝트를 점검하고, AI 실무를 배우고, 분야별 코딩 문제를 연습하세요. 로그인 없이 시작할 수 있습니다.";
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} — AI를 배우고, 코드를 이해하고, 서비스를 검증하다`,
    template: TITLE_TEMPLATE,
  },
  description,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "ko_KR", description },
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1219" },
  ],
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  // The menu order matches the browser's workspace choice on the first paint.
  const seed = preferenceSeed(jar.get(WORKSPACE_COOKIE)?.value);
  // Streams into the sidebar; the page does not wait for the session lookup.
  const account = shellAccount(requestHeaders).catch(() => null);
  return (
    <html lang="ko" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <LearningPreferenceSeed value={seed}>
            <ToastProvider>
              <AppShell account={account}>{children}</AppShell>
              <GuideWidget />
              <Suspense fallback={null}>
                <AnalysisActivity />
              </Suspense>
              <Suspense fallback={null}>
                <RouteFeedback />
              </Suspense>
            </ToastProvider>
          </LearningPreferenceSeed>
        </ThemeProvider>
      </body>
    </html>
  );
}
