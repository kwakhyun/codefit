import { Anchor } from "@/components/ui/primitives";
import { VisualIntro } from "@/components/experience/visual-intro";
import { ExperienceJourney } from "@/components/experience/experience-journey";
import { SiteHeader } from "@/components/navigation/site-header";
import { SecurityCheck } from "@/components/security/security-check";
export const metadata = {
  title: "서비스 보안 점검 | CODE:FIT",
  description:
    "공개 보안 설정과 소유한 주소의 CORS 응답을 확인하고 ZAP 보고서를 수정과 재검사 기록으로 정리합니다.",
};
export default function SecurityPage() {
  return (
    <main id="main-content" className="learn-page">
      <SiteHeader />
      <VisualIntro topic="security" className="learn-intro">
        <span className="eyebrow">공개 설정부터 실제 응답 비교까지</span>
        <h1>서비스 보안 점검</h1>
        <p>
          공개 설정을 확인하고, 소유권을 검증한 주소에서 CORS 응답을 비교하세요. ZAP 보고서를 가져와
          수정과 재검사 기록으로 이어갈 수 있습니다.
        </p>
      </VisualIntro>
      <ExperienceJourney topic="security" />
      <SecurityCheck />
      <p className="muted">
        판정 기준:{" "}
        <Anchor href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy">
          MDN CSP
        </Anchor>
        ,{" "}
        <Anchor href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security">
          MDN HSTS
        </Anchor>
        . 기본 검사의 주소, 점검 결과와 메모는 현재 탭에 계정별로 임시 보관되어 실습에서 돌아오거나
        새로고침해도 복원됩니다. 다른 탭이나 기기에 동기화되지 않으며, 영구 보관하려면 확인 기록을
        파일로 저장하세요. CORS 테스트와 ZAP 가져오기 결과는 현재 화면에만 남습니다.
      </p>
    </main>
  );
}
