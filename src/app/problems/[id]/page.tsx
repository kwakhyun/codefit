import { PracticeApp } from "@/components/practice-app";
export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PracticeApp initialProblemId={id} />;
}
