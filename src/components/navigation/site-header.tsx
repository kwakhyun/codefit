"use client";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { preferredDestinations } from "@/lib/learning-preference";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandIcon } from "@/components/ui/brand-icon";

/** Shared destinations outside the editor; learning stages keep their own local navigation. */
export function SiteHeader() {
  const pathname = usePathname();
  const { preference } = useLearningPreference();
  return (
    <header className="site-header">
      <Link href="/" className="brand-logo" aria-label="CODE:FIT 홈">
        <BrandIcon />
        CODE:FIT_
      </Link>
      <nav aria-label="서비스 메뉴" className="site-navigation">
        <Link href="/">홈</Link>
        {preferredDestinations(preference).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/?view=history">내 기록</Link>
      </nav>
    </header>
  );
}
