import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
import { sitemapPaths } from "@/lib/sitemap-paths";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return sitemapPaths().map((path) => ({ url: new URL(path, origin).toString() }));
}
