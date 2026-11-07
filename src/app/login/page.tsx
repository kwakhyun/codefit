import { Card, Status } from "@/components/ui/primitives";
import { SectionArtwork } from "@/components/experience/section-artwork";
import { AppLink as Link } from "@/components/ui/primitives";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accountUser } from "@/lib/server/auth";
import { configuredProviders } from "@/lib/server/auth-config";
import { safeReturnTo } from "@/lib/auth-types";
import { AccountShell } from "@/components/account/account-shell";
import { ProviderButtons } from "@/components/account/provider-buttons";
import { allowanceWindow, guestAllowance, memberAllowance, type AiFeature } from "@/lib/ai-access";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "로그인",
  description:
    "Google 또는 GitHub로 로그인하고 풀이와 프로젝트 기록을 계정에 저장하세요. 로그인하면 AI 이용 횟수가 늘어납니다.",
};
const benefits: [feature: AiFeature, label: string][] = [
  ["generate", "AI 문제 생성"],
  ["review", "AI 풀이 검토"],
  ["analysis", "프로젝트 분석 횟수"],
  ["projectReview", "프로젝트 평가 횟수"],
];
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const requestHeaders = await headers();
  if (await accountUser(requestHeaders)) redirect(returnTo);
  const localPreview = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestHeaders.get("host") || "");
  return (
    <AccountShell>
      <Card as="section" className="auth-card">
        <div className="account-terminal-bar">
          <span /> <span /> <span />
          <small>CODEFIT / SIGN IN</small>
        </div>
        <Card as="div" className="auth-card-content">
          <SectionArtwork topic="progress" className="auth-artwork" eager />
          <span className="eyebrow">계정 연결</span>
          <h1>
            로그인하고
            <br />
            연습 기록을 이어가세요
          </h1>
          <p>
            Google 또는 GitHub로 로그인하면 저장한 풀이와 프로젝트 기록을 다른 기기에서도 이어서 볼
            수 있고, AI 이용 횟수가 늘어납니다.
          </p>
          <ul className="auth-benefits" aria-label="로그인 전후 AI 이용 횟수">
            {benefits.map(([feature, label]) => (
              <li key={feature}>
                <strong>{label}</strong>
                <span>
                  {allowanceWindow(feature)} 기준 로그인 없이 {guestAllowance(feature)}회
                </span>
                <span className="auth-benefit-member">로그인하면 {memberAllowance(feature)}회</span>
              </li>
            ))}
          </ul>
          {params.error && (
            <Status className="inline-error" role="alert">
              로그인을 완료하지 못했습니다. 다시 시도해 주세요. 이미 가입한 이메일이라면 처음 사용한
              Google 또는 GitHub 계정으로 로그인한 뒤 프로필에서 다른 계정을 연결하세요.
            </Status>
          )}
          <ProviderButtons
            providers={configuredProviders()}
            returnTo={returnTo}
            localPreview={localPreview}
          />
          <p className="auth-privacy">
            로그인 전 기록은 계정으로 자동으로 합쳐지지 않습니다. 옮기려면 로그인하기 전에 환경
            설정의 ‘내 학습 기록 내보내기’로 파일을 저장하고, 로그인한 뒤 ‘백업 가져오기’를
            이용하세요.
          </p>
          <p className="auth-privacy">
            이름과 이메일만으로 시작합니다. 저장소와 파일에 접근하지 않습니다.{" "}
            <Link href="/privacy">개인정보 안내</Link>
          </p>
        </Card>
      </Card>
      <div className="auth-public-note">
        <strong>문제부터 풀어 보고 싶다면</strong>
        <p>
          모든 기능을 로그인 없이 이용할 수 있습니다. AI 기능은 위의 ‘로그인 없이’ 횟수만큼 체험해
          보세요.
        </p>
        <Link href="/" className="text-button">
          로그인 없이 연습하기 →
        </Link>
      </div>
    </AccountShell>
  );
}
