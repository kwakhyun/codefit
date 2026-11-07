"use client";
import { Suspense, type Ref } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleHelp, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PreferenceChangeButton } from "@/components/library/learning-preference";
import { AppLink as Link, Button } from "@/components/ui/primitives";
import { BrandIcon } from "@/components/ui/brand-icon";
import { locationTrail } from "@/lib/shell-location";

interface AppHeaderProps {
  menuOpen: boolean;
  menuTrigger: Ref<HTMLButtonElement>;
  onOpenMenu: () => void;
  onHelp: () => void;
  actionsSlot: Ref<HTMLDivElement>;
}
/** The one header for every route. It sits outside <main> so the skip link passes it. */
export function AppHeader({
  menuOpen,
  menuTrigger,
  onOpenMenu,
  onHelp,
  actionsSlot,
}: AppHeaderProps) {
  return (
    <header className="topbar app-header">
      <div className="topbar-path">
        <Button
          ref={menuTrigger}
          className="mobile-menu icon-button"
          aria-label="메뉴 열기"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={(event) => {
            // Safari does not focus buttons on pointer activation; retain a dialog return target.
            event.currentTarget.focus();
            onOpenMenu();
          }}
        >
          <Menu size={21} aria-hidden="true" />
        </Button>
        <Suspense fallback={<Breadcrumb params={new URLSearchParams()} />}>
          <SearchAwareBreadcrumb />
        </Suspense>
      </div>
      <div className="topbar-actions">
        <PreferenceChangeButton />
        <ThemeToggle />
        <Button
          className="icon-button help-button header-help"
          aria-label="사용 안내"
          aria-haspopup="dialog"
          title="사용 안내 (?)"
          onClick={(event) => {
            event.currentTarget.focus();
            onHelp();
          }}
        >
          <CircleHelp size={18} aria-hidden="true" />
        </Button>
        <div className="header-page-actions" ref={actionsSlot} />
      </div>
    </header>
  );
}
function SearchAwareBreadcrumb() {
  return <Breadcrumb params={useSearchParams()} />;
}
function Breadcrumb({ params }: { params: URLSearchParams }) {
  const trail = locationTrail(usePathname(), params);
  return (
    <nav className="topbar-breadcrumb" aria-label="현재 위치">
      <ol>
        <li>
          <Link className="path-root" href="/" aria-label="CODE:FIT 홈">
            <BrandIcon size={30} />
            <span>CODE:FIT</span>
          </Link>
        </li>
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={crumb.label} className={last ? "is-current" : undefined}>
              <span className="crumb-separator" aria-hidden="true">
                /
              </span>
              {last || !crumb.href ? (
                <span aria-current={last ? "page" : undefined}>{crumb.label}</span>
              ) : (
                <Link href={crumb.href}>{crumb.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
