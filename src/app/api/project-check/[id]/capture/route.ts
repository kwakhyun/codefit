import { z } from "zod";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await projectMember(request);
    const id = (await context.params).id;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(400, "점검 기록 주소가 올바르지 않습니다.");
    const parsedIndex = z.coerce
      .number()
      .int()
      .min(0)
      .max(2)
      .safeParse(new URL(request.url).searchParams.get("index"));
    if (!parsedIndex.success) throw new HttpError(400, "화면 번호가 올바르지 않습니다.");
    const index = parsedIndex.data;
    const check = await (await getStore()).queries.projectChecks.get(owner, id);
    const image = check?.page.captures?.[index]?.screenshot;
    if (!image) throw new HttpError(404, "이 계정에서 화면 기록을 찾지 못했습니다.");
    return new Response(Buffer.from(image, "base64"), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
