import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { accessSignature, equalSecret, session } from "@/lib/server/session";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { token, jar, secure } = await session(request, { login: true });
    const input = await readBody(request, z.object({ password: z.string().min(1).max(500) }), 3000);
    if (
      !(await (
        await getStore()
      ).consumeLimits([{ key: "login:global", max: 30, windowMs: 600_000 }]))
    )
      throw new HttpError(429, "로그인 시도가 많습니다. 10분 후 다시 시도해 주세요.");
    if (!process.env.LAB_ACCESS_TOKEN || !equalSecret(input.password, process.env.LAB_ACCESS_TOKEN))
      throw new HttpError(401, "접근 암호가 올바르지 않습니다.");
    jar.set("recode_access", accessSignature(token), {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 7 * 86400,
    });
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
