import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// The docs: Markdown files in src/content/docs (folders for groups of pages),
// each with its title, a one-line description, its section in the sidebar,
// and its order there.
const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.string().default("Guide"),
    order: z.number().default(99),
  }),
});

export const collections = { docs };
