import { PracticeApp, type LibraryView } from "@/components/practice-app";
import { DOMAIN_IDS, type DomainId } from "@/lib/catalog";
import { readFilters } from "@/lib/library-state";
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = readFilters(new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
  const domain = DOMAIN_IDS.includes(params.domain as DomainId) ? params.domain as DomainId : "all";
  const view: LibraryView = params.view === "bookmarks" || params.view === "history" ? params.view : "library";
  return <PracticeApp key={`${domain}:${view}`} initialDomain={domain} initialView={view} initialFilters={filters} />;
}
