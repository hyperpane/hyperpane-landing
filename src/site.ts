/** The site's facts, in one place: what the pages, their meta tags and
 * the files for LLMs (llms.txt) say about hyperpane. */
export const site = {
  name: "hyperpane",
  tagline: "The next-gen IDE for every role.",
  description:
    "hyperpane is the next-gen IDE for every role: code, terminals, Git, a browser and your agents as live windows, one canvas per project, that keep working when you close the app.",
  // The address it's published at (GitHub Pages, public/CNAME).
  url: "https://hyperpane.app",
};

/** The top bar's links. The landing's sections are on the home page. */
export const nav = [
  { label: "Roles", href: "/#roles" },
  { label: "Windows", href: "/#plugins" },
  { label: "Always on", href: "/#detach" },
  { label: "Docs", href: "/docs" },
];
