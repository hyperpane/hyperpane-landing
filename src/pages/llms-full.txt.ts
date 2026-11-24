import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../site";
import { faq } from "../faq";

// /llms-full.txt: every doc in one file, in order, for LLMs.
export const GET: APIRoute = async () => {
  const docs = (await getCollection("docs")).sort((a, b) => a.data.order - b.data.order);
  const parts = docs.map((d) => `# ${d.data.title}\n\nSource: ${site.url}/docs/${d.id}\n\n> ${d.data.description}\n\n${d.body ?? ""}`);
  const qa = faq.map(({ q, a }) => `## ${q}\n\n${a}`).join("\n\n");
  const body = `# ${site.name}\n\n> ${site.description}\n\n# FAQ\n\nSource: ${site.url}/faq\n\n${qa}\n\n---\n\n${parts.join("\n\n---\n\n")}\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
