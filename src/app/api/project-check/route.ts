import { after } from "next/server";
import { publicCheck } from "@/lib/server/project-check-store";
import { projectMember } from "@/lib/server/project-member";
import { z } from "zod";
import { createCheckSchema, reviewCheckSchema } from "@/lib/project-check/types";
import { session } from "@/lib/server/session";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { getStore } from "@/lib/server/database";
import { networkIdentity } from "@/lib/server/usage-policy";
import { ProjectCheckService } from "@/lib/server/project-check-service";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    const { owner, scope, user } = await session(request);
    const store = await getStore();
    const params = new URL(request.url).searchParams;
    const search = z
      .string()
      .trim()
      .max(200)
      .parse(params.get("q") ?? "");
    const [usage, page] = await Promise.all([
      store.queries.projectChecks.usage(owner),
      store.queries.projectChecks.summaryPage(owner, params.get("cursor"), undefined, search),
    ]);
    return json({
      scope,
      signedIn: !!user,
      aiReady: Boolean(process.env.OPENAI_API_KEY),
      usage,
      ...page,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { owner } = await projectMember(request);
    const input = await readBody(request, createCheckSchema, 16_000);
    if (!process.env.OPENAI_API_KEY)
      throw new HttpError(503, "AI 연결을 준비 중입니다. 저장된 기록은 계속 볼 수 있습니다.");
    const service = new ProjectCheckService(await getStore());
    if (request.headers.get("prefer") === "respond-async") {
      const claim = await service.beginAnalysis(owner, input);
      if (claim.state === "done") return json(publicCheck(JSON.parse(claim.result)));
      if (claim.state === "new") {
        const network = networkIdentity(request);
        after(async () => {
          try {
            await service.create(owner, network, input, AbortSignal.timeout(110_000), claim.lease);
          } catch {
            // create marks the leased job failed; status polling reports it to its owner.
          }
        });
      }
      return json({ status: "pending", id: input.requestId }, 202);
    }
    return json(await service.create(owner, networkIdentity(request), input, request.signal));
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { owner } = await projectMember(request);
    const input = await readBody(request, reviewCheckSchema, 32_000);
    if (!process.env.OPENAI_API_KEY)
      throw new HttpError(503, "AI 연결을 준비 중입니다. 작성한 답변은 이 탭에 보관됩니다.");
    return json(
      await new ProjectCheckService(await getStore()).review(
        owner,
        networkIdentity(request),
        input,
        request.signal,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { owner } = await projectMember(request);
    const { id } = await readBody(request, z.object({ id: z.uuid() }).strict(), 500);
    await (await getStore()).queries.projectChecks.remove(owner, id);
    return json({ removed: true });
  } catch (error) {
    return failure(error);
  }
}
