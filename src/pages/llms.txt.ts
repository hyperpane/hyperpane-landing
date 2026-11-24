import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../site";
import { faq } from "../faq";

// /llms.txt: the site's index for LLMs (llmstxt.org): what hyperpane is in a few
// facts, the main pages, the docs (as Markdown), and the questions people ask.
export const GET: APIRoute = async () => {
  const docs = (await getCollection("docs")).sort((a, b) => a.data.order - b.data.order);
  const lines = docs.map((d) => `- [${d.data.title}](${site.url}/docs/${d.id}.md): ${d.data.description}`).join("\n");
  const body = `# ${site.name}

> ${site.description}

## Key facts

- What: a development environment with one infinite canvas of live windows per project (terminals, a code editor, a file explorer, Git, a web browser, coding agents).
- Always on: terminals and agents run on a hyperpane server, so they keep running when the app closes. A server on another machine (a VPS) keeps them running when the laptop is closed too.
- Servers: one comes with the app on this machine; any other machine runs \`hyperpane-server\` and is connected with its key (\`hpk1_…\`). One canvas can mix windows from several servers.
- Plugins: every window is a plugin; the built-ins use the same public API.
- Platforms: macOS, Windows, Linux.
- Availability: the first builds are on their way (${site.url}/download).

## Pages

- [Home](${site.url}/): what hyperpane is, for every role
- [Download](${site.url}/download): every build for macOS, Windows and Linux, and the server
- [FAQ](${site.url}/faq): questions and answers
- [Documentation](${site.url}/docs)
- Full text for LLMs: ${site.url}/llms-full.txt

## Documentation

${lines}

## FAQ

${faq.map(({ q, a }) => `### ${q}\n\n${a}`).join("\n\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
