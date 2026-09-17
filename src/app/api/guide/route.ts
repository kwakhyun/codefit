import { guideInputSchema } from "@/lib/guide";
import { askGuide } from "@/lib/server/ai-guide";
import { basicGuide } from "@/lib/server/guide-catalog";
import { getStore } from "@/lib/server/database";
import { failure, json, readBody } from "@/lib/server/http";
import { session } from "@/lib/server/session";
import { networkIdentity } from "@/lib/server/usage-policy";

export const runtime = "nodejs";
export const maxDuration = 40;

export async function GET(request: Request) {
  try {
    const { scope } = await session(request);
    return json({ scope, aiReady: Boolean(process.env.OPENAI_API_KEY) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { owner, scope } = await session(request);
    // A scoped GET precedes chat so account switches cannot send another user's conversation.
    if (request.headers.get("x-codefit-workspace") !== scope)
      return json({ error: "연습실이 변경되었습니다. 가이드를 다시 열어 주세요." }, 409);
    const input = await readBody(request, guideInputSchema, 12_000);
    if (input.mode === "basic") return json(basicGuide(input.profile));
    if (!process.env.OPENAI_API_KEY)
      return json(
        basicGuide(input.profile, "AI 연결이 준비되지 않아 선택한 답변을 기준으로 추천했어요."),
      );
    const store = await getStore();
    const network = networkIdentity(request);
    const allowed = await store.consumeLimits([
      { key: `guide:burst:${owner}`, max: 3, windowMs: 60_000 },
      { key: `guide:owner:${owner}`, max: 12, windowMs: 86_400_000 },
      { key: `guide:network:${network}`, max: 40, windowMs: 86_400_000 },
      { key: "ai:global:hour", max: 40, windowMs: 3_600_000 },
      { key: "ai:global:day", max: 100, windowMs: 86_400_000 },
    ]);
    if (!allowed)
      return json(
        basicGuide(
          input.profile,
          "지금은 AI 이용 한도에 도달했어요. 선택한 답변을 기준으로 추천을 이어갈게요.",
        ),
      );
    try {
      return json(
        await askGuide(input, request.signal, (run) => store.queries.recordAiRun(owner, run)),
      );
    } catch {
      // Do not retry paid requests automatically or expose provider errors / user text.
      return json(
        basicGuide(
          input.profile,
          "AI 답변을 받지 못했어요. 선택한 답변에 맞는 기본 추천을 먼저 보여드릴게요.",
        ),
      );
    }
  } catch (error) {
    return failure(error);
  }
}
