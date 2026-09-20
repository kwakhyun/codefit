import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { get } from "node:https";
import { publicUrl, resolvePublic } from "./project-page";
import { HttpError } from "./http";
import type { CorsAudit, OwnershipChallenge, ProbeEvidence } from "../security-audit";
const FILE = "/.well-known/codefit-security.txt";
function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value || value.length < 32)
    throw new HttpError(503, "소유권 확인 설정이 준비되지 않았습니다.");
  return value;
}
const ownerId = (owner: string) => createHash("sha256").update(owner).digest("hex");
const sign = (body: string) =>
  createHmac("sha256", secret()).update(`codefit-security-v1:${body}`).digest("base64url");
export function createOwnershipChallenge(
  raw: string,
  owner: string,
  now = Date.now(),
): OwnershipChallenge {
  const origin = publicUrl(raw).origin;
  const expires = now + 3600_000;
  const body = Buffer.from(
    JSON.stringify({
      origin,
      owner: ownerId(owner),
      expires,
      nonce: randomBytes(24).toString("hex"),
    }),
  ).toString("base64url");
  return {
    token: `${body}.${sign(body)}`,
    fileUrl: `${origin}${FILE}`,
    expiresAt: new Date(expires).toISOString(),
  };
}
export function validateOwnershipToken(
  token: string,
  raw: string,
  owner: string,
  now = Date.now(),
) {
  const parts = token.split(".");
  if (parts.length !== 2 || token.length > 2000)
    throw new HttpError(403, "소유권 확인 파일을 다시 발급해 주세요.");
  const expected = Buffer.from(sign(parts[0]));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new HttpError(403, "소유권 확인 서명이 맞지 않습니다.");
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new HttpError(403, "소유권 확인 파일을 다시 발급해 주세요.");
  }
  if (
    payload.origin !== publicUrl(raw).origin ||
    payload.owner !== ownerId(owner) ||
    !Number.isSafeInteger(payload.expires) ||
    payload.expires <= now ||
    payload.expires > now + 3600_000
  )
    throw new HttpError(
      403,
      "다른 계정이나 주소의 확인 파일이거나 유효 시간이 지났습니다. 다시 발급해 주세요.",
    );
  return `${payload.origin}${FILE}`;
}
export type ProbeResponse = { status: number; body: string; headers: Record<string, string> };
/** Single pinned TLS connection, no redirects, cookies, auth, subresources or arbitrary headers. */
export async function readSecurityProbe(
  raw: string,
  origin: string | null,
  parent: AbortSignal,
): Promise<ProbeResponse> {
  const url = publicUrl(raw);
  if (origin !== null && origin !== "null" && !/^https:\/\/[a-f0-9]{32}\.invalid$/.test(origin))
    throw new HttpError(400, "지원하지 않는 검사 Origin입니다.");
  const signal = AbortSignal.any([parent, AbortSignal.timeout(6000)]);
  const address = await resolvePublic(url.hostname, signal);
  return new Promise((resolve, reject) => {
    const req = get(
      url,
      {
        signal,
        agent: false,
        family: 4,
        lookup: (_host, _options, callback) => callback(null, address, 4),
        headers: {
          "User-Agent": "Codefit-OwnedSecurityCheck/1.0",
          "Accept-Encoding": "identity",
          ...(origin !== null ? { Origin: origin } : {}),
        },
      },
      (res) => {
        const headers: Record<string, string> = {};
        for (const key of [
          "access-control-allow-origin",
          "access-control-allow-credentials",
          "vary",
        ]) {
          const value = res.headers[key];
          headers[key] = (Array.isArray(value) ? value.join(", ") : value || "").slice(0, 400);
        }
        // Non-challenge response bodies are never retained or returned.
        if (url.pathname !== FILE) {
          resolve({ status: res.statusCode || 0, body: "", headers });
          res.destroy();
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 4096) {
            reject(new HttpError(422, "확인 파일이 너무 큽니다. 발급한 내용만 저장해 주세요."));
            res.destroy();
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers,
          }),
        );
        res.on("error", reject);
        res.on("aborted", () => reject(new HttpError(422, "확인 파일 읽기가 중단됐습니다.")));
      },
    );
    req.on("error", () =>
      reject(
        new HttpError(
          422,
          "검사 대상 응답을 받지 못했습니다. 공개 HTTPS 주소와 연결 상태를 확인하세요.",
        ),
      ),
    );
  });
}
export function interpretCors(url: string, evidence: ProbeEvidence[]): CorsAudit {
  const reflected = evidence.slice(1).filter((e) => e.allowOrigin === e.origin);
  const risky = reflected.some((e) => e.allowCredentials === "true");
  const unreliable = evidence.some((e) => e.status < 200 || e.status >= 300);
  return {
    url,
    checkedAt: new Date().toISOString(),
    ownershipVerified: true,
    status: risky ? "review" : unreliable ? "unknown" : "observed",
    summary: risky
      ? "검사용 Origin을 그대로 허용하면서 credentials=true를 반환했습니다. 인증된 응답에서도 같은 정책인지 우선 확인하세요."
      : unreliable
        ? "일부 요청이 정상 응답이 아니어서 CORS 정책을 판단할 근거가 부족합니다."
        : reflected.length
          ? "검사용 Origin 반영을 관찰했습니다. 인증 정보 허용은 관찰하지 않았습니다. 의도한 공개 API인지 확인하세요."
          : "이번 세 요청에서 검사 Origin과 인증 정보의 동시 허용을 관찰하지 못했습니다. 다른 경로나 로그인 후 정책은 확인하지 않았습니다.",
    evidence,
    nextStep: risky
      ? "본인의 테스트 계정으로 민감한 응답의 CORS 정책을 확인하세요. 신뢰하는 Origin만 정확히 허용하고 null이나 임의 Origin 반영을 제거한 뒤 같은 검사를 재실행하세요."
      : "인증 API와 공개 API의 허용 Origin을 구분하세요. 공개 데이터의 * 허용은 자체로 취약점이 아니며, 브라우저는 *와 credentials 조합을 허용하지 않습니다.",
  };
}
export async function runCorsAudit(
  raw: string,
  owner: string,
  token: string,
  signal: AbortSignal,
  read = readSecurityProbe,
): Promise<CorsAudit> {
  const url = publicUrl(raw).href;
  const fileUrl = validateOwnershipToken(token, url, owner);
  const proof = await read(fileUrl, null, signal);
  if (proof.status !== 200 || proof.body.trim() !== token)
    throw new HttpError(
      403,
      "소유권 파일을 확인하지 못했습니다. 안내한 주소에 정확한 내용을 배포하세요. 리디렉션은 허용하지 않습니다.",
    );
  const evidence: ProbeEvidence[] = [];
  for (const [label, origin] of [
    ["기본 요청", null],
    ["임의 Origin", `https://${randomBytes(16).toString("hex")}.invalid`],
    ["null Origin", "null"],
  ] as const) {
    signal.throwIfAborted();
    const response = await read(url, origin, signal);
    evidence.push({
      label,
      origin,
      status: response.status,
      allowOrigin: response.headers["access-control-allow-origin"] || "",
      allowCredentials: response.headers["access-control-allow-credentials"] || "",
      vary: response.headers.vary || "",
    });
  }
  return interpretCors(url, evidence);
}
