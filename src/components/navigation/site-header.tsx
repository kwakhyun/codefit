"use client";
import { ThemeSelect } from "@/components/theme/theme-select";
import { PreferenceChangeButton } from "@/components/library/learning-preference";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { preferredDestinations } from "@/lib/learning-preference";
import { AppLink as Link } from "@/components/ui/primitives";
import { usePathname } from "next/navigation";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { Menu, ArrowUpRight } from "lucide-react";
import { useRef, useState } from "react";

/** Shared destinations outside the editor; learning stages keep their own local navigation. */
export function SiteHeader() {
  const pathname = usePathname();
  const { preference } = useLearningPreference();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = [
    { href: "/", label: "홈" },
    ...preferredDestinations(preference),
    { href: "/projects", label: "내 프로젝트" },
    { href: "/?view=history", label: "내 기록" },
  ];
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function links(mobile = false) {
    return items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        onClick={mobile ? () => setOpen(false) : undefined}
        aria-current={
          (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) &&
          !(item.href === "/learn" && pathname.startsWith("/learn/ai"))
            ? "page"
            : undefined
        }
      >
        {item.label}
        {mobile && <ArrowUpRight size={18} aria-hidden="true" />}
      </Link>
    ));
  }
  return (
    <header className="site-header">
      <Link href="/" className="brand-logo" aria-label="CODE:FIT 홈">
        <BrandIcon />
        CODE:FIT_
      </Link>
      <ThemeSelect />
      <div className="site-preference">
        <PreferenceChangeButton />
      </div>
      <Button
        ref={trigger}
        className="site-menu-button secondary-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        <Menu size={20} aria-hidden="true" /> 메뉴
      </Button>
      <nav aria-label="서비스 메뉴" className="site-navigation">
        {links()}
      </nav>
      <Modal open={open} onClose={close} title="어디로 이동할까요?" className="site-menu-dialog">
        <nav aria-label="모바일 서비스 메뉴" className="site-menu-links">
          {links(true)}
        </nav>
        <div className="site-menu-preference">
          <PreferenceChangeButton />
        </div>
      </Modal>
    </header>
  );
}
