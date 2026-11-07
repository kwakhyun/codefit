import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accountUser } from "@/lib/server/auth";
import { configuredProviders } from "@/lib/server/auth-config";
import { AccountShell } from "@/components/account/account-shell";
import { Profile } from "@/components/account/profile";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "내 프로필",
  description: "내 프로필과 학습 현황, 연결한 로그인 계정과 AI 이용 현황을 확인합니다.",
  robots: { index: false, follow: false },
};
export default async function ProfilePage() {
  const user = await accountUser(await headers());
  if (!user) redirect("/login?returnTo=%2Fprofile");
  return (
    <AccountShell>
      <Profile initialUser={user} providers={configuredProviders()} />
    </AccountShell>
  );
}
