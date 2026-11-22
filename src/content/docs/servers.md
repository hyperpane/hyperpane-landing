---
title: Servers
description: "Your computer's server, adding servers on other machines, and what keeps running when the app quits."
section: Using hyperpane
order: 12
---

# Servers

In hyperpane the app shows your work, and a **server** does it. Terminals, files and plugins' background parts all run on a server, so they keep going when you close the app.

Your computer has its own server, which comes with the app. Any other machine can run one too, and one app can be connected to many.

## Your computer's server

You don't have to do anything: the app starts your computer's server when it needs it, and finds its key by itself. It shows first under **Servers** in the sidebar.

It keeps running after you quit the app, so your terminals do too. Once nothing is running on it and no app is attached, it exits on its own a minute later.

Its page (click it in the sidebar, or the server in the footer) has **Stop** and **Start**. If it ever gets stuck, **Force start** ends it and starts it fresh. You can also search for "Start this Mac's server" or "Stop this PC's server" with ⌘K (Ctrl+K).

## Add a server

To work on another machine (a VPS, a staging box, another computer), run the hyperpane server there and connect to it with its key.

1. Get the server for that machine from the [download page](/download).
2. On that machine, run:

   ```sh
   hyperpane-server run --listen 0.0.0.0:38888
   ```

   It prints a key that starts with `hpk1_`.
3. In the app, click **+** on the **Servers** card and choose **Add a server**, or search for "Add a server" with ⌘K.
4. Paste the key and click **Add**.

The server shows in the sidebar with its status. Make a project on it with **New project**, choosing that server and a folder on that machine.

> The key gives full access to that machine as the user the server runs as. Keep it like an SSH key.

A `hyperpane://connect?key=…` link opens the same **Add a server** dialog with the key filled in. Nothing is added until you confirm, so add the server only if you trust where the link came from.

### Managing it from the command line

On the server's machine:

| Command | What it does |
| --- | --- |
| `hyperpane-server run --listen 0.0.0.0:38888` | Start it, listening on port 38888 |
| `hyperpane-server key` | Print its key again |
| `hyperpane-server status` | Say whether it's running, and where |
| `hyperpane-server stop` | Stop it, and everything running in it |
| `hyperpane-server restart` | Stop it and run it again; apps reconnect by themselves |
| `hyperpane-server new-key` | Replace the key: every app is cut off until you give it the new one |
| `hyperpane-server config` | Show its settings and the values in use |
| `hyperpane-server config set KEY VALUE` | Change a setting |

## The connection

Every connection to a server needs its key, and everything sent is encrypted end to end with it, even on your local network. Without the key, nobody can connect.

## A server's page

Click a server in the sidebar to open its page. It has three tabs:

- **Settings:** its name, the address and port it listens on, the address clients reach it at, when it exits if idle, when idle plugins stop, and the Node it runs plugins with. Some apply at once; the rest when it restarts, and the page says which.
- **Details:** its version, the machine and user it runs as, how long it has been up, where it listens, and its data folder.
- **Log:** what it has been doing.

Its **⋯** menu has **Replace the key** (the old key stops working; the page shows the new one to paste into your other apps and machines), **Copy the key** and, for other machines' servers, **Remove from this app**.

The same settings are in a `config.json` file in the server's data folder, with a note on each one. You can edit it by hand; the server picks up changes as you save.

## What keeps running

When you quit the app:

- **Terminals** keep running on their server, with their screen and scrollback. Open the app again and they're as you left them.
- **Plugins' scheduled jobs** keep running on the server, with no app open.
- **Plugins' background parts** start when they're needed and stop after five minutes with nothing to do (you can change that in the server's settings). They start again on their next use.

Your computer's server exits a minute after nothing is running and no app is attached. A server on another machine keeps running until you stop it, unless you set **Exit when idle** in its settings.

## Where windows run

Each window runs on a server, and a canvas can hold windows from several. The footer shows the server of the focused window, whether it's live, and its version. Click it to open that server's page.

## Next

- [Projects](/docs/projects)
- [Plugins](/docs/plugins): each plugin's server part runs on the project's server.
