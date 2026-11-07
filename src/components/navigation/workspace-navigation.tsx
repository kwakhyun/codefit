"use client";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { navigationGroups } from "@/lib/learning-preference";
import { navCurrent } from "@/lib/shell-location";
import { AppLink as Link } from "@/components/ui/primitives";
import { DomainIcon } from "@/components/ui/problem-badges";
import { DOMAINS } from "@/lib/catalog";
import type { NavInfo } from "@/components/shell/shell-context";
import {
  Bookmark,
  BookOpen,
  ClipboardCheck,
  FolderKanban,
  History,
  Home,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "/project-check": ClipboardCheck,
  "/security-check": ShieldCheck,
  "/learn/ai": Workflow,
  "/learn/ai/project": Sparkles,
  "/handoff": Terminal,
  "/?view=browse": LayoutGrid,
  "/learn": BookOpen,
};
const emptyParams = new URLSearchParams();

/** The one product menu for every screen. Search params are read under a Suspense boundary. */
export function WorkspaceNavigation({ navInfo = {} }: { navInfo?: NavInfo }) {
  return (
    <Suspense fallback={<NavigationLinks navInfo={navInfo} params={emptyParams} />}>
      <SearchAwareNavigation navInfo={navInfo} />
    </Suspense>
  );
}
function SearchAwareNavigation({ navInfo }: { navInfo: NavInfo }) {
  const params = useSearchParams();
  return <NavigationLinks navInfo={navInfo} params={params} />;
}
function NavigationLinks({ navInfo, params }: { navInfo: NavInfo; params: URLSearchParams }) {
  const { preference, type } = useLearningPreference();
  const pathname = usePathname();
  function item(href: string, label: string, Icon: LucideIcon, badge?: number) {
    const current = navCurrent(href, pathname, params);
    return (
      <Link
        className={`nav-item ${current === "page" ? "active" : current ? "is-section" : ""}`}
        aria-current={current}
        href={href}
        key={href}
      >
        <Icon size={17} aria-hidden="true" />
        <span>{label}</span>
        {Boolean(badge) && <small>{badge}</small>}
      </Link>
    );
  }
  const domain = pathname === "/" ? params.get("domain") : null;
  return (
    <nav aria-label="작업 공간 메뉴">
      <span className="nav-caption">나의 연습실</span>
      {item("/", "홈", Home)}
      {item("/projects", "내 프로젝트", FolderKanban)}
      {navigationGroups(preference).map((group) => (
        <div key={group.id} className="nav-group">
          <span className="nav-caption">{group.caption}</span>
          {group.items.map((destination) => (
            <div key={destination.href}>
              {item(destination.href, destination.label, icons[destination.href] || BookOpen)}
              {type === "code" && destination.href === "/?view=browse" && (
                <section
                  className="domain-list code-priority-domains"
                  aria-label="분야별 코딩 연습 바로가기"
                >
                  <h2 className="nav-caption">바로 풀기</h2>
                  <div>
                    {DOMAINS.map((d) => (
                      <Link
                        key={d.id}
                        href={`/?domain=${d.id}`}
                        aria-current={domain === d.id ? "page" : undefined}
                        className={`nav-item domain-nav ${domain === d.id || navInfo.activeDomain === d.id ? "domain-active" : ""}`}
                      >
                        <DomainIcon domain={d.id} />
                        <span>{d.label}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ))}
        </div>
      ))}
      <span className="nav-caption">내 기록</span>
      {item("/?view=bookmarks", "북마크", Bookmark, navInfo.bookmarked)}
      {item("/?view=history", "내 학습 기록", History)}
    </nav>
  );
}
