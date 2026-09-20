import { SiteHeader } from "@/components/navigation/site-header";
import { SecurityCheck } from "@/components/security/security-check";
export const metadata = {
  title: "서비스 보안 점검 | CODE:FIT",
  description:
    "AI로 만든 서비스의 공개 보안 설정을 확인하고 모의해킹에 앞서 검증할 항목을 준비합니다.",
};
export default function SecurityPage() {
  return (
    <main id="main-content" className="learn-page">
      <SiteHeader />
      <section className="learn-intro">
        <span className="eyebrow">배포 전에 확인하는 보안 기본 설정</span>
        <h1>
          AI로 만든 서비스,
          <br />
          보안도 확인했나요?
        </h1>
        <p>
          링크를 넣으면 공개 페이지의 보안 설정과 보완할 부분을 확인합니다.
          <br />각 결과에 관찰 근거와 AI 코딩 도구에 요청할 다음 행동을 제공합니다.
        </p>
        <p>
          이 기능은 모의해킹의 사전 점검입니다. 공격 요청이나 로그인은 실행하지 않으며, API 권한이나
          데이터베이스 취약점을 자동 검증하지 않습니다. AI 추측 대신 응답에서 확인한 규칙으로
          판정합니다.
        </p>
      </section>
      <SecurityCheck />
      <p className="muted">
        판정 기준:{" "}
        <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy">
          MDN CSP
        </a>
        ,{" "}
        <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security">
          MDN HSTS
        </a>
        . 주소, 점검 결과와 메모는 현재 탭에 계정별로 임시 보관되어 실습에서 돌아오거나 새로고침해도
        복원됩니다. 다른 탭이나 기기에 동기화되지 않으며, 영구 보관하려면 확인 기록을 파일로
        저장하세요.
      </p>
    </main>
  );
}
