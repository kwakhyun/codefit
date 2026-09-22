import { AnalysisActivity } from "@/components/project-check/analysis-activity";
import { DesktopFrame } from "@/components/navigation/desktop-frame";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { themeInitScript } from "@/lib/theme-init";
import { RouteFeedback } from "@/components/ui/route-feedback";
import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { GuideWidget } from "@/components/guide/guide-widget";
export const metadata: Metadata = {
  applicationName: "CODE:FIT",
  title: "CODE:FIT — AI를 배우고, 코드를 이해하고, 서비스를 검증하다",
  description:
    "서비스 점검실, AI 워크숍, 코딩 트레이닝. 내 프로젝트를 점검하고, AI 실무를 배우고, 분야별 코딩 문제를 연습하세요. 로그인 없이 시작할 수 있습니다.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <DesktopFrame>{children}</DesktopFrame>
          <GuideWidget />
          <Suspense fallback={null}>
            <AnalysisActivity />
          </Suspense>
          <Suspense fallback={null}>
            <RouteFeedback />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
