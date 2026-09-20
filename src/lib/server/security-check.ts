import type { PublicDocument } from "./project-page";
import type { SecurityFinding, SecurityReport } from "../security-check";
export function inspectSecurity(document: PublicDocument): SecurityReport {
  const header = (name: string) => {
    const value = document.headers[name];
    return Array.isArray(value) ? value.join(", ") : value || "";
  };
  const csp = header("content-security-policy");
  // Only presence is observed. Do not claim that a policy is effective without browser validation.
  const markup = document.html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const metaCsp = /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["'\s>]/i.test(markup);
  const hsts = header("strict-transport-security");
  const maxAge = hsts.match(/(?:^|;)\s*max-age\s*=\s*(\d+)\s*(?:;|$)/i);
  const frame = csp
    .split(",")
    .some((policy) => policy.split(";").some((d) => /^\s*frame-ancestors\s+\S/i.test(d)));
  const xfo = /^(deny|sameorigin)$/i.test(header("x-frame-options").trim());
  const cookies = document.headers["set-cookie"] || [];
  const cookieList = Array.isArray(cookies) ? cookies : [cookies];
  const missingSecure = cookieList.filter((c) => !/;\s*secure\s*(?:;|$)/i.test(c)).length;
  const findings: SecurityFinding[] = [
    {
      id: "csp",
      title: "스크립트 실행 정책 (CSP)",
      status: csp ? "observed" : metaCsp ? "unknown" : "review",
      evidence: csp
        ? "최종 응답에 적용용 CSP 헤더가 있습니다. 정책 강도와 실제 적용 여부는 별도 확인이 필요합니다."
        : metaCsp
          ? "HTML에 CSP 메타 태그가 있습니다. 헤더와 적용 범위가 달라 브라우저 검증이 필요합니다."
          : "적용용 CSP 헤더와 HTML 메타 태그를 관찰하지 못했습니다. XSS 취약점을 발견했다는 뜻은 아닙니다.",
      action:
        "사용 중인 스크립트와 외부 연결을 확인하고, 테스트 환경에서 정책을 검증한 뒤 적용하세요. Report-Only는 차단 정책이 아닙니다.",
    },
    {
      id: "hsts",
      title: "HTTPS 유지 정책 (HSTS)",
      status: maxAge && Number(maxAge[1]) > 0 ? "observed" : "review",
      evidence:
        maxAge && Number(maxAge[1]) > 0
          ? "양수 max-age를 가진 HSTS 헤더가 있습니다. 최초 접속과 하위 도메인의 보장은 별도 확인이 필요합니다."
          : "유효한 양수 max-age를 가진 HSTS 헤더를 관찰하지 못했습니다. 현재 요청 자체는 HTTPS입니다.",
      action:
        "HTTPS 전환을 확인한 뒤 HSTS를 설정하세요. 하위 도메인을 포함하기 전 모든 하위 서비스가 HTTPS를 지원하는지 확인하세요.",
    },
    {
      id: "frame",
      title: "다른 사이트의 화면 삽입 제한",
      status: frame || xfo ? "observed" : "review",
      evidence:
        frame || xfo
          ? "frame-ancestors 지시문 또는 유효한 X-Frame-Options를 관찰했습니다. 허용 대상의 적절성은 확인하지 않았습니다."
          : "응답 헤더에서 화면 삽입 제한을 관찰하지 못했습니다. 실제 클릭재킹 공격은 실행하지 않았습니다.",
      action:
        "외부 사이트에 삽입되어야 하는 화면인지 확인하고 CSP frame-ancestors로 허용 대상을 제한하세요. 메타 태그의 frame-ancestors는 적용되지 않습니다.",
    },
    {
      id: "mime",
      title: "콘텐츠 형식 추측 제한",
      status:
        header("x-content-type-options").trim().toLowerCase() === "nosniff" ? "observed" : "review",
      evidence:
        header("x-content-type-options").trim().toLowerCase() === "nosniff"
          ? "X-Content-Type-Options: nosniff를 관찰했습니다."
          : "nosniff 응답 설정을 관찰하지 못했습니다.",
      action:
        "올바른 Content-Type과 nosniff를 함께 설정하고 업로드 파일과 정적 파일 응답에서도 확인하세요.",
    },
    {
      id: "cookie",
      title: "이번 응답에서 설정한 쿠키의 Secure 속성",
      status: !cookieList.length ? "unknown" : missingSecure ? "review" : "observed",
      evidence: !cookieList.length
        ? "이번 응답은 쿠키를 설정하지 않았습니다. 로그인 쿠키는 검사하지 못했습니다."
        : `${cookieList.length}개 쿠키 중 ${missingSecure}개에서 Secure 속성을 관찰하지 못했습니다. 쿠키 이름과 값은 결과에 포함하지 않습니다.`,
      action:
        "로그인 후 세션 쿠키의 Secure, HttpOnly, SameSite를 확인하세요. 자바스크립트가 읽어야 하는 쿠키와 인증 쿠키는 구별해야 합니다.",
    },
    {
      id: "authorization",
      title: "접근 권한과 데이터 노출",
      status: "unknown",
      evidence:
        "공개 페이지 1개의 응답으로 로그인 후 권한, 데이터베이스 정책, API의 사용자 구분을 검증할 수 없습니다.",
      action:
        "아래 모의해킹 준비 과제를 본인의 테스트 환경에서 수행하세요. 서버가 소유자와 현재 권한을 확인하는지 비교해야 합니다.",
    },
  ];
  return { url: document.url, checkedAt: document.fetchedAt, findings };
}
