import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  applicationName: "CODE:FIT",
  title: "CODE:FIT — AI 시대의 코딩 근력",
  description:
    "AI가 코드를 짜도, 내 실력은 녹슬지 않게. AI 코드의 결과를 예상하고 직접 실행해 보세요. 코드 분석, 수정, 응용 훈련과 AI 질문으로 이해하는 힘을 기르세요.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
