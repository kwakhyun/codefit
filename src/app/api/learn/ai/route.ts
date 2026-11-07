import { z } from "zod";
import { AI_LESSONS, type AiLessonId } from "@/lib/ai-learning/catalog";
import type { AiProgress } from "@/lib/ai-learning/progress";
import {
  aiProgressFromRows,
  isAiProgressRow,
  saveAiProgress,
  validAiProgress,
} from "@/lib/server/ai-learning-progress";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";

/** AI lesson progress for the current account or guest browser. */
export async function GET(request: Request) {
  try {
    const { owner, scope, user } = await session(request);
    const rows = await (await getStore()).queries.learning.all(owner);
    return json({
      scope,
      signedIn: !!user,
      lessons: aiProgressFromRows(rows.filter(isAiProgressRow)),
    });
  } catch (e) {
    return failure(e);
  }
}

/** Merges the sent lessons into the saved ones and returns the merged records. */
export async function PUT(request: Request) {
  try {
    const { owner, scope, user } = await session(request);
    const input = await readBody(
      request,
      z
        .object({
          lessons: z
            .record(z.string().max(60), z.unknown())
            .refine((value) => Object.keys(value).length <= AI_LESSONS.length),
        })
        .strict(),
      32_000,
    );
    const lessons: Partial<Record<AiLessonId, AiProgress>> = {};
    for (const [id, value] of Object.entries(input.lessons)) {
      const lesson = AI_LESSONS.find((item) => item.id === id);
      const record = lesson && validAiProgress(lesson.id, value);
      if (!lesson || !record) throw new HttpError(400, "AI 수업 기록 형식을 확인해 주세요.");
      lessons[lesson.id] = record;
    }
    const store = await getStore();
    return json({
      scope,
      signedIn: !!user,
      lessons: await saveAiProgress(store.queries.learning, owner, lessons),
    });
  } catch (e) {
    return failure(e);
  }
}
