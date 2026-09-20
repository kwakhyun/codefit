import { AppLink as Link } from "@/components/ui/primitives";
import { z } from "zod";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { missionById } from "@/lib/learn/catalog";
import { MissionLoader } from "@/components/learn/mission-loader";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const m = missionById((await params).id);
  return { title: m ? `${m.title} | CODE:FIT` : "미션을 찾을 수 없습니다." };
}
export default async function MissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const m = missionById((await params).id);
  if (!m) notFound();
  const project = z.uuid().safeParse((await searchParams).project);
  return (
    <>
      {project.success && (
        <nav className="training-return" aria-label="프로젝트 학습으로 돌아가기">
          <Link href={`/project-check?check=${project.data}#training`}>
            ← 실습을 마치면 프로젝트 확인 문제로 돌아가기
          </Link>
        </nav>
      )}
      <MissionLoader mission={m} />
    </>
  );
}
