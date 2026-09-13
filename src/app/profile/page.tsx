import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accountUser } from "@/lib/server/auth";
import { configuredProviders } from "@/lib/server/auth-config";
import { AccountShell } from "@/components/account/account-shell";
import { Profile } from "@/components/account/profile";
export const metadata = { title: "내 프로필 | CODE:FIT", robots: { index: false, follow: false } };
export default async function ProfilePage() {
  const user = await accountUser(await headers());
  if (!user) redirect("/login?returnTo=%2Fprofile");
  return (
    <AccountShell>
      <Profile initialUser={user} providers={configuredProviders()} />
    </AccountShell>
  );
}
