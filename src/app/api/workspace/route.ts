import { problemDetail } from "@/lib/server/problem-detail";
import { getStore } from "@/lib/server/database";
import { failure, json, readBody } from "@/lib/server/http";
import { session } from "@/lib/server/session";
import { z } from "zod";
import { configuredProviders } from "@/lib/server/auth-config";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner, user, scope } = await session(request);
    const store = await getStore();
    const params = new URL(request.url).searchParams;
    const id = params.get("problem");
    const libraryHref = params.get("library");
    const [legacyValue, workspace, bootstrap] = await Promise.all([
      store.legacy(owner),
      store.queries.workspace(owner, id),
      params.get("include") === "initial"
        ? id
          ? problemDetail(store, owner, id, params.get("attempt")).then((detail) => ({ detail }))
          : libraryHref?.startsWith("/")
            ? store.queries
                .library(owner, new URLSearchParams(libraryHref.split("?")[1] || ""))
                .then((value) => ({ library: { href: libraryHref, value } }))
            : undefined
        : undefined,
    ]);
    const legacy = legacyValue as { generatedLessons?: unknown[] } | null;
    return json({
      ...workspace,
      ...(bootstrap && { bootstrap }),
      account: { user, providers: configuredProviders() },
      scope,
      aiReady: Boolean(process.env.OPENAI_API_KEY),
      storage: "서버 저장소",
      legacyCount: legacy?.generatedLessons?.length || 0,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { owner } = await session(request);
    const legacy = await readBody(
      request,
      z.object({ generatedLessons: z.array(z.unknown()).max(1000) }).passthrough(),
      5_000_000,
    );
    await (await getStore()).archiveLegacy(owner, legacy);
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
