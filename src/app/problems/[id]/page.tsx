import type { Metadata } from "next";
import { PracticeApp } from "@/components/practice-app";
import { seedProblems } from "@/data/problems";
import { safeReturnTo } from "@/lib/library-state";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // Built-in problems are known without a database read; generated ones keep a general title.
  const { id } = await params;
  const problem = seedProblems.find((item) => item.id === id);
  return problem
    ? { title: problem.title, description: problem.summary }
    : {
        title: "문제 풀이",
        description: "AI가 만든 코딩 문제를 풀고, 작성한 코드로 AI 풀이 검토를 받아 보세요.",
      };
}
export default async function ProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; attempt?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <PracticeApp
      initialProblemId={id}
      returnTo={safeReturnTo(query.from)}
      initialAttemptId={typeof query.attempt === "string" ? query.attempt.slice(0, 100) : undefined}
    />
  );
}
