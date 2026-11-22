import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

// Each doc as plain Markdown at /docs/<slug>.md: for "View as Markdown" and
// for AI crawlers.
export async function getStaticPaths() {
  const docs = await getCollection("docs");
  return docs.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) => {
  const { entry } = props as { entry: Awaited<ReturnType<typeof getCollection<"docs">>>[number] };
  const body = `# ${entry.data.title}\n\n> ${entry.data.description}\n\n${entry.body ?? ""}`;
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
