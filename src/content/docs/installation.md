---
title: Install
description: "The downloads for macOS, Windows and Linux, which one to pick, and the server for other machines."
section: Get started
order: 2
---

# Install

> The first builds are almost here. Nothing can be downloaded yet: the [download page](/download) lists every file below and turns each button on when it's out.

hyperpane is a desktop app for macOS, Windows and Linux. The app comes with its own server for your computer, so one download is all you need to start.

## Pick your download

### macOS

For Apple silicon and Intel Macs.

| Format | What it is |
| --- | --- |
| Disk image (`.dmg`) | Open it and drag hyperpane to Applications |
| Zip | The app, to unpack anywhere |

### Windows

For x64.

| Format | What it is |
| --- | --- |
| Installer (`-setup.exe`) | Installs it for you, with a Start menu entry |
| Portable (`-portable.exe`) | Runs without installing |

### Linux

For x64 and arm64.

| Format | What it is |
| --- | --- |
| AppImage | One file: make it executable and run it |
| Tarball (`.tar.gz`) | The app, to unpack anywhere |

For an AppImage:

```sh
chmod +x hyperpane-*.AppImage
./hyperpane-*.AppImage
```

## Start it

Open hyperpane. It starts your computer's server by itself, and the sidebar shows it under **Servers**. You don't need to set anything up.

The server keeps running after you quit the app, so your terminals do too. It exits on its own a minute after nothing is running and no app is attached. See [Servers](/docs/servers).

### The `hyperpane` command

The app comes with the [`hyperpane` command](/docs/reference/cli). The first time it starts, if a terminal can't find it, the app offers to install it: **Install**, **Not now** (it asks again next time) or **Don't ask again**. Developer mode on the Plugins page offers it too.

- **macOS:** a link in `/usr/local/bin`; macOS asks for your password.
- **Windows:** a copy in `%LOCALAPPDATA%\hyperpane\bin`, added to your Path. Open a new terminal to use it.
- **Linux:** a link in `~/.local/bin`.

It's a link (or a copy) of the app's own, so updating the app updates it.

## The server for other machines

To run windows on another machine (a VPS, a build box, another computer), put the hyperpane server there. The [download page](/download) has it on its own for:

- Linux, x64 and arm64
- macOS, Apple silicon and Intel
- Windows, x64

You don't need the app on that machine. [Adding a server](/docs/servers#add-a-server) shows how to start it and connect.

## Next

[Make your first project](/docs/first-project).
