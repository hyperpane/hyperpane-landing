---
title: Projects
description: "Opening and switching projects, what a project keeps in its folder, and projects inside projects."
section: Using hyperpane
order: 11
---

# Projects

A project is a folder on a server, with one canvas. Everything you put on the canvas, and how you arranged it, belongs to the project.

## Where a project lives

A project lives on the server its folder is on. Its terminals and plugins run there too.

The project keeps its canvas in a `.hyperpane/` folder inside the project's folder. hyperpane makes that folder when you first add the project. Leave it there: it's what makes the folder a project.

## Make or add a project

Click **+** on the **Servers** card in the sidebar and choose **New project**, or search for "New project" with ⌘K (Ctrl+K on Windows and Linux). Pick the server, the folder and an optional name. The folder must be there already. If it's a project already, it simply opens.

[Your first project](/docs/first-project) walks through it step by step.

## The sidebar

The **Servers** card lists each server you're connected to, its projects under it, and the open project's windows under that. Drawings are grouped together.

- **Open** a project by clicking it. Its canvas replaces the one you had open.
- **Rename** it by double-clicking it, or from its menu.
- **Reorder** projects by dragging them, or with **Move up** and **Move down** in their menu.
- **New window:** the open project's **+** makes a window of any type.
- **Windows:** click one in the list to select it; **Show** in its menu brings it into view and focuses it. Double-click to rename it.

A project's menu also has:

- **Plugins**, to see and change the plugins installed in it (see [Plugins](/docs/plugins));
- **Close project**, to leave the canvas;
- **Remove from list**, which takes it off the server's list. Its folder, files and `.hyperpane/` stay as they are, so you can add it again later;
- an icon and a color for it, to tell projects apart in the sidebar.

## Switch quickly

Press ⌘K (Ctrl+K) and type a project's name. Start with `#` to search only projects. Projects on every server you're connected to are listed. See [Settings and themes](/docs/settings#search) for the other prefixes.

## Projects inside projects

A folder inside a project's folder can be a project of its own: a **sub-project**. Any folder inside the project that has its own `.hyperpane/` shows up nested under the project in the sidebar. hyperpane looks for them in each project's folder once a session, skipping folders like `.git` and `node_modules`.

To make one, create a new project on a folder inside an existing project.

The outermost project is the **head**. It owns the canvas, and its sub-projects are parts of it:

- **Click the head project** to see its whole canvas: every window, its sub-projects' too.
- **Click a sub-project** to see only its own windows (and those of the sub-projects inside it), on the same canvas. The other windows are hidden, not closed.
- **A new terminal** made while a sub-project is picked starts in the sub-project's folder, and belongs to it.

In the sidebar each sub-project shows its own windows under it, and folds with its arrow. A window belongs to the deepest sub-project whose folder it was opened in, otherwise to the head.

> Sub-projects are handy for a monorepo: keep one canvas for the whole repository, and narrow it to one package when you want to focus.

## Next

- [Servers](/docs/servers): projects on other machines.
- [The canvas](/docs/canvas).
