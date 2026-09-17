import type { Metadata } from "next";
import "./globals.css";
import { GuideWidget } from "@/components/guide/guide-widget";
export const metadata: Metadata = {
  applicationName: "CODE:FIT",
  title: "CODE:FIT — 서비스 원리부터 코드 이해까지",
  description:
    "예제 서비스로 개발 기초를 배우고, AI가 작성한 코드를 분석하고 수정해 보세요. 서비스 오류 해결 실습과 분야별 코딩 문제를 로그인 없이 이용할 수 있습니다.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <GuideWidget />
      </body>
    </html>
  );
}
