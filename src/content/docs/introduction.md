---
title: What is hyperpane?
description: "An IDE whose workspace is an infinite canvas of live windows, one per project, run by servers that keep going when the app quits."
section: Get started
order: 1
---

# What is hyperpane?

hyperpane is an IDE built around one idea: **each project gets an infinite canvas of live windows**, and the work in those windows runs on a server that keeps going when you quit the app.

You open a project (a folder) and get a canvas you pan and zoom, like a design tool's. On it you put windows wherever you like: terminals, a code editor, a file explorer, Git, a web page, a database, and anything else a plugin draws. The next time you open the project, the canvas is exactly as you left it.

## The canvas

- **Live windows.** Every window is working, not a preview. Terminals run, the editor edits, the browser browses.
- **Your layout, kept.** Where each window sits and how big it is stays put. Group related windows, zoom out to see everything, zoom in to work.
- **Drawings and links.** Add notes, text, shapes, arrows and sections beside your windows, and link windows to each other through their ports.

More in [The canvas](/docs/canvas).

## Servers that keep running

The work doesn't happen in the app. It happens on a **hyperpane server**:

- one runs on your own computer and comes with the app;
- any other machine (a VPS, a staging box, another computer) can run one too, and you connect to it with its key.

A terminal started on a server keeps running, screen and all, when you close the app. Open the app again and it's still there. Each window shows which server it runs on.

More in [Servers](/docs/servers).

## Everything is a plugin

Every kind of window is a plugin, the built-in ones included. Terminal, Editor and Explorer come with the app; Git, Browser, Data, Requests, Containers, Tunnels, Activity, Env, Code Stats and Pets are plugins you install per project. Plugins use the same public API anyone can use to [write their own](/docs/plugins/writing).

More in [Plugins](/docs/plugins).

## Who it's for

- Developers who work across several projects at once, especially if you run coding agents in many terminals side by side.
- Anyone who wants a project's whole working set to look the same every time they open it, even when parts of it run on other machines.
- Plugin authors: what the built-in windows can do, your plugin can do too.

## Next

1. [Install hyperpane](/docs/installation).
2. [Make your first project](/docs/first-project).
3. Learn the [keyboard shortcuts](/docs/shortcuts).
