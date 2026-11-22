---
title: Settings and themes
description: "The Settings page, themes and making your own, the sidebar's place, window header colors, and the search's prefixes."
section: Using hyperpane
order: 14
---

# Settings and themes

## The Settings page

Click the gear at the right end of the title bar to open **Settings**. Click it again to go back to the canvas. On the left are its sections:

- **General:** the app's own settings.
- **Themes:** colors for the whole app (see [Themes](#themes)).
- **Plugins:** each plugin that has settings, with how many it has. **Add plugins** opens the [Plugins](/docs/plugins) page.

### General

| Setting | What it does |
| --- | --- |
| **Mouse wheel** | What turning a mouse's wheel over the canvas does: **Zoom**, or **Move the canvas**. It zooms by default on Windows and Linux, and moves the canvas on a Mac. A touchpad pans either way, and pinching (or ⌘ / Ctrl with the wheel) zooms. |
| **Smooth zoom** | Each notch of the wheel glides to the next zoom, rather than jumping there. Off by default. |
| **Inertia** | The canvas glides on and slows down after you drag it, as with a Mac's trackpad. Off by default. |
| **Other links plugins may open** | Plugins can open web and mail links. Add other kinds here by the start of their address, separated by commas, when a plugin needs them: `vscode` to open files in VS Code, `slack`, `ssh`. Links to files on your computer, and `javascript:` and `data:` links, never open. |
| **Screenshots go to** | Where a window's screenshot goes: **The clipboard**, **The Desktop**, or **A folder** (by default `~/Pictures/Screenshots`). |

### Built-in plugins' settings

- **Terminal › Shell:** what new terminals start, from the shells the server has, or **A command of your own** (a program and its arguments). A terminal keeps its shell when it starts again. On a Windows server, a terminal's **⋯** menu also switches that terminal between **Command Prompt**, **PowerShell** and **WSL**: it starts the new shell in the same folder (one the server doesn't have is shown, not offered).
- **Drawings › New notes' color:** the color new sticky notes get. Choosing a color for a note in its style bar sets it too.
- **Drawings › Show the toolbar:** the drawing tools at the bottom of the canvas. Their keys work either way.

Other plugins' settings show up here as you install them. Each plugin's settings are also on the **Settings** tab of its page in Plugins.

## Themes

A theme colors the terminals, the canvas and its windows, and says whether the app around them is light or dark. Open **Settings › Themes** and click **Use** on the one you want. The theme in use is kept on this computer.

The built-in themes:

| Theme | Kind |
| --- | --- |
| Astralyx Dark (the default) | Dark |
| Astralyx Light | Light |
| Nord | Dark |
| Solarized Dark | Dark |
| Solarized Light | Light |
| Gruvbox Dark | Dark |
| Dracula | Dark |
| Tokyo Night | Dark |

### Make your own

- **New theme** makes one from scratch. **Duplicate** in a built-in theme's menu makes an editable copy of it.
- Edit it on its page, with a live preview: its author and kind (light or dark); the terminal's text, background, cursor and selection; the 16 ANSI colors; the canvas and its windows (left empty, each is worked out from the terminal's colors); and the layout's corner radius and spacing.
- Changes show at once and save as you go. **Rename** and **Delete** are in its menu.
- **Export** a theme as a `.json` file, and **Import theme** from the page's **⋯** menu.

In the desktop app, your themes are `.json` files in a themes folder (**⋯ › Open themes folder**). Edit them here or in any editor: the app follows changes as you save. The folder's `README.md` describes what goes in a theme file.

## The sidebar's place

The layout button in the title bar, next to the gear, shows where the sidebar is. Click it to put the sidebar **On the left**, **On the right**, or make it **Hidden**. Your choice is kept on this computer.

The cards in the sidebars (such as **Servers**) can be moved too: each card's header menu moves it to either sidebar or the bottom panel, puts it on the canvas, or hides it.

## Window header colors

To tell windows apart at a glance, give a window's header a color: right-click the window (or use its header's **⋯**) and pick one under **Header color**. There are twelve swatches, a picker for any color, and none to go back to the theme's.

Projects in the sidebar can have their own icon and color too, from each project's menu.

## Search

The search in the middle of the title bar (⌘K, or Ctrl+K on Windows and Linux) finds everything: commands, the open project's windows, every project on every server, pages and servers. Type to narrow it, use ↑ and ↓ to choose, and press Enter to open or run.

Start your search with a prefix to look for one kind of thing:

| Prefix | Finds |
| --- | --- |
| `>` | Commands only |
| `@` | Windows in the open project |
| `#` | Projects |

With nothing typed, the search lists your most recent commands first. The buttons at the bottom of the search add or remove a prefix for you.

From a terminal, ⌘K clears it on a Mac and goes to the program on Windows and Linux. Use ⇧⌘P (Ctrl+Shift+P) to open the search there. More in [Keyboard shortcuts](/docs/shortcuts).
