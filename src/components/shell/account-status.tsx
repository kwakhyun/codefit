"use client";
import { Suspense, use } from "react";
import { usePathname } from "next/navigation";
import { LogIn, UserRound } from "lucide-react";
import { AppLink as Link } from "@/components/ui/primitives";

export type ShellAccount = { name: string } | null;

/** Signed-in state comes from the server session and streams in without blocking the page. */
export function AccountStatus({ account }: { account: Promise<ShellAccount> }) {
  return (
    <div className="sidebar-workspace" role="group" aria-label="현재 이용 상태">
      <Suspense
        fallback={
          <>
            <strong>이용 상태 확인 중</strong>
            <span className="sidebar-account-placeholder" aria-hidden="true" />
          </>
        }
      >
        <AccountDetails account={account} />
      </Suspense>
    </div>
  );
}
function AccountDetails({ account }: { account: Promise<ShellAccount> }) {
  const user = use(account);
  const pathname = usePathname();
  if (user)
    return (
      <>
        <strong>{user.name}</strong>
        <small>계정에 연결된 학습 기록</small>
        <Link className="workspace-login" href="/profile">
          <UserRound size={15} aria-hidden="true" />내 프로필
        </Link>
      </>
    );
  const returnTo = pathname === "/login" ? "" : `?returnTo=${encodeURIComponent(pathname)}`;
  return (
    <>
      <strong>로그인 없이 이용 중</strong>
      <small>로그인 없이도 학습 기록을 확인할 수 있어요.</small>
      <Link className="workspace-login" href={`/login${returnTo}`}>
        <LogIn size={15} aria-hidden="true" />
        로그인 / 가입
      </Link>
    </>
  );
}
