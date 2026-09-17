import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  applicationName: "CODE:FIT",
  title: "CODE:FIT — 앱의 원리부터 코드 이해까지",
  description:
    "예제 앱으로 개발 기초를 배우고, AI가 작성한 코드를 분석하고 수정해 보세요. 앱 오류 해결 실습과 분야별 코딩 문제를 로그인 없이 이용할 수 있습니다.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
