export const SITE_NAME = "CODE:FIT";
/** Root layout template; child routes set only their own page name. */
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;
/** For root-level files (not-found) that the layout template does not reach. */
export const siteTitle = (page: string) => TITLE_TEMPLATE.replace("%s", page);

/** Public origin for absolute URLs in metadata, the sitemap and robots.txt. */
export function siteOrigin(env: Record<string, string | undefined> = process.env) {
  const candidates = [
    env.APP_ORIGIN,
    env.AUTH_BASE_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      /* Try the next configured origin. */
    }
  }
  return "http://localhost:3000";
}
