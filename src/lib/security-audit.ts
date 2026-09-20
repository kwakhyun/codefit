import { z } from "zod";
export const securityAuditInput = z
  .object({
    url: z.string().min(1).max(1500),
    authorized: z.literal(true),
    token: z.string().max(2000).optional(),
  })
  .strict();
export type OwnershipChallenge = { token: string; fileUrl: string; expiresAt: string };
export type ProbeEvidence = {
  label: string;
  origin: string | null;
  status: number;
  allowOrigin: string;
  allowCredentials: string;
  vary: string;
};
export type CorsAudit = {
  url: string;
  checkedAt: string;
  ownershipVerified: true;
  status: "review" | "observed" | "unknown";
  summary: string;
  evidence: ProbeEvidence[];
  nextStep: string;
};
export function corsAuditText(report: CorsAudit) {
  return [
    "# 소유권 확인 후 CORS 응답 비교",
    report.url,
    report.checkedAt,
    "검사: 기본 GET, 임의 Origin GET, null Origin GET. 인증정보와 쿠키 없이 실행. 소유권 파일은 매 실행 확인. 읽은 본문과 쿠키 값은 보고서에 포함하지 않음.",
    report.summary,
    ...report.evidence.map(
      (e) =>
        `\n${e.label}\n요청: GET ${report.url}\nOrigin: ${e.origin ?? "전송 안 함"}\n응답 상태: ${e.status}\nAccess-Control-Allow-Origin: ${e.allowOrigin || "없음"}\nAccess-Control-Allow-Credentials: ${e.allowCredentials || "없음"}\nVary: ${e.vary || "없음"}`,
    ),
    `\n다음 확인: ${report.nextStep}`,
    "인증 후 민감한 응답을 읽을 수 있는지, 브라우저의 쿠키 정책과 엔드포인트별 권한은 별도 검증해야 합니다. 이 결과는 데이터 유출이나 전체 서비스 안전 여부를 확정하지 않습니다.",
  ].join("\n\n");
}
