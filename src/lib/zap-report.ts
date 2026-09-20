import { z } from "zod";
const string = z.string().max(30000);
const zapSchema = z.object({
  site: z
    .array(
      z.object({
        "@name": z.string().max(2000),
        alerts: z
          .array(
            z.object({
              pluginid: z.union([z.string(), z.number()]),
              alert: string.optional(),
              name: string.optional(),
              riskcode: z.union([z.string(), z.number()]),
              confidence: z.union([z.string(), z.number()]).optional(),
              desc: string.optional(),
              solution: string.optional(),
              instances: z
                .array(
                  z.object({ uri: z.string().max(4000), method: z.string().max(20).optional() }),
                )
                .max(1000)
                .optional(),
            }),
          )
          .max(200),
      }),
    )
    .max(20),
});
export type ZapFinding = {
  id: string;
  title: string;
  risk: number;
  confidence: string;
  description: string;
  solution: string;
  locations: string[];
};
const plain = (s = "") =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|lt|gt|amp|quot);/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
function origin(raw: string) {
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("보고서 주소를 확인해 주세요.");
  return url.origin;
}
export function parseZapReport(text: string, target: string): ZapFinding[] {
  if (new TextEncoder().encode(text).length > 4_000_000)
    throw new Error("보고서는 4MB 이하로 내보내 주세요.");
  const wanted = origin(target);
  const parsed = zapSchema.safeParse(JSON.parse(text));
  if (!parsed.success)
    throw new Error(
      "ZAP Traditional JSON 보고서 형식을 확인해 주세요. 최대 20개 사이트, 사이트당 200개 알림을 지원합니다.",
    );
  const sites = parsed.data.site.filter((site) => {
    try {
      return origin(site["@name"]) === wanted;
    } catch {
      return false;
    }
  });
  if (!sites.length)
    throw new Error("입력한 서비스 주소와 같은 Origin의 결과가 보고서에 없습니다.");
  const findings = new Map<string, ZapFinding>();
  for (const site of sites)
    for (const alert of site.alerts) {
      const id = String(alert.pluginid);
      if (!/^\d{1,10}$/.test(id)) throw new Error("지원하지 않는 ZAP 규칙 번호입니다.");
      const risk = Number(alert.riskcode);
      if (!Number.isInteger(risk) || risk < 0 || risk > 3)
        throw new Error("보고서의 위험도 값을 확인해 주세요.");
      const locations = (alert.instances || []).flatMap((i) => {
        try {
          const url = new URL(i.uri);
          return url.origin === wanted && !url.username && !url.password
            ? [
                `${/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(i.method || "") ? i.method : "HTTP"} ${url.origin}${url.pathname}`,
              ]
            : [];
        } catch {
          return [];
        }
      });
      const existing = findings.get(id);
      findings.set(id, {
        id,
        title: plain(alert.alert || alert.name || `ZAP ${id}`),
        risk: Math.max(risk, existing?.risk ?? 0),
        confidence: String(alert.confidence ?? "미기록"),
        description: plain(alert.desc),
        solution: plain(alert.solution),
        locations: [...new Set([...(existing?.locations || []), ...locations])].slice(0, 20),
      });
    }
  return [...findings.values()].sort((a, b) => b.risk - a.risk);
}
export function zapReviewText(target: string, findings: ZapFinding[]) {
  return [
    `# ZAP 보고서 검토`,
    `대상: ${origin(target)}`,
    "업로드한 외부 보고서의 요약입니다. 코드핏이 ZAP을 실행하거나 알림을 재검증한 결과가 아닙니다. URI 쿼리, 공격 문자열, 요청/응답 원문은 제외했습니다. 남은 경로와 설명에도 개인정보가 있는지 공유 전 확인하세요.",
    ...findings.map(
      (f) =>
        `\n## ${f.title} (${["정보", "낮음", "중간", "높음"][f.risk]})\nZAP 규칙: ${f.id} / 신뢰도 코드: ${f.confidence}\n${f.description}\n위치: ${f.locations.join(", ") || "기록 없음"}\n수정 방향: ${f.solution || "원본 보고서를 확인하세요."}\n재현 조건: [작성]\n수정 전 결과: [작성]\n수정 후 재검사 결과: [작성]\n오탐 또는 미해결 사유: [작성]`,
    ),
    "\nAI 수정 요청: 위 알림을 코드와 대조하고 실제로 해당하는지 먼저 확인하세요. 원인을 입증하지 못하면 미확인으로 남겨 주세요. 최소 변경과 회귀 테스트를 제시하고 같은 검사 도구로 변경 후 재검사하세요.",
  ].join("\n\n");
}
