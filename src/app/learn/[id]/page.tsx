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
export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const m = missionById((await params).id);
  if (!m) notFound();
  return <MissionLoader mission={m} />;
}
