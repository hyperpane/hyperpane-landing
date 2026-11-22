import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../site";

// /llms.txt: the site's index for LLMs (llmstxt.org).
export const GET: APIRoute = async () => {
  const docs = (await getCollection("docs")).sort((a, b) => a.data.order - b.data.order);
  const lines = docs.map((d) => `- [${d.data.title}](${site.url}/docs/${d.id}.md): ${d.data.description}`).join("\n");
  const body = `# ${site.name}

> ${site.description}

- Full text for LLMs: ${site.url}/llms-full.txt

## Documentation

${lines}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
