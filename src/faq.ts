/** Questions people (and answer engines) ask about hyperpane, answered from the
 * product as it is. The FAQ page, its FAQPage data and llms.txt all read this. */
export const faq: { q: string; a: string }[] = [
  {
    q: "What is hyperpane?",
    a: "hyperpane is a development environment built around one infinite canvas per project. Terminals, a code editor, a file explorer, Git, a web browser and your coding agents sit on it as live windows, side by side, and the canvas comes back exactly as you left it. The work runs on a hyperpane server, so it keeps going when you close the app.",
  },
  {
    q: "How is hyperpane different from an IDE with tabs?",
    a: "Instead of tabs and split panes, every tool is a window on a canvas you pan and zoom, like a design file. You lay a project out the way you think about it: the terminal next to the code it runs, the browser next to both. Each project has its own canvas, stored in the project's .hyperpane folder.",
  },
  {
    q: "Do my terminals keep running when I close hyperpane?",
    a: "Yes. Terminals and the processes they start run on a hyperpane server, not inside the app window. The server on your own machine comes with the app and outlives it; when you open the app again, every terminal is still there with its screen. If the server runs on another machine, such as a VPS, the work also keeps running when your laptop is closed.",
  },
  {
    q: "Can I run hyperpane on a remote server or a VPS?",
    a: "Yes. Run hyperpane-server on any machine (for example hyperpane-server run --listen 0.0.0.0:38888); it prints a key that starts with hpk1_. Paste the key into the app to connect. Connections are encrypted (Noise over WebSocket), and one canvas can mix windows from several servers, each window showing which server it runs on.",
  },
  {
    q: "Can I run AI coding agents like Claude Code in hyperpane?",
    a: "Yes. Coding agents run in hyperpane's terminals like any command line tool, so you can run several at once, each in its own window and header color, and see them all on one canvas. Because terminals live on the server, an agent keeps working after you close the app.",
  },
  {
    q: "Which operating systems does hyperpane support?",
    a: "macOS, Windows and Linux. The desktop app and the web interface share one codebase, and the server runs on all three.",
  },
  {
    q: "What windows does hyperpane have?",
    a: "Built in: Terminal, Editor and Explorer. As plugins: Git, Browser, Data (databases), Requests (HTTP and WebSocket requests), Containers, Tunnels, Activity, Env (environment files), Code Stats and more. Plugins live on the server, in its plugins folder; each project shows the ones you want.",
  },
  {
    q: "Can I write my own hyperpane plugin?",
    a: "Yes. Every window in hyperpane is a plugin, and the built-in windows use the same public API that any plugin gets. A plugin has an interface, which its server sends to the app, and can have a part that runs on the server. The docs cover writing one, its manifest and the SDK.",
  },
  {
    q: "Does hyperpane have a command line?",
    a: "Yes. The hyperpane command talks to a server: for example hyperpane info shows this machine's server, hyperpane add ~/dev/app adds a project, and hyperpane term new PROJECT opens a terminal window that keeps running.",
  },
  {
    q: "When can I download hyperpane?",
    a: "The first builds are on their way. The download page lists every file for macOS, Windows and Linux, and its buttons turn on the day they ship.",
  },
];
