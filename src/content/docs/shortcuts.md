---
title: Keyboard shortcuts
description: "Every built-in shortcut on macOS, Windows and Linux, and how to change them."
section: Using hyperpane
order: 13
---

# Keyboard shortcuts

On Windows and Linux, the app's own shortcuts mostly use **Ctrl+Shift**, because plain Ctrl keys belong to the program in a terminal (Ctrl+C, Ctrl+K and so on). On a Mac they use ⌘.

You can change any of them: see [Change a shortcut](#change-a-shortcut).

## The app

These work anywhere on the canvas, in a terminal too.

| Action | Mac | Windows and Linux |
| --- | --- | --- |
| Search commands, windows, projects and pages | ⌘K | Ctrl+K |
| Search, from a terminal | ⇧⌘P | Ctrl+Shift+P |
| New terminal | ⌘T | Ctrl+Shift+T |
| New terminal below the focused one | ⇧⌘D | Ctrl+Shift+D |
| Zoom in | ⌘= | Ctrl+= |
| Zoom out | ⌘- | Ctrl+- |
| Actual size | ⌘0 | Ctrl+0 |
| Show everything | ⌘1 | Ctrl+Shift+1 |
| Zoom to the focused window | ⌘2 | Ctrl+Shift+2 |

In a terminal on a Mac, ⌘K clears the terminal (as in Terminal), so open the search with ⇧⌘P there. On Windows and Linux, Ctrl+K in a terminal goes to its program; use Ctrl+Shift+P.

## In the search

| Action | Keys |
| --- | --- |
| Choose | ↑ ↓ (or Ctrl+N, Ctrl+P) |
| Jump a group | Page Up, Page Down |
| Open or run | Enter |
| Close | Esc, or the search's own shortcut again |
| Only commands | type `>` first |
| Only windows in this project | type `@` first |
| Only projects | type `#` first |

## Terminal

| Action | Mac | Windows | Linux |
| --- | --- | --- | --- |
| Copy | ⌘C | Ctrl+Shift+C | Ctrl+Shift+C |
| Paste | ⌘V | Ctrl+V | Ctrl+Shift+V |
| Select all | ⌘A | Ctrl+Shift+A | Ctrl+Shift+A |
| Clear | ⌘K | Ctrl+Shift+K | Ctrl+Shift+K |
| Scroll back a page, or forward | Page Up, Page Down | Page Up, Page Down | Page Up, Page Down |

Page Up and Page Down go to the program instead in full-screen programs, or with ⇧ held.

## Canvas and drawings

These work when the canvas has the keys: click an empty spot first, so no terminal is focused. On Windows and Linux, Ctrl works as ⌘ does on a Mac here.

| Action | Mac | Windows and Linux |
| --- | --- | --- |
| Select everything | ⌘A | Ctrl+A |
| Copy | ⌘C | Ctrl+C |
| Cut drawings | ⌘X | Ctrl+X |
| Duplicate drawings | ⌘D | Ctrl+D |
| Undo | ⌘Z | Ctrl+Z |
| Redo | ⇧⌘Z or ⌘Y | Ctrl+Shift+Z or Ctrl+Y |
| Delete what's selected | ⌫ or Delete | Backspace or Delete |
| Deselect, or put the tool down | Esc | Esc |
| Nudge | Arrow keys (⇧ for 10×) | Arrow keys (Shift for 10×) |
| Bring to front | ] | ] |
| Send to back | [ | [ |
| Edit a note's or text's words | Enter | Enter |

### Tools

| Key | Tool |
| --- | --- |
| V | Select |
| H | Hand (pan) |
| N | Note |
| T | Text |
| R | Shape |
| A or L | Arrow |
| P | Pen |
| S | Section |

### With the mouse

| Action | Mac | Windows and Linux |
| --- | --- | --- |
| Zoom | Pinch, or ⌘ + wheel | Pinch, or Ctrl + wheel |
| Add a window to the selection, or take it out | ⇧-click its header | Shift-click its header |
| Select with a box | ⇧-drag on the canvas | Shift-drag on the canvas |
| Copy windows as you move them | ⌥-drag | Alt-drag |
| Move without snapping | ⌘-drag | |

## Editor

| Action | Mac | Windows and Linux |
| --- | --- | --- |
| Save | ⌘S | Ctrl+S |
| Find | ⌘F | Ctrl+F |
| Toggle comment | ⌘/ | Ctrl+/ |
| Format document | ⇧⌘I | Ctrl+Shift+I |

## Explorer

| Action | Mac | Windows and Linux |
| --- | --- | --- |
| Find files and folders by name | ⌘F | Ctrl+F |
| Move to the Trash | ⌘⌫ | Delete |
| Show a search result in its folder | ⌘↵ | Ctrl+Enter |

## Change a shortcut

Search for "Keyboard shortcuts" with ⌘K (Ctrl+K) and press Enter. The list opens on the **Settings** tab of **Workspace** (the app's own pieces) on the Plugins page. Every command is listed there, the app's and your plugins', with its keys.

- **Search** by a command's name or by its keys.
- **Add** a key to a command, or **remove** one. A new key must use ⌘, ⌃ or ⌥ (Ctrl or Alt on Windows and Linux), or be a function key.
- **Clashes** are shown when two commands have the same key. When they do, the command that belongs to the focused window's kind wins.
- **Reset all** puts every shortcut back.

Your shortcuts are kept on this computer. Plugins can add commands with shortcuts of their own; they show up in the same list.
