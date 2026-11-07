import type { Metadata } from "next";
import { Home } from "lucide-react";
import { BackButton } from "@/components/shell/back-button";
import { AppLink as Link } from "@/components/ui/primitives";
import { siteTitle } from "@/lib/site";

// Root-level files sit beside the layout, so its title template does not reach them.
export const metadata: Metadata = {
  title: { absolute: siteTitle("페이지를 찾을 수 없습니다") },
  robots: { index: false },
};
export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="status-page">
      <span className="eyebrow">404</span>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>
        주소가 바뀌었거나 삭제된 페이지입니다. 입력한 주소를 확인하거나 아래에서 이어서 갈 곳을 골라
        주세요.
      </p>
      <div className="status-page-actions">
        <Link className="primary-button" href="/">
          <Home size={17} aria-hidden="true" />
          홈으로
        </Link>
        <Link className="secondary-button" href="/projects">
          내 프로젝트
        </Link>
        <BackButton />
      </div>
    </main>
  );
}
