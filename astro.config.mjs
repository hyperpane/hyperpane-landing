// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { site } from "./src/site.ts";

export default defineConfig({
  site: site.url,
  output: "static",
  trailingSlash: "never",
  integrations: [sitemap()],
  markdown: {
    // Code in the docs on a neutral dark, as the app's black theme.
    shikiConfig: { theme: "github-dark-default", wrap: false },
  },
});
