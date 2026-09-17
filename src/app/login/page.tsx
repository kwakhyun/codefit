import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accountUser } from "@/lib/server/auth";
import { configuredProviders } from "@/lib/server/auth-config";
import { safeReturnTo } from "@/lib/auth-types";
import { AccountShell } from "@/components/account/account-shell";
import { ProviderButtons } from "@/components/account/provider-buttons";
export const metadata = { title: "로그인 | CODE:FIT" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  if (await accountUser(await headers())) redirect(returnTo);
  return (
    <AccountShell>
      <section className="auth-card">
        <div className="account-terminal-bar">
          <span /> <span /> <span />
          <small>CODEFIT / SIGN IN</small>
        </div>
        <div className="auth-card-content">
          <span className="eyebrow">YOUR NEXT REP</span>
          <h1>
            로그인하고
            <br />
            연습 기록을 이어가세요
          </h1>
          <p>
            Google 또는 GitHub로 로그인하면 하루 3회 AI 문제를 만들고,
            <br />
            다른 기기에서도 저장한 풀이를 이어서 볼 수 있습니다.
          </p>
          {params.error && (
            <p className="inline-error" role="alert">
              로그인을 완료하지 못했습니다. 다시 시도해 주세요. 이미 가입한 이메일이라면 처음 사용한
              Google 또는 GitHub 계정으로 로그인한 뒤 프로필에서 다른 계정을 연결하세요.
            </p>
          )}
          <ProviderButtons providers={configuredProviders()} returnTo={returnTo} />
          <p className="auth-privacy">
            이름과 이메일만으로 시작합니다. 저장소와 파일에 접근하지 않습니다.{" "}
            <Link href="/privacy">개인정보 안내</Link>
          </p>
        </div>
      </section>
      <div className="auth-public-note">
        <strong>문제부터 풀어 보고 싶다면</strong>
        <p>문제 풀이, 힌트, 정답 확인, AI 풀이 검토는 로그인 없이 이용할 수 있습니다.</p>
        <Link href="/" className="text-button">
          로그인 없이 연습하기 →
        </Link>
      </div>
    </AccountShell>
  );
}
