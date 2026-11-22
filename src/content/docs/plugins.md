---
title: Plugins
description: "The built-in windows and the plugins you can add, installing them from the Plugins page or GitHub, updating and removing them."
section: Plugins
order: 20
---

# Plugins

Every kind of window in hyperpane is a plugin, the built-in ones too. A plugin can add windows, panels, pages, menu items, commands with shortcuts, and settings. Many also have a part that runs on the server, so their work goes on when the app is closed.

## Built-in

These come with the app, and the app keeps them up to date: a newer app brings newer copies. If you changed one, the copy it replaces is kept in a backup folder.

| Plugin | What it is |
| --- | --- |
| **Terminal** | Your shell, run by the server so it keeps going when the app quits: zsh, bash, fish or PowerShell, 10,000 lines of scrollback, links, mouse, emoji. |
| **Editor** | A code editor for any file on the server: highlighting for most languages, find and replace, multiple cursors, auto-save. It follows changes on disk. Pictures, video and sound show as they are. |
| **Explorer** | A folder as a Finder-style list that follows the disk: expand in place, sort, search by name, drag to move or copy, open files in the Editor. Shows Git status when Git is installed. |

## Plugins you can add

| Plugin | What it is |
| --- | --- |
| **[Git](https://github.com/hyperpane/hp-git)** | Commit, branch and sync, laid out like GitHub Desktop: changes by file, hunk or line, history with a graph, branches, stashes, tags, blame, conflicts, fetch, pull and push. |
| **[Browser](https://github.com/hyperpane/hp-browser)** | A real web page on your canvas: localhost in a keystroke, phone, tablet and desktop sizes, bookmarks, DevTools. |
| **[Data](https://github.com/hyperpane/hp-data)** | Your databases on the canvas: PostgreSQL, MySQL, SQLite, ClickHouse, Redis, MongoDB, Elasticsearch, DynamoDB, Kafka, RabbitMQ, SQS and S3, with saved connections, consoles and editable tables. |
| **[Requests](https://github.com/hyperpane/hp-requests)** | Test APIs: HTTP, GraphQL, WebSocket and Server-Sent Events sent from the server, collections in the project, environments, history, cURL and Postman import. |
| **[Containers](https://github.com/hyperpane/hp-containers)** | Docker, Podman, nerdctl, Kubernetes, pm2, tmux and screen on your server, laid out like Docker Desktop: containers by Compose project, images, volumes, networks, logs, files, stats. |
| **[Tunnels](https://github.com/hyperpane/hp-tunnels)** | Share a port of your server on the internet, no account needed: HTTP and WebSocket or TCP tunnels through tunnl.gg, Pinggy, Cloudflare or bore, kept running and reconnecting. |
| **[Activity](https://github.com/hyperpane/hp-activity)** | What your server is doing, like Activity Monitor or htop: CPU per core, memory, GPU, network and disk, charted live, and its processes to sort, search and end. |
| **[Env](https://github.com/hyperpane/hp-env)** | Your project's `.env` files, every secret hidden until you look: edit values in place with comments kept, compare files side by side, and a warning when git has your secrets. |
| **[Code Stats](https://github.com/hyperpane/hp-codestats)** | Your code counted: lines of code, comments and blank lines in every language, by folder, and the longest files. |
| **[Pets](https://github.com/hyperpane/hp-pets)** | A little pixel cat that naps on the header of the window you're working in and follows you to the next one. Four coats, three sizes. |

## The Plugins page

Plugins are installed **per project**: each project has the ones it needs. Open the Plugins page from:

- **Plugins** in a project's menu in the sidebar;
- **Plugins** when you right-click the canvas;
- **Add plugins** in [Settings](/docs/settings);
- or search for "Plugins" with ⌘K (Ctrl+K).

The page judges every plugin against the open project and the server it runs on, in four tabs:

- **In this project:** what the project has.
- **Available:** what you can install in it.
- **Updates:** plugins with a newer version.
- **Unavailable:** what can't be used here, and why.

Click a plugin for its own page: its readme, its **Settings**, what it adds (**Contributions**), its server part on each server (**Server**), and its **Logs**.

### Developer mode

Turn on **Developer mode** in the page's **⋯** menu for a fifth tab, **Development**: plugins loaded straight from the folders you work in, in place of the plugins folder's copy.

- **Add folder** (or drop a folder on the tab) adds a plugin's folder. Its plugin is loaded from there until you take it out.
- Saving a file reloads it: its windows at once, and its server part is installed again on the project's server.
- Each folder shows whether it's being watched, when it last reloaded, where its server part runs, and any problem in its `plugin.json`. **Open** and **Logs** go to its page; **⋯** shows it in its folder, copies the path, installs the server part again, or takes it out.
- Plugins run with [`hyperpane plugin dev`](/docs/reference/cli#plugin-dev) from a terminal show there too.

Turning Developer mode off unloads the folders (they stay listed for next time) and the plugins folder's copies come back. See [Writing a plugin](/docs/plugins/writing#running-it-in-the-app).

## Install a plugin

Click **Install** on a plugin to add it to the open project. Before it's installed you see what it asks for: its permissions (such as reaching the network, using the clipboard, driving terminals, or opening and controlling other plugins' windows), what it adds, and the jobs it would run on a schedule. Camera, microphone and screen are asked for again the first time a plugin uses them.

Some plugins drive others: an AI plugin can open a Browser beside its window and read and click pages in it. It needs the **Opens and controls other plugins' windows** permission, and only reaches the plugins it names; the windows it opens show on your canvas, and you can use or close them.

New projects offer this too: right after **New project**, the **Add plugins** dialog lists the plugins the project could have.

### From GitHub

1. On the Plugins page, click **Add plugin** and choose **Install from GitHub**.
2. Paste a repository's link, such as `https://github.com/hyperpane/hp-git`, or a link to a folder inside one (`…/tree/main/plugins/notes`).
3. hyperpane clones it into your plugins folder and shows what it asks for. Then install it in the project.

This uses git on your computer, so the option shows only when git is installed.

> A plugin runs code with your access on the server. Install plugins from people you trust.

### From a file

**Add plugin › Install from file** installs a plugin package you have on disk.

### Your plugins folder

Every plugin package lives in your plugins folder. The page's **⋯** menu has **Open plugins folder**, and **Look for changes** to pick up packages you added or edited there by hand.

## Update a plugin

- The **Updates** tab lists plugins with a newer version.
- A plugin installed from GitHub has **Check for updates** on its page, and **Update** when there is one.
- On a plugin's **Server** tab, a server with an older copy of its server part shows **Update to …**.

If an update asks for more than you allowed before, its windows offer **Allow what … asks for** in their menu.

## Remove a plugin

- **Remove from project** takes it out of the open project. If other plugins need it, hyperpane asks whether to turn them off too. Their windows stay, and show what's missing.
- **Remove** on a plugin's **Server** tab takes its server part off that server. Its data on the server stays.
- For a plugin you installed yourself (from GitHub or a file), **Delete** on its page moves its package folder to the Trash (the Recycle Bin on Windows). Projects that use it show what's missing.

## Write your own

Plugins use the same API the built-in windows do. See [Writing a plugin](/docs/plugins/writing).
