---
title: Plugins
description: "The built-in windows and the plugins a server can run: where they come from, showing them in a project, updating and removing them."
section: Plugins
order: 20
---

# Plugins

Every kind of window in hyperpane is a plugin, the built-in ones too. A plugin can add windows, panels, pages, menu items, commands with shortcuts, and settings. Many also have a part that runs on the server, so their work goes on when the app is closed.

## Where plugins live

Plugins run on a [server](/docs/servers), and each server runs the plugins in its **plugins folder**. The app has none of its own: when you open a project, it gets every plugin's interface from the server, so the same plugins show wherever you connect from, desktop or web.

| Server | Plugins folder |
| --- | --- |
| This machine's (macOS, Linux) | `~/.hyperpane/plugins` |
| This machine's (Windows) | `%APPDATA%\hyperpane\plugins` |
| Any server | Its `plugins` [setting](/docs/servers#plugins-folder), or `hyperpane-server run --plugins PATH` |

A plugin in the folder is on in every project on that server. The server looks at the folder every 2 seconds, so a plugin you add, update or remove there shows up, changes or goes within moments.

## Built-in

These come with the app. When it starts this machine's server, the app puts its own copies in the plugins folder if they're missing there or older; a newer copy you put there is left alone.

| Plugin | What it is |
| --- | --- |
| **Terminal** | Your shell, run by the server so it keeps going when the app quits: zsh, bash, fish or PowerShell, 10,000 lines of scrollback, links, mouse, emoji. |
| **Editor** | A code editor for any file on the server: highlighting for most languages, find and replace, multiple cursors, auto-save. It follows changes on disk. Pictures, video and sound show as they are. |
| **Explorer** | A folder as a Finder-style list that follows the disk: expand in place, sort, search by name, drag to move or copy, open files in the Editor. Shows Git status when Git is installed. |

## More plugins

Put a plugin's folder (or its unpacked release archive) in the server's plugins folder, named by its id, and it runs:

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

The Plugins page lists the plugins on the open project's server. Open it from:

- **Plugins** in a project's menu in the sidebar;
- **Plugins** when you right-click the canvas;
- **Add plugins** in [Settings](/docs/settings);
- or search for "Plugins" with ⌘K (Ctrl+K).

It has two tabs: **In this project** (the plugins shown in it) and **Available** (the server's other plugins).

### Show or hide a plugin in a project

Each plugin has a switch for the open project. It only changes what you see: a hidden plugin's windows, buttons, cards and menu items leave this app's view of the project, but the plugin keeps running on the server, for every project, and its windows stay in the project. Turn it back on and they're there. Plugins that others need are shown with them.

The first time a plugin is shown, you see what it asks for: its permissions (such as reaching the network, using the clipboard, driving terminals, or opening and controlling other plugins' windows), what it adds, and the jobs it runs on a schedule. Camera, microphone and screen are asked for again the first time a plugin uses them.

Some plugins drive others: an AI plugin can open a Browser beside its window and read and click pages in it. It needs the **Opens and controls other plugins' windows** permission, and only reaches the plugins it names; the windows it opens show on your canvas, and you can use or close them.

> A plugin runs code with your access on the server. Put plugins from people you trust in a server's plugins folder.

### A plugin's page

Click a plugin for its page: **Details** (what it is and asks for), its **Settings**, what it adds (**Contributions**), its server part on each server (**Server**), and, when it has one, its server part's **Logs**, live.

## Update a plugin

Replace its folder in the server's plugins folder with the newer one. The server picks it up within 2 seconds: its server part restarts on the next call, and its open windows load the new interface. Windows and their data stay.

If an update asks for more than you allowed before, its windows offer **Allow what … asks for** in their menu.

## Remove a plugin

- **From your view of a project:** turn its switch off (above).
- **From a server:** take its folder out of the server's plugins folder. Its server part stops, and projects that have its windows show what's missing. Its data on the server stays.

## Write your own

Plugins use the same API the built-in windows do. See [Writing a plugin](/docs/plugins/writing).
