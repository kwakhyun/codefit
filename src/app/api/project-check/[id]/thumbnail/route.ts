import { z } from "zod";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError } from "@/lib/server/http";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await projectMember(request);
    const id = z.uuid().parse((await context.params).id);
    const check = await (await getStore()).queries.projectChecks.get(owner, id);
    if (!check) throw new HttpError(404, "프로젝트를 찾지 못했습니다.");
    const image = check.page.captures?.find((capture) => capture.screenshot)?.screenshot;
    return new Response(image ? Buffer.from(image, "base64") : null, {
      status: image ? 200 : 204,
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
