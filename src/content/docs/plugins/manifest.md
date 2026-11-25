---
title: plugin.json
description: "Every field of a plugin's manifest: its type, whether it's required, and what it does."
section: Plugins
order: 23
---

# plugin.json

Every plugin has a `plugin.json` at the root of its folder. It says what the plugin is (id, name, version), which parts it has (a client part, a server part, or both), and what it adds to the app: window types, cards, pages, panels, buttons, commands, menu items, settings and more.

The app checks `plugin.json` when it loads the plugin, and so does the SDK's checker. Run the checker yourself before you share a plugin; it prints every problem with its line:

```sh
node node_modules/@hyperpane/sdk/manifest/cli.js check .
```

The template's `./build.sh` runs it for you. The types are exported from `@hyperpane/sdk/manifest` (`PluginManifest`, `SettingSpec`, and the rest) if you want them in your own tools.

For the walkthrough, see [Writing a plugin](/docs/plugins/writing). For the APIs the fields switch on, see the [SDK reference](/docs/plugins/sdk).

## A full example

```json
{
  "manifest": 1,
  "id": "notes",
  "name": "Notes",
  "version": "0.1.0",
  "publisher": "you",
  "description": "Notes on the canvas that send their text along links, with an outline panel and pinned notes kept in the project.",
  "icon": "icon.svg",
  "category": "Productivity",
  "license": "MIT",
  "homepage": "https://github.com/you/hp-notes",
  "engines": { "hyperpane": ">=0.2.0", "node": ">=22.15.0" },
  "os": ["macos", "linux", "windows"],
  "dependencies": { "files": ">=0.1.5" },
  "uses": ["git"],
  "permissions": ["notifications"],
  "events": {
    "publish": ["notes.saved", "notes.new"],
    "subscribe": ["file.*", "git.commit"],
    "wake": false
  },
  "client": { "main": "main.tsx" },
  "server": {
    "runtime": "node",
    "main": "main.ts",
    "memory": 512,
    "schedules": [{ "id": "tidy", "cron": "0 3 * * *", "description": "Tidies old drafts", "timeout": 600 }]
  },
  "contributes": {
    "nodes": [
      {
        "kind": "note",
        "title": "Note",
        "icon": "icons/note.svg",
        "size": [320, 240],
        "data": { "text": "" },
        "ports": [
          { "id": "quote", "label": "Quote", "direction": "in", "type": "text", "max": 1 },
          { "id": "text", "label": "Text", "direction": "out", "type": "text" }
        ],
        "opens": [{ "glob": "*.note", "score": 2 }]
      }
    ],
    "cards": [
      {
        "id": "recent",
        "title": "Recent notes",
        "icon": "icons/note.svg",
        "place": "right",
        "order": 10,
        "actions": [{ "id": "refresh", "title": "Refresh", "icon": "icons/refresh.svg" }]
      }
    ],
    "pages": [{ "id": "all", "title": "All notes", "icon": "icons/note.svg" }],
    "panels": [{ "id": "outline", "title": "Outline", "icon": "icons/outline.svg", "side": "right", "width": 320 }],
    "buttons": [
      {
        "id": "new",
        "title": "New note",
        "icon": "icons/note.svg",
        "slot": "toolbar",
        "action": { "newNode": { "plugin": "notes", "kind": "note" } }
      },
      {
        "id": "outline",
        "title": "Outline",
        "icon": "icons/outline.svg",
        "slot": "sidebar",
        "action": { "togglePanel": "outline" },
        "default": false
      }
    ],
    "commands": [
      { "id": "find", "title": "Find in notes", "shortcut": "mod+shift+f" },
      { "id": "outline", "title": "Show the outline", "shortcut": "alt+o", "action": { "togglePanel": "outline" }, "when": { "plugin": "notes" } },
      { "id": "announce", "title": "Announce a new note", "action": { "publish": "notes.new" } }
    ],
    "menus": [
      {
        "where": "project",
        "label": "New note in ${project.name}",
        "action": { "newNode": { "plugin": "notes", "kind": "note" } }
      },
      { "where": "plugin", "when": { "plugin": "notes" }, "label": "All notes", "action": { "openPage": "all" } }
    ],
    "settings": [
      { "id": "fontSize", "title": "Text size", "description": "The size of the text in a Note.", "type": "number", "default": 14, "min": 10, "max": 32, "step": 1, "unit": "px", "group": "Notes" },
      {
        "id": "format",
        "title": "Format",
        "type": "enum",
        "default": "markdown",
        "options": [
          { "value": "markdown", "label": "Markdown" },
          { "value": "plain", "label": "Plain text" }
        ]
      },
      { "id": "folder", "title": "Folder", "type": "string", "default": "", "placeholderByOs": { "macos": "~/Notes", "windows": "C:/Notes" }, "when": { "setting": "format", "is": "markdown" } },
      { "id": "token", "title": "Sync token", "type": "secret", "default": "" }
    ]
  }
}
```

