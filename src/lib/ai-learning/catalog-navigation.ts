import { AI_TRACKS } from "./catalog";
import type { LessonContext } from "./lesson-paths";

export function catalogFilters(params: { get(name: string): string | null }) {
  const track = params.get("track") || "all";
  const level = params.get("level") || "all";
  return {
    query: (params.get("q") || "").slice(0, 200),
    track: AI_TRACKS.some((item) => item.id === track) ? track : "all",
    level: ["입문", "기초", "응용"].includes(level) ? level : "all",
  };
}

export function catalogUrl(filters: ReturnType<typeof catalogFilters>) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.track !== "all") params.set("track", filters.track);
  if (filters.level !== "all") params.set("level", filters.level);
  return `/learn/ai${params.size ? `?${params}` : ""}`;
}

/** A return path that restores a search or level filter, not just an opened track. */
export function catalogReturnsToSearch(returnTo: string) {
  const filters = catalogFilters(new URLSearchParams(returnTo.split("?")[1] || ""));
  return filters.query !== "" || filters.level !== "all";
}

/** Accept only catalog filters (and the opened track), never an arbitrary redirect destination. */
export function catalogReturn(value: unknown): string {
  if (typeof value !== "string" || !/^\/learn\/ai(?:\?|$)/.test(value)) return "/learn/ai";
  return catalogUrl(catalogFilters(new URLSearchParams(value.split("?")[1] || "")));
}

/** Lesson link that returns to the catalog view and keeps the path or topic it belongs to. */
export function catalogLessonUrl(id: string, returnTo: string, context: LessonContext = {}) {
  const params = new URLSearchParams({ returnTo });
  if (context.lessons?.length) params.set("lessons", context.lessons.join(","));
  else if (context.path) params.set("path", context.path);
  return `/learn/ai/${id}?${params}`;
}
export const catalogScrollKey = (url: string) => `codefit:ai-catalog-scroll:${url}`;
