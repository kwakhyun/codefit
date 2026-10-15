import { getStore } from "@/lib/server/database";
import { failure, HttpError, json } from "@/lib/server/http";
import { session } from "@/lib/server/session";
import { BACKUP_MAX_PARTS } from "@/lib/backup-bundle";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    const { owner } = await session(request);
    const store = await getStore();
    const params = new URL(request.url).searchParams;
    if (params.has("part")) {
      const parsed = z
        .object({
          part: z.coerce
            .number()
            .int()
            .min(0)
            .max(BACKUP_MAX_PARTS - 1),
          exportedAt: z.iso.datetime(),
          snapshot: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
        })
        .safeParse({
          part: params.get("part"),
          exportedAt: params.get("exportedAt") ?? new Date().toISOString(),
          snapshot: params.get("snapshot") ?? undefined,
        });
      if (
        !parsed.success ||
        (parsed.data.part > 0 && (!params.has("exportedAt") || !parsed.data.snapshot))
      )
        throw new HttpError(400, "백업 조각 주소가 올바르지 않습니다. 처음부터 다시 내보내세요.");
      const { part, exportedAt, snapshot } = parsed.data;
      const result = await store.exportBackupParts(owner, exportedAt);
      if (snapshot && snapshot !== result.manifest.id)
        throw new HttpError(
          409,
          "내보내는 동안 기록이 변경되었습니다. 일부만 내려받지 않았습니다. 다시 내보내 주세요.",
        );
      if (!result.parts[part]) throw new HttpError(404, "백업 조각을 찾지 못했습니다.");
      return json({
        exportedAt,
        manifest: result.manifest,
        index: part,
        backup: result.parts[part],
      });
    }
    const data = await store.exportBackup(owner);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="codefit-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
