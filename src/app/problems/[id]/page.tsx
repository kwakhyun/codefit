import { PracticeApp } from "@/components/practice-app";
import { safeReturnTo } from "@/lib/library-state";
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
