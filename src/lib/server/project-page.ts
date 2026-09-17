import { Resolver } from "node:dns/promises";
import { get } from "node:https";
import { BlockList, isIP } from "node:net";
import { HttpError } from "./http";
import type { PageSnapshot } from "../project-check/types";
const blocked = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, prefix);
export function isPublicIPv4(ip: string) {
  return isIP(ip) === 4 && !blocked.check(ip);
}
export function publicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "https://로 시작하는 공개 서비스 주소를 입력해 주세요.");
  }
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    isIP(url.hostname.replace(/[\[\]]/g, "")) ||
    !url.hostname.includes(".") ||
    /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) ||
    raw.includes("\\")
  )
    throw new HttpError(
      400,
      "로그인 정보와 쿼리 문자열이 없는 공개 HTTPS 주소를 입력해 주세요. 내부 주소와 IP 주소는 분석할 수 없습니다.",
    );
  return url;
}
export function pageText(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /&(?:nbsp|amp|lt|gt|quot|#39);/g,
      (s) =>
        ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[
          s
        ] || " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}
async function resolvePublic(hostname: string, signal: AbortSignal) {
  const resolver = new Resolver({ timeout: 2500, tries: 1 });
  const cancel = () => resolver.cancel();
  signal.throwIfAborted();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const addresses = await resolver.resolve4(hostname);
    if (!addresses.length || addresses.some((ip) => !isPublicIPv4(ip)))
      throw new HttpError(400, "공개 인터넷 주소만 분석할 수 있습니다.");
    return addresses[0];
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
export async function readPublicPage(
  raw: string,
  parentSignal: AbortSignal,
): Promise<PageSnapshot> {
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(12_000)]);
  let url = publicUrl(raw);
  try {
    for (let redirect = 0; redirect <= 2; redirect++) {
      const address = await resolvePublic(url.hostname, signal);
      // Pin the checked DNS address for this connection; TLS still verifies the original host.
      const response = await new Promise<{ location?: string; html: string }>((resolve, reject) => {
        const request = get(
          url,
          {
            signal,
            agent: false,
            family: 4,
            lookup: (_host, _options, callback) => callback(null, address, 4),
            headers: {
              "User-Agent": "Codefit-LearningPreview/1.0",
              Accept: "text/html",
              "Accept-Encoding": "identity",
            },
          },
          (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
              const location = res.headers.location;
              res.destroy();
              if (!location)
                reject(new HttpError(422, "이동할 페이지 주소를 확인하지 못했습니다."));
              else resolve({ location, html: "" });
              return;
            }
            if (
              res.statusCode !== 200 ||
              !res.headers["content-type"]?.includes("text/html") ||
              (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")
            ) {
              res.destroy();
              reject(
                new HttpError(
                  422,
                  "공개 HTML 화면을 읽지 못했습니다. 로그인 없이 열리는 서비스 소개 페이지를 사용해 주세요.",
                ),
              );
              return;
            }
            let size = 0;
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > 600_000) {
                res.destroy();
                reject(
                  new HttpError(
                    422,
                    "페이지가 너무 큽니다. 더 간단한 서비스 소개 페이지를 사용해 주세요.",
                  ),
                );
              } else chunks.push(chunk);
            });
            res.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8") }));
            res.on("error", reject);
            res.on("aborted", () => reject(new HttpError(422, "페이지 읽기가 중단됐습니다.")));
          },
        );
        request.on("error", reject);
      });
      if (response.location) {
        url = publicUrl(new URL(response.location, url).href);
        continue;
      }
      const text = pageText(response.html).slice(0, 12_000);
      return {
        url: url.href,
        text,
        title: pageText(
          response.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || url.hostname,
        ).slice(0, 160),
        fetchedAt: new Date().toISOString(),
        limited: text.length < 200,
      };
    }
    throw new HttpError(422, "페이지 이동이 너무 많습니다. 최종 서비스 주소를 입력해 주세요.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      422,
      "페이지에 접속하지 못했습니다. 외부에서 열리는 HTTPS 주소인지 확인해 주세요.",
    );
  }
}
