import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  applicationName: "CODE:FIT",
  title: "CODE:FIT — AI 시대의 코딩 근력",
  description:
    "AI가 코드를 짜도, 내 실력은 녹슬지 않게. 기능 구현, 버그 수정, 리팩터링 문제를 직접 풀고 힌트와 AI 피드백으로 코딩 근력을 단련하세요.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
