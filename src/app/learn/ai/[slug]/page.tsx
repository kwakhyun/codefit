import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/navigation/site-header";
import { AiLesson } from "@/components/ai-learning/ai-lesson";
import { aiLessonById, AI_LESSONS } from "@/lib/ai-learning/catalog";
import { AI_CONTENT } from "@/lib/ai-learning/content";

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
    title: lesson ? `${lesson.title} | CODE:FIT` : "수업을 찾을 수 없습니다 | CODE:FIT",
    description: lesson?.summary,
  };
}
export default async function AiLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = aiLessonById((await params).slug);
  if (!lesson) notFound();
  return (
    <main id="main-content" className="learn-page ai-learning-page">
      <SiteHeader />
      <AiLesson key={lesson.id} id={lesson.id} content={AI_CONTENT[lesson.id]} />
    </main>
  );
}
