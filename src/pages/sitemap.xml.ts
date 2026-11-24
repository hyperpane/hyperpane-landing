import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../site";
import { lastmod } from "../seo";

// /sitemap.xml: every page, with when it last changed (from git). The
// @astrojs/sitemap integration also writes sitemap-index.xml; both are listed in robots.txt.
export const GET: APIRoute = async () => {
  const docs = (await getCollection("docs")).sort((a, b) => a.data.order - b.data.order);
  const pages: [string, string, string][] = [
    ["", "src/pages/index.astro", "1.0"],
    ["/download", "src/pages/download.astro", "0.9"],
    ["/faq", "src/faq.ts", "0.8"],
    ["/docs", "src/pages/docs/index.astro", "0.8"],
    ...docs.map((d): [string, string, string] => [`/docs/${d.id}`, `src/content/docs/${d.id}.md`, "0.6"]),
  ];
  const urls = pages
    .map(([path, file, priority]) => `  <url>\n    <loc>${site.url}${path}</loc>\n    <lastmod>${lastmod(file)}</lastmod>\n    <priority>${priority}</priority>\n  </url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
