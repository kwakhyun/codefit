import { AI_LESSONS, type AiLessonId } from "./catalog";
import type { AiProgressMap } from "./progress";

/** Recommended lesson orders shown on the catalog. Links carry `?path=<id>`. */
export const AI_PATHS = [
  {
    id: "beginner",
    title: "처음이라면",
    description: "맥락 전달부터 도구 연결까지",
    ids: ["prompt-context", "agent-workflow", "langchain", "langgraph"],
  },
  {
    id: "local",
    title: "내 컴퓨터에서 써보고 싶다면",
    description: "설치 준비부터 채팅 화면까지",
    ids: ["local-start", "local-connect", "local-ui"],
  },
  {
    id: "rag",
    title: "내 문서로 답하는 AI를 만든다면",
    description: "검색부터 답변 평가까지",
    ids: ["llamaindex", "vector-search", "rag-eval"],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  description: string;
  ids: readonly AiLessonId[];
}[];
export type AiPathId = (typeof AI_PATHS)[number]["id"];

/**
 * Where a lesson was opened from: a recommended path (`?path=`), or a project workshop topic
 * whose linked lessons arrive as `?lessons=a,b` next to `project` and `topic`.
 */
export type LessonContext = { path?: AiPathId; lessons?: AiLessonId[] };
const isLessonId = (id: string): id is AiLessonId => AI_LESSONS.some((lesson) => lesson.id === id);

export function lessonContext(params: { get(name: string): string | null }): LessonContext {
  const path = AI_PATHS.find((item) => item.id === params.get("path"))?.id;
  const lessons = [...new Set((params.get("lessons") || "").split(","))]
    .filter(isLessonId)
    .slice(0, 6);
  return lessons.length ? { lessons } : path ? { path } : {};
}

export type NextLesson = {
  lesson?: (typeof AI_LESSONS)[number];
  /** Which order chose the lesson. */
  via?: "path" | "topic" | "track" | "catalog";
  /** The path or topic the lesson was opened from ends here. */
  finished?: "path" | "topic";
};
/** The first unfinished lesson after `id` in `order`, else simply the next one. */
function after(id: AiLessonId, order: readonly AiLessonId[], records: AiProgressMap) {
  const rest = order.slice(order.indexOf(id) + 1);
  return rest.find((item) => !records[item]?.completed) ?? rest[0];
}
const lessonById = (id: AiLessonId | undefined) => AI_LESSONS.find((lesson) => lesson.id === id);

/**
 * Next lesson within the context the learner came from. A workshop topic ends at its own
 * lessons; a finished path, or no context, continues in the same track, then catalog order.
 */
export function nextLesson(
  id: AiLessonId,
  context: LessonContext = {},
  records: AiProgressMap = {},
): NextLesson {
  if (context.lessons?.includes(id)) {
    const next = after(id, context.lessons, records);
    return next ? { lesson: lessonById(next), via: "topic" } : { finished: "topic" };
  }
  const path = AI_PATHS.find((item) => item.id === context.path);
  let finished: NextLesson["finished"];
  if (path && (path.ids as readonly AiLessonId[]).includes(id)) {
    const next = after(id, path.ids, records);
    if (next) return { lesson: lessonById(next), via: "path" };
    finished = "path";
  }
  const current = AI_LESSONS.find((lesson) => lesson.id === id)!;
  const track = after(
    id,
    AI_LESSONS.filter((lesson) => lesson.track === current.track).map((lesson) => lesson.id),
    records,
  );
  if (track) return { lesson: lessonById(track), via: "track", finished };
  const catalog = after(
    id,
    AI_LESSONS.map((lesson) => lesson.id),
    records,
  );
  return catalog ? { lesson: lessonById(catalog), via: "catalog", finished } : { finished };
}
