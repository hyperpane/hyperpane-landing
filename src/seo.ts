/** Search and answer-engine helpers: who publishes the site, when a page last
 * changed, and the structured data every page carries. */
import { execFileSync } from "node:child_process";
import { site } from "./site";
import { version } from "./downloads";

/** When a source file last changed, from git (the build's date if it has no history). */
export function lastmod(file: string): string {
  try {
    const d = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], { encoding: "utf8" }).trim();
    if (d) return d;
  } catch {}
  return new Date().toISOString();
}

export const organization = {
  "@type": "Organization",
  "@id": `${site.url}/#organization`,
  name: site.name,
  url: site.url,
  logo: `${site.url}/icon.png`,
  sameAs: ["https://github.com/hyperpane"],
};

export const website = {
  "@type": "WebSite",
  "@id": `${site.url}/#website`,
  name: site.name,
  url: site.url,
  description: site.description,
  inLanguage: "en",
  publisher: { "@id": `${site.url}/#organization` },
};

export const application = {
  "@type": "SoftwareApplication",
  "@id": `${site.url}/#app`,
  name: site.name,
  applicationCategory: "DeveloperApplication",
  applicationSubCategory: "Integrated development environment",
  operatingSystem: "macOS, Windows, Linux",
  softwareVersion: version,
  description: site.description,
  url: site.url,
  downloadUrl: `${site.url}/download`,
  image: `${site.url}/og.png`,
  screenshot: [`${site.url}/shots/app-chrome.webp`, `${site.url}/shots/terminal.webp`, `${site.url}/shots/editor.webp`, `${site.url}/shots/browser.webp`],
  featureList: [
    "One infinite canvas of live windows per project",
    "Terminals, an editor, a file explorer, Git and a browser as windows",
    "Terminals and agents keep running on a hyperpane server when the app closes",
    "Servers on this machine or any other (a VPS, a staging box), connected with a key",
    "Windows from several servers on one canvas",
    "Every window is a plugin; plugins use the same public API as the built-ins",
  ],
  publisher: { "@id": `${site.url}/#organization` },
};

/** A breadcrumb trail: [name, path] pairs from the home page down. */
export function breadcrumbs(trail: [string, string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${site.url}${path}` })),
  };
}
