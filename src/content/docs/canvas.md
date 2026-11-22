---
title: The canvas
description: "Moving around, arranging windows, drawings on the canvas, and links between windows."
section: Using hyperpane
order: 10
---

# The canvas

Each project has one canvas: an endless surface you pan and zoom, with your windows on it. Everything you do to it (where windows are, their sizes, your drawings and links) is kept with the project and comes back when you open it.

## Moving around

- **Pan:** drag an empty part of the canvas. On a touchpad, scroll with two fingers.
- **Zoom:** pinch on a touchpad, or hold ⌘ (Ctrl on Windows and Linux) and turn the mouse wheel. The keys are ⌘= and ⌘- (Ctrl+= and Ctrl+-).
- **Actual size:** ⌘0 (Ctrl+0).
- **See everything:** ⌘1 (Ctrl+Shift+1) fits every window in view.
- **Zoom to a window:** ⌘2 (Ctrl+Shift+2) fits the focused window.

The footer shows the current zoom, with buttons to change it.

A mouse wheel on its own zooms on Windows and Linux and moves the canvas on a Mac. You can change that, and turn on smooth zoom and inertia, in [Settings](/docs/settings).

## Windows

- **Focus a window** by clicking in it. The focused window gets your keys.
- **Move** a window by dragging its header. **Resize** it by dragging an edge.
- **Snapping:** a dragged window snaps to the edges of the others, with guides that show how. On a Mac, hold ⌘ while dragging to place it freely.
- **Copy** windows by holding ⌥ (Alt) as you start dragging: copies stay where they were.
- **Select several:** ⇧-click headers, or ⇧-drag across an empty area to select everything in a box (with the Select tool, a plain drag does it). Dragging one moves them all.
- **Close** a window with the × on its header.

A terminal takes the scroll wheel only once it's focused, so scrolling across the canvas doesn't get caught by every terminal you pass. Turn on **Scroll Without Focus** in its ⋯ menu to let it scroll right away.

### A window's menus

The **⋯** on a window's header, or a right-click on it, has:

- **Header color:** tint the header with a color, to tell windows apart at a glance. Pick a swatch, any color, or none to use the theme's.
- **Scroll Without Focus.**
- **Screenshot:** a picture of the window, to the clipboard or a file (see [Settings](/docs/settings)).
- **Connect** and **Disconnect all**, for windows with ports.
- **Close.**

Plugins add items of their own to these menus.

### Right-clicking the canvas

A right-click on an empty spot offers **New …** for every kind of window in the project, placed where you clicked, along with **Plugins** to add more, and options to add a note, text or a section there.

## Drawings

Next to your windows you can draw: sticky notes, text, shapes, arrows, pen strokes and sections (frames that group what's in them). The toolbar at the bottom of the canvas has the tools, and each has a key you can press when the canvas has focus:

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

With drawings selected:

- Arrow keys nudge them (with ⇧, ten times as far).
- ] brings them to the front, [ sends them to the back.
- Enter edits a note's or a text's words.
- ⌘D duplicates, ⌘X cuts, Delete or Backspace removes them.
- ⌘Z undoes, ⇧⌘Z or ⌘Y redoes.

On Windows and Linux, use Ctrl for ⌘ in these keys. Arrows can attach to windows and follow them as they move. A drawing can be locked so it doesn't move by accident.

You can hide the toolbar, and choose the color new notes get, in [Settings](/docs/settings). The tools' keys work either way.

## Links between windows

Some windows have **ports**: inputs on the left, outputs on the right. Linking an output to an input sends values from one window to the other. For example, an Explorer has **Folder** and **Selected** outputs, and a Terminal has a **Path** input: link them and the terminal `cd`s to that folder.

- **Link:** drag from a port to a port, or choose **Connect** in a window's menu and switch on the links you want.
- **See every port:** turn on **Nodes mode** (its button sits beside the hand and pointer tools, or search for "Nodes mode" with ⌘K). It shows every window's ports with their names.
- **Change a link:** click it to give it a color, or to **Disconnect** it. Select it and press Delete to remove it. Drag a link to route it a different way; **Reset path** puts it back.

## Next

- [Projects](/docs/projects): switching between canvases, and projects inside projects.
- [Keyboard shortcuts](/docs/shortcuts): every key in one table.
