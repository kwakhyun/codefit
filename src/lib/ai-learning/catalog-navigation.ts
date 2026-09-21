import { AI_TRACKS } from "./catalog";

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

/** Accept only catalog filters, never an arbitrary redirect destination. */
export function catalogReturn(value: unknown): string {
  if (typeof value !== "string" || !/^\/learn\/ai(?:\?|$)/.test(value)) return "/learn/ai";
  return catalogUrl(catalogFilters(new URLSearchParams(value.split("?")[1] || "")));
}

export function catalogLessonUrl(id: string, returnTo: string) {
  return `/learn/ai/${id}?${new URLSearchParams({ returnTo })}`;
}
export const catalogScrollKey = (url: string) => `codefit:ai-catalog-scroll:${url}`;
