export function isAllowedOrigin(request: Request, appOrigin?: string): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients still require a valid session and JSON content type.
  const url = new URL(request.url);
  // Next.js can normalize request.url to localhost; Host retains the browser-facing host.
  const expectedOrigin = appOrigin || `${url.protocol}//${request.headers.get("host") || url.host}`;
  return origin === expectedOrigin;
}
