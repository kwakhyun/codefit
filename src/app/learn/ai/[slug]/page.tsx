import { catalogReturn } from "@/lib/ai-learning/catalog-navigation";
import { AppLink } from "@/components/ui/primitives";
import { z } from "zod";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiLesson } from "@/components/ai-learning/ai-lesson";
import { aiLessonById, AI_LESSONS } from "@/lib/ai-learning/catalog";
import { AI_CONTENT } from "@/lib/ai-learning/content";
import { lessonContext } from "@/lib/ai-learning/lesson-paths";

export function generateStaticParams() {
  return AI_LESSONS.map((lesson) => ({ slug: lesson.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const lesson = aiLessonById((await params).slug);
  return {
    title: lesson ? lesson.title : "수업을 찾을 수 없습니다",
    description: lesson?.summary,
  };
}
export default async function AiLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    project?: string;
    topic?: string;
    returnTo?: string;
    path?: string;
    lessons?: string;
  }>;
}) {
  const query = await searchParams;
  const project = z.uuid().safeParse(query.project);
  const topic = /^[0-5]$/.test(query.topic || "") ? `&topic=${query.topic}` : "";
  const lesson = aiLessonById((await params).slug);
  if (!lesson) notFound();
  const context = lessonContext({
    get: (name) => {
      const value = query[name as "path" | "lessons"];
      return typeof value === "string" ? value : null;
    },
  });
  // Topic lessons only apply when the lesson was opened from a project workshop topic.
  const scoped = project.success ? context : { path: context.path };
  return (
    <main id="main-content" className="learn-page ai-learning-page">
      {project.success && (
        <aside className="project-ai-return">
          <p>이 수업을 마치면 내 프로젝트의 적용 계획과 확인 기록을 이어서 작성하세요.</p>
          <AppLink href={`/learn/ai/project?check=${project.data}${topic}`}>
            내 프로젝트 AI 워크숍으로 돌아가기 →
          </AppLink>
        </aside>
      )}
      <AiLesson
        key={lesson.id}
        id={lesson.id}
        content={AI_CONTENT[lesson.id]}
        returnTo={catalogReturn(query.returnTo)}
        projectQuery={project.success ? `project=${project.data}${topic}` : undefined}
        context={scoped}
      />
      {project.success && (
        <AppLink
          className="project-ai-return"
          href={`/learn/ai/project?check=${project.data}${topic}`}
        >
          배운 내용을 내 프로젝트에 적용해 보기 →
        </AppLink>
      )}
    </main>
  );
}