## Top-level fields

| Field | Type | Required | What it is |
|---|---|---|---|
| `manifest` | `1` | yes | The manifest format. Always `1`. |
| `id` | string | yes | The plugin's id: 2–32 characters, lowercase letters, digits and dashes, starting with a letter (`^[a-z][a-z0-9-]{1,31}$`). It must equal the plugin's folder name. These ids are reserved for the app: `hyperpane`, `core`, `app`, `sdk`, `plugins`, `workspace`, `themes`, `drawing`, `drawings`. |
| `name` | string | yes | The name people see, at most 40 characters. |
| `version` | string | yes | `x.y.z`, optionally with a pre-release (`0.1.5-beta.1`). The app compares versions when it looks for updates, so raise it with every release. |
| `publisher` | string | yes | Who made it. Not empty. |
| `description` | string | yes | What it does, at most 200 characters. Shown in Plugins under the name. |
| `icon` | string | no | A `.svg` inside the package (a 24-unit box, stroked, as Lucide draws icons). |
| `readme` | string | no | The file shown as the plugin's page in Plugins. Default `README.md`. |
| `category` | string | no | One of `Files`, `Code`, `Web`, `Data`, `DevOps`, `Productivity`, `Look`, `Other`. |
| `license` | string | no | The license, as its LICENSE file says (`MIT`). |
| `homepage` | string | no | Where it lives, usually its repository. |
| `engines` | object | no | `{ "hyperpane": ">=x.y.z", "node": ">=x.y.z" }`: the least app version and Node version it needs. Only the `>=x.y.z` form is accepted. Other keys are ignored with a warning. |
| `os` | string[] | no | Limits it to some of `macos`, `linux`, `windows`. Default: all three. |
| `dependencies` | object | no | Plugin id → `">=x.y.z"`. These are installed and turned on with your plugin. Their server parts (and those in `uses`) are the only other ones yours may call. A plugin can't depend on itself, and dependencies can't go round in a circle. |
| `uses` | string[] | no | Plugin ids it calls when they're there, without needing them: not installed with it. A call to one that isn't installed fails with a message saying so. Don't list a dependency here too. With the `control` permission, also the plugins whose windows it may open and drive. |
| `events` | object | no | What it may do on the event bus. See [events](#events). |
| `permissions` | string[] | no | What its parts may do beyond the sandbox. See [permissions](#permissions). |
| `api` | object[] | no | What its windows answer for other plugins that drive them. See [api](#api). |
| `client` | object | one of `client`/`server` | The client part. See [client](#client). |
| `server` | object | one of `client`/`server` | The server part. See [server](#server). |
| `points` | object[] | no | Extension points other plugins can contribute to. See [points](#points). |
| `contributes` | object | no | What it adds to the app. See [contributes](#contributes). |
| `signature` | object | no | The publisher's signature of the package. See [signature](#signature). |

A package needs a `client` part, a `server` part, or both.

## client

```json
"client": { "main": "main.tsx", "styles": ["extra.css"], "tailwind": true }
```

| Field | Type | Required | What it is |
|---|---|---|---|
| `main` | string | yes | The entry file, relative to `src/client/`: a `.ts`, `.tsx`, `.js` or `.jsx` file. The build bundles from it into `dist/client/`. |
| `styles` | string[] | no | `.css` files in `src/client/` loaded into every frame. |
| `tailwind` | boolean | no | Default `true`: the app compiles the Tailwind classes your client code uses against its theme. `false` gets the UI kit's precompiled stylesheet instead. |

Every view of the client part (node, card, page, panel, overlay, footer item, dialog) needs `client.main`. A package that declares any of those without a client part fails the check.

## server

```json
"server": { "runtime": "node", "main": "main.ts", "memory": 512, "schedules": [] }
```

| Field | Type | Required | What it is |
|---|---|---|---|
| `runtime` | `"node"` | yes | The only runtime. |
| `main` | string | yes | The entry file, relative to `src/server/`: a `.ts`, `.js` or `.mjs` file. The build bundles from it into `dist/server/main.mjs`, which is what servers run. |
| `memory` | number | no | Memory for the process, in whole MiB. Default 512, at most 4096. |
| `schedules` | object[] | no | Scheduled jobs. See below. |

`src/server/package.json` must exist and say `"type": "module"`.

### schedules

Jobs the server runs on a timer, even with nobody connected. Handle them with `host.onSchedule(id, …)` or `json({ schedules: { … } })` (see the [SDK reference](/docs/plugins/sdk#scheduled-jobs)).

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | `^[a-z][a-z0-9-]{0,31}$`, unique in the part. |
| `cron` | string | yes | Five fields (minute, hour, day of the month, month, day of the week) in the server's local time, or `@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`. At most 100 characters. |
| `description` | string | no | What it does, shown on the Plugins page. At most 200 characters. |
| `timeout` | number | no | Seconds a run may take before it's cancelled: 1 to 86400. Default 3600 (an hour). |

At most 16 jobs per part.

## events

```json
"events": { "publish": ["notes.saved"], "subscribe": ["file.*", "git.commit"], "wake": true }
```

| Field | Type | Required | What it is |
|---|---|---|---|
| `publish` | string[] | no | Topics it publishes, and asks with `bus.request`. |
| `subscribe` | string[] | no | Patterns it subscribes to: a topic, `prefix.*`, or `*`. |
| `wake` | boolean | no | Default `false`. `true` starts the server part when an event it subscribes to arrives while it's stopped. Needs a server part. |

Both parts are held to these lists. Anything else is refused at run time ("Notes can't publish “x”: it isn't in events.publish in Notes's plugin.json.").

## permissions

What the plugin may do beyond the sandbox. The user sees them before installing. A server part needs none of these to reach files or the network; they're about the app and the operating system.

| Permission | What it allows |
|---|---|
| `network` | Its frames reach the network: https and wss anywhere, http and ws on this computer. Without it, frames have no network and go through the server part. |
| `clipboard-read` | Reading the clipboard (`host.app.clipboardRead`): text, HTML and images. |
| `canvas` | Seeing the canvas: its view, the pointer, the selection, the project's windows and drawings (`host.canvas`). Needed for `contributes.overlays`. |
| `canvas-edit` | Changing the canvas: moving, resizing and raising windows, drawing, changing and erasing drawings, from frames and the server part. |
| `terminal` | Driving the project's terminals (`host.terminals`): list, open, type, run, read, watch. |
| `editor` | Reading the files open in Editors, their selection, and watching them change (`host.editors`). |
| `editor-write` | With `editor`: editing their text and setting the selection. |
| `webview` | Real web pages inside its frames (`host.web`). Desktop app only. |
| `webview-control` | With `webview`: reading and driving the pages it shows (`host.web.run`, a script in the page; `host.web.capture`, a picture of it), so it can offer them to the plugins that control it. Shown as a warning at install. |
| `control` | Opening windows of the plugins in its `uses` and `dependencies` and calling what they offer (`host.windows`). Shown as a warning at install. |
| `camera`, `microphone`, `screen` | Its frames may ask for the camera, the microphone, and a screen or window to capture (`host.media`). Shown as warnings at install, and the app still asks the person the first time each is used. |
| `notifications` | System notifications (`host.app.notify`, and a server part's `host.notify` with `native: true`). |
| `global-shortcuts` | Keys that run its commands from any app (`contributes.globalShortcuts`). |
| `tray` | Items in the tray's menu (`contributes.tray`) and a count on the app's badge (`host.app.setBadge`). |
| `deep-links` | Links to the plugin (`hyperpane://plugin/<id>/…`) reach its frames as `link` events. |
| `oauth` | Signing in with OAuth in the person's browser (`host.app.authorize`, a server part's `host.authorize`). |

## api

What the plugin's windows answer for other plugins. A plugin with the `control` permission and this one in its `uses` opens one of its windows (`host.windows.open`) and calls these methods (`host.windows.call`, `host.windows.subscribe`); the window's frame answers with `host.serve`. Anything not listed here is refused before it reaches the frame. An AI plugin hands these to a model as tools, so say plainly what each does, takes and answers.

```json
"api": [
  {
    "name": "open",
    "description": "Goes to a page; answers once it has loaded: { url, title, loading }.",
    "args": { "type": "object", "properties": { "url": { "type": "string" } }, "required": ["url"] }
  },
  { "name": "watch", "description": "Where the page goes, as it goes.", "stream": true }
]
```

| Field | Type | Required | What it is |
|---|---|---|---|
| `name` | string | yes | What callers name it: letters and digits, starting with a lowercase letter (`open`, `readText`), at most 40. Unique in the list. |
| `description` | string | yes | What it does, what it takes and what it answers, at most 500 characters. |
| `args` | object | no | Its arguments, as a JSON Schema object. |
| `stream` | boolean | no | `true`: it answers with values as they come (`host.windows.subscribe`), not once. |

At most 64 methods. Only windows answer, so a plugin with `api` needs a client part. The Browser's plugin.json is a full example: it lists `open`, `state`, `text`, `elements`, `click`, `type`, `screenshot`, `watch` and more.

## points

Extension points other plugins contribute to. Other plugins address a point as `<your id>.<point id>` in their `contributes`.

```json
"points": [
  { "id": "checks", "title": "Checks", "schema": { "type": "object", "required": ["call"] } }
]
```

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | `^[a-z][a-z0-9-]{0,31}$`, unique. |
| `title` | string | yes | What the user sees it called, at most 60 characters. |
| `description` | string | no | What it's for. |
| `schema` | object | no | A JSON Schema subset each contributed item must match: `type`, `properties`, `required`, `additionalProperties`, `items`, `enum`, `const`, `pattern`, `minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `maxItems`, `anyOf` (`title` and `description` are notes). Items that don't match are left out, with a warning. |

At most 32 points per plugin.

## contributes

| Key | Type | What it adds |
|---|---|---|
| `nodes` | object[] | Window types for the canvas. |
| `cards` | object[] | Cards in the sidebars (and on the canvas). |
| `pages` | object[] | Pages of their own in the app. |
| `panels` | object[] | Panels docked at the left or right edge of the canvas. Up to 4. |
| `overlays` | object[] | Clear frames over the whole canvas. Up to 2. Needs `canvas`. |
| `footer` | object[] | Items in the app's footer. |
| `buttons` | object[] | Icon buttons in the app's frame. Up to 8. |
| `commands` | object[] | Entries in the command palette, with shortcuts. Up to 32. |
| `menus` | object[] | Items in the app's right-click menus. |
| `settings` | object[] | Settings on the plugin's page in Plugins. |
| `globalShortcuts` | object[] | Keys that work while the app isn't in front. Up to 8. Needs `global-shortcuts`. |
| `tray` | object[] | Items in the tray's menu. Up to 8. Needs `tray`. |
| `"<plugin>.<point>"` | object[] | Items for another plugin's extension point, up to 64. An item with `call` is a provider: `call` names an op of your server part, which the point's owner calls. |

Unknown keys without a dot are ignored, with a warning. Ids for buttons, panels, overlays, commands, global shortcuts and tray items are `^[a-z][a-z0-9-]{0,31}$`, unique within their list. Every icon is a `.svg` inside the package, and the icons of buttons, panels and commands must be at most 64 KB.

### nodes

| Field | Type | Required | What it is |
|---|---|---|---|
| `kind` | string | yes | The window type's id, unique in the plugin. Empty for the plugin's main type. Your client part reads it as `host.view.kind`. |
| `title` | string | yes | Its name in the app's "New …" menus and the window's default title. |
| `icon` | string | yes | A `.svg` in the package. |
| `size` | `[number, number]` | no | Width and height when it's made, in canvas units. |
| `ports` | object[] | no | Its connectors. See below. |
| `data` | object | no | Shared data a new window starts with: names to strings. |
| `opens` | object[] | no | Files it opens: `[{ "glob": "*.md", "score": 1 }]`, matched case-insensitively on the file name. The type with the highest score opens the file. |
| `creatable` | boolean | no | `false` keeps it out of the "New …" menus. Default `true`. |
| `guarded` | boolean | no | The app asks the window before it closes (for `win.setCloseQuestion`). |

#### ports

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique among the type's ports in its direction (an in-port and an out-port may share an id). |
| `label` | string | yes | Its name on the window. |
| `direction` | `"in"` or `"out"` | yes | Values come in, or go out. |
| `type` | string | yes | What flows: `text`, `path`, `json`, `any`, or a type of your own (`git.commit`). An out-port links only to an in-port of the same type, or `any`. |
| `max` | number | no | How many links it takes, a whole number above 0. |

### cards

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique in the plugin. `host.view.id` in the frame. |
| `title` | string | yes | Its header. |
| `icon` | string | no | A `.svg` in the package. |
| `place` | `"left"`, `"right"` or `"bottom"` | yes | Where it goes until the user moves it. |
| `order` | number | no | Its position in its place, smaller first. |
| `grow` | boolean | no | Takes the room left in its place, rather than its content's height. |
| `actions` | object[] | no | Buttons in its header: `[{ "id", "title", "icon" }]`, all three required. Pressing one sends an `action` event (`{ id }`) to the card's frame. |

### pages

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique in the plugin. `host.view.id` in the frame. |
| `title` | string | yes | Its name. |
| `icon` | string | yes | A `.svg` in the package. |
| `order` | number | no | Its position among pages, smaller first. |

A page is opened by an `openPage` action (a button, command or menu item) or by `host.app.openPage(id)`.

### panels

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique among its panels. |
| `title` | string | yes | Its header and its icon's tooltip, at most 60 characters. |
| `icon` | string | yes | A `.svg` in the package, at most 64 KB: its icon in the edge's strip. |
| `side` | `"left"` or `"right"` | yes | Which edge of the canvas. |
| `order` | number | no | Its position in the strip. |
| `width` | number | no | Its width at first, 200–800 px. Default 320. The user's width is kept. |
| `default` | boolean | no | `false`: not in the strip until the user turns it on. Default `true`. |

### overlays

Clear frames over the whole canvas, above its windows. The pointer goes through except over the rectangles the overlay marks with `host.overlay.setHitAreas`. Needs the `canvas` permission.

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique among its overlays. |
| `title` | string | yes | What the user sees it called (to hide it), at most 60 characters. |
| `order` | number | no | Its place among overlays, smaller below. |
| `default` | boolean | no | `false`: hidden until the user turns it on. Default `true`. |

### footer

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique in the plugin. |
| `align` | `"start"` or `"end"` | yes | Which end of the footer. |
| `order` | number | no | Its position, smaller first. |

A footer item can set its width with `host.ui.size({ width })`, up to 320 px.

### buttons

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique among its buttons. |
| `title` | string | yes | Its tooltip, at most 60 characters. |
| `icon` | string | yes | A `.svg` in the package (a 24-unit box, stroked), at most 64 KB. |
| `slot` | `"sidebar"`, `"toolbar"` or `"footer"` | yes | `sidebar`: the right end of the title bar. `toolbar`: the canvas's toolbar, beside the drawing tools. `footer`: the footer's right side. |
| `order` | number | no | Its position in its slot, smaller first. |
| `default` | boolean | no | `false`: hidden until the user turns it on. Default `true`. |
| `when` | object | no | `{ "plugin", "kind" }`: shown only while the focused window is that plugin's (and kind's). |
| `action` | object | no | What pressing it does. See [actions](#actions). Without one, the plugin's open frames get a `button` event (`{ id, slot, window }`, `window` being the focused window's id or null), so the plugin needs a client part. |

The user can hide any button or panel (right-click, Hide, or on the plugin's page in Plugins).

### commands

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique among its commands. |
| `title` | string | yes | What the palette lists, at most 60 characters. |
| `icon` | string | no | A `.svg` in the package, at most 64 KB. |
| `shortcut` | string | no | Its key until the user picks another. See below. |
| `when` | object | no | `{ "plugin", "kind" }`: offered only while such a window is focused; its key then wins over another command's. |
| `action` | object | no | As a button's. Without one, the plugin's open frames get a `command` event (`{ id, window }`). |

A shortcut is `+`-joined with the key last: `mod+shift+f`, `ctrl+alt+[`, `alt+f5`, `mod+=`. `mod` is ⌘ on a Mac and Ctrl+Shift on Windows and Linux, as the app's own shortcuts are. A key needs `mod`, `ctrl`, `alt` or `meta`, except F1–F24. Keys are letters, digits, `` = - [ ] \ / ; ' , . ` ``, and `enter`, `escape`, `tab`, `space`, `backspace`, `delete`, `insert`, `home`, `end`, `pageup`, `pagedown`, `up`, `down`, `left`, `right`, `f1`–`f24`. The user can change or remove every command's keys.

### actions

What a button or a command does. One of:

| Action | What it does |
|---|---|
| `{ "newNode": { "plugin", "kind", "data"?, "state"?, "server"? } }` | Opens a window of that type. `data` and `state` map names to strings. |
| `{ "openPage": "<page id>" }` | Opens one of the plugin's pages (`"plugins"` opens the Plugins page). |
| `{ "togglePanel": "<panel id>" }` | Shows or hides one of its panels. |
| `{ "publish": "<topic>" }` | Publishes an event on the open project's bus, with `{ "button": id, "window": id|null }` (or `{ "command": id, "window": id|null }`) as data; `window` is the focused window. The topic must be in `events.publish`. Your server part hears it too (started for it with `events.wake`). |

### menus

Items in the app's right-click menus. `where` is a `MenuWhere`:

| `where` | The menu |
|---|---|
| `window` | A window's menu, on the canvas and its row in the sidebar. |
| `canvas` | The canvas's, right-clicked where there's no window. |
| `server` | A server's, in the sidebar. |
| `project` | A project's, in the sidebar. |
| `plugin` | A plugin's card or page in the sidebar. |
| `sidebar` | The sidebar's own, right-clicked where nothing else is. |

`window` and `canvas` items come from the plugins on in the open project. `server`, `project`, `plugin` and `sidebar` items come from every installed plugin.

| Field | Type | Required | What it is |
|---|---|---|---|
| `where` | string | yes | One of the above. |
| `when` | object | no | Only for `window` (`{ "plugin", "kind" }`) and `plugin` (`{ "plugin" }`) menus: shows the item only for that plugin's windows (or kind), or that plugin's card or page. |
| `label` | string | yes | The item's text. |
| `action` | object | yes | `{ "newNode": { "plugin", "kind", "data"?, "state"?, "server"? } }`, `{ "openPage": "<page id>" }`, or `{ "publish": "<topic>" }`: an event on the open project's bus with `{ menu, window, project, server, plugin, at }` (what it was chosen on; `window` is the right-clicked window's id or null). The topic must be in `events.publish`. |

Strings in a menu item can use values from where it was opened:

| Placeholder | Where |
|---|---|
| `${window.id}`, `${window.plugin}`, `${window.kind}`, `${window.title}`, `${window.data.KEY}`, `${window.server}` | A window's menu: the window right-clicked. |
| `${server.id}`, `${server.name}`, `${server.home}` | A server's menu, and a project's server. |
| `${project.id}`, `${project.name}`, `${project.folder}`, `${project.server}` | The project's (the open one's, except in a project's menu). |
| `${plugin.id}`, `${plugin.name}` | A plugin's card or page. |
| `${at.x}`, `${at.y}` | The canvas's: where it was right-clicked. |

`${a|b}` takes the first one that isn't empty. `newNode` opens the window in the open project, on the item's server (in a server's or a project's menu) unless `server` says otherwise. From a project's menu, that project is opened first.

```json
{
  "where": "window",
  "when": { "plugin": "explorer" },
  "label": "Count lines here",
  "action": { "newNode": { "plugin": "codestats", "kind": "codestats", "data": { "path": "${window.data.folder}" } } }
}
```

### settings

Settings appear on the plugin's page in Plugins. The user sets them in the app; both parts read them (`useSetting`, `host.settings`).

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique in the plugin. |
| `title` | string | yes | Its label. |
| `description` | string | no | What it changes, and when it applies. |
| `type` | string | yes | `boolean`, `number`, `string`, `text` (several lines), `enum`, or `secret` (hidden as it's typed). |
| `default` | boolean, number or string | yes | Must fit the type: a boolean for `boolean`, a number for `number`, a string otherwise. For `enum`, one of its options' values. |
| `options` | object[] | for `enum` | `[{ "value", "label" }]`. With `optionsFrom`, the ones shown until the server part answers. |
| `optionsFrom` | object | no | `enum` only: choices from your server part. See below. |
| `min`, `max`, `step` | number | no | For `number`. |
| `unit` | string | no | Shown after a number (`px`, `ms`). |
| `placeholder` | string | no | The field's placeholder. |
| `placeholderByOs` | object | no | The placeholder by the server's system: `{ "macos": "/bin/zsh", "windows": "pwsh.exe" }`, over `placeholder`. |
| `when` | object | no | `{ "setting": "<id>", "is": value or [values] }`: shown only while another of its settings has that value. |
| `group` | string | no | A heading to group settings under. |

`optionsFrom` asks your server part for the choices, at most every 10 seconds while the setting is shown:

```json
"optionsFrom": {
  "request": { "op": "shells" },
  "value": "id",
  "label": "name",
  "after": "",
  "fallback": { "windows": [{ "value": "pwsh.exe", "label": "PowerShell" }] }
}
```

`request` is the call's payload. `value` and `label` name the fields of each item in the reply (a list). The items go after the option whose value is `after`, else after all of `options`. `fallback` is shown, by the server's system, when the server part can't answer.

Settings of type `secret` are kept on the server. For credentials your plugin manages itself, use `host.secrets` in the server part instead.

### globalShortcuts

Keys that run one of the plugin's commands from any app, while hyperpane runs and the plugin is on in the open project. Needs the `global-shortcuts` permission.

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique among its global shortcuts. |
| `title` | string | yes | What the person sees it called, at most 60 characters. |
| `default` | string | no | Its key until the person picks another, as a command's shortcut. None: off until the person gives it one. |
| `command` | string | no | The command it runs (one of `contributes.commands`). Default: the one with its own id. |
| `background` | boolean | no | `true`: the app stays where it is. Default `false`: the app comes to the front first. |

### tray

Items in the tray's menu (the menu bar icon on a Mac), under the plugin's name. Needs the `tray` permission.

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | string | yes | Unique among its tray items. |
| `title` | string | yes | Its label, at most 60 characters. |
| `command` | string | no | The command it runs. Default: the one with its own id. |
| `background` | boolean | no | As a global shortcut's. |

## signature

```json
"signature": { "key": "…", "sig": "…", "server": "…" }
```

The publisher's signature of the package. The SDK's signing tool writes it; never edit it by hand. `sig` covers every file of the package, and `server` covers its server part (`plugin.json`, `src/server`, `src/shared`).

What the app does with it:

- Built-in plugins are signed by hyperpane.
- A signed plugin shows as **Verified** once the user trusts its publisher.
- An unsigned plugin still installs, with a warning.
- A package whose files changed after it was signed is refused, by the app and by servers. If you sign, sign last: any later change, including the version, needs a new signature.

## Limits

| What | At most |
|---|---|
| `plugin.json` | 256 KB |
| Files under `src/` | 20,000 |
| Bytes under `src/` | 256 MiB |
| A path inside the package | 200 bytes (UTF-8) |
| Button, panel and command icons | 64 KB each |
| Buttons / panels / overlays / commands | 8 / 4 / 2 / 32 |
| Global shortcuts / tray items | 8 / 8 |
| Points / items for one point | 32 / 64 |
| Scheduled jobs | 16 |
| Titles of buttons, panels, overlays, commands, points | 60 characters |
