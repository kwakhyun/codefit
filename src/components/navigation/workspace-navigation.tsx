"use client";
import { usePathname } from "next/navigation";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { preferredDestinations } from "@/lib/learning-preference";
import { AppLink as Link } from "@/components/ui/primitives";
import { DomainIcon } from "@/components/ui/problem-badges";
import { DOMAINS, type DomainId } from "@/lib/catalog";
import type { LibraryView } from "@/lib/library-state";
import type { ProblemSummary } from "@/lib/problem";
import {
  ClipboardCheck,
  BookOpen,
  ShieldCheck,
  Bookmark,
  History,
  Home,
  LayoutGrid,
  Terminal,
  Workflow,
} from "lucide-react";

export function WorkspaceNavigation({
  initialProblemId,
  initialView = "library",
  initialDomain = "all",
  saved = 0,
  activeProblem,
}: {
  initialProblemId?: string;
  initialView?: LibraryView;
  initialDomain?: DomainId | "all";
  saved?: number;
  activeProblem?: ProblemSummary;
}) {
  const { preference, profile, type } = useLearningPreference();
  const pathname = usePathname();
  const isHome = pathname === "/";
  function current(href: string) {
    if (href === "/?view=browse") return isHome && initialView === "browse";
    if (href === "/learn") return pathname === "/learn";
    if (href === "/project-check")
      return pathname === "/project-check" || pathname === "/project-practice";
    return pathname === href || pathname.startsWith(href + "/");
  }
  return (
    <nav aria-label="작업 공간 메뉴">
      <span className="nav-caption">나의 연습실</span>
      <Link
        className={`nav-item ${isHome && !initialProblemId && initialView === "library" && initialDomain === "all" ? "active" : ""}`}
        aria-current={
          isHome && !initialProblemId && initialView === "library" && initialDomain === "all"
            ? "page"
            : undefined
        }
        href="/"
      >
        <Home size={17} />
        <span>홈</span>
      </Link>
      <Link
        className={`nav-item ${current("/projects") ? "active" : ""}`}
        aria-current={current("/projects") ? "page" : undefined}
        href="/projects"
      >
        <BookOpen size={17} />
        <span>내 프로젝트</span>
      </Link>
      {preferredDestinations(preference).map((item, index) => (
        <div key={item.href}>
          {(index === 0 || index === 2) && (
            <span className="nav-caption">{index === 0 ? profile.group : profile.secondary}</span>
          )}
          <Link
            className={`nav-item ${current(item.href) ? "active" : ""}`}
            aria-current={current(item.href) ? "page" : undefined}
            href={item.href}
            key={item.href}
          >
            {item.href === "/?view=browse" ? (
              <LayoutGrid size={17} aria-hidden="true" />
            ) : item.href === "/learn/ai" ? (
              <Workflow size={17} aria-hidden="true" />
            ) : item.href === "/learn" ? (
              <BookOpen size={17} />
            ) : item.href === "/handoff" ? (
              <Terminal size={17} />
            ) : item.href === "/security-check" ? (
              <ShieldCheck size={17} />
            ) : (
              <ClipboardCheck size={17} />
            )}
            <span>{item.label}</span>
          </Link>
          {type === "code" && index === 0 && (
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
                    className={`nav-item domain-nav ${initialDomain === d.id || activeProblem?.domain === d.id ? "domain-active" : ""}`}
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
      <Link
        className={`nav-item ${isHome && !initialProblemId && initialView === "bookmarks" ? "active" : ""}`}
        aria-current={isHome && initialView === "bookmarks" ? "page" : undefined}
        href="/?view=bookmarks"
      >
        <Bookmark size={17} />
        <span>북마크</span>
        {saved > 0 && <small>{saved}</small>}
      </Link>
      <Link
        className={`nav-item ${isHome && !initialProblemId && initialView === "history" ? "active" : ""}`}
        aria-current={isHome && initialView === "history" ? "page" : undefined}
        href="/?view=history"
      >
        <History size={17} />
        <span>내 학습 기록</span>
      </Link>
    </nav>
  );
}
