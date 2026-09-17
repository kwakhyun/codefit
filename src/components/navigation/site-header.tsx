"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandIcon } from "@/components/ui/brand-icon";

/** Shared destinations outside the editor; learning stages keep their own local navigation. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <Link href="/" className="brand-logo" aria-label="CODE:FIT 홈">
        <BrandIcon />
        CODE:FIT_
      </Link>
      <nav aria-label="서비스 메뉴" className="site-navigation">
        <Link href="/">홈</Link>
        <Link href="/learn" aria-current={pathname.startsWith("/learn") ? "page" : undefined}>
          서비스 원리
        </Link>
        <Link href="/handoff" aria-current={pathname === "/handoff" ? "page" : undefined}>
          코드 분석
        </Link>
        <Link
          href="/project-check"
          aria-current={pathname === "/project-check" ? "page" : undefined}
        >
          내 프로젝트
        </Link>
        <Link href="/?view=history">내 기록</Link>
      </nav>
    </header>
  );
}
