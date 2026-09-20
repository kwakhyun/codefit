import { DOMAIN_IDS, KINDS, LANGUAGES, LEVELS } from "./catalog";
export interface LibraryFilters {
  search: string;
  level: string;
  kind: string;
  language: string;
  source: string;
  status: string;
  sort: string;
  page: number;
}
export const defaultFilters: LibraryFilters = {
  search: "",
  level: "all",
  kind: "all",
  language: "all",
  source: "all",
  status: "all",
  sort: "recommended",
  page: 1,
};
export function readFilters(params: URLSearchParams): LibraryFilters {
  const choice = (key: string, choices: readonly string[], fallback = "all") =>
    choices.includes(params.get(key) || "") ? params.get(key)! : fallback;
  const page = Number(params.get("page") || 1);
  return {
    search: (params.get("q") || "").slice(0, 200),
    level: choice("level", LEVELS),
    kind: choice("kind", KINDS),
    language: choice("language", Object.keys(LANGUAGES)),
    source: choice("source", ["curated", "ai"]),
    status: choice("status", ["new", "in-progress", "solved"]),
    sort: choice("sort", ["recommended", "newest", "easy", "short"], "recommended"),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}
export function libraryUrl(filters: LibraryFilters, domain = "all", view = "library") {
  const params = new URLSearchParams();
  if (DOMAIN_IDS.includes(domain as (typeof DOMAIN_IDS)[number])) params.set("domain", domain);
  if (["bookmarks", "history", "browse"].includes(view)) params.set("view", view);
  for (const [key, value] of Object.entries(filters)) {
    if (value !== defaultFilters[key as keyof LibraryFilters])
      params.set(key === "search" ? "q" : key, String(value));
  }
  return params.size ? `/?${params}` : "/";
}
export function safeReturnTo(value?: unknown) {
  if (value === "/handoff") return value;
  if (typeof value !== "string" || (value !== "/" && !value.startsWith("/?"))) return "/";
  const params = new URLSearchParams(value.slice(2));
  return libraryUrl(
    readFilters(params),
    params.get("domain") || "all",
    params.get("view") || "library",
  );
}
export function problemUrl(id: string, returnTo: string, attempt?: string) {
  const params = new URLSearchParams({ from: safeReturnTo(returnTo) });
  if (attempt) params.set("attempt", attempt);
  return `/problems/${encodeURIComponent(id)}?${params}`;
}

export type LibraryView = "library" | "bookmarks" | "history" | "browse";
