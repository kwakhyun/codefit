import { PracticeApp, type LibraryView } from "@/components/practice-app";
import { DOMAIN_IDS, type DomainId } from "@/lib/catalog";
export default async function Home({ searchParams }: { searchParams: Promise<{ domain?: string; view?: string }> }) {
  const params = await searchParams;
  const domain = DOMAIN_IDS.includes(params.domain as DomainId) ? params.domain as DomainId : "all";
  const view: LibraryView = params.view === "bookmarks" || params.view === "history" ? params.view : "library";
  return <PracticeApp key={`${domain}:${view}`} initialDomain={domain} initialView={view} />;
}
