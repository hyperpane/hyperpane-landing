---
title: RPC
description: "The message protocol between a plugin's window and the app: every method, event, stream and error."
section: Reference
order: 30
---

# RPC

A plugin's client part runs in a **frame**: an isolated, sandboxed web page with an origin of its own (see [Where a frame comes from](#where-a-frame-comes-from)), shown in a window on the canvas, a card, a page, a panel, an overlay or a dialog. Everything the frame does outside itself goes through this RPC, which it speaks with the app over a `MessagePort`: calling its server part (and other plugins'), changing its window, showing menus and dialogs, reading the canvas, driving terminals and editors.

You rarely speak it by hand. `@hyperpane/sdk/client` implements the frame's side, and its `host` object wraps every method on this page (see the [SDK reference](/docs/plugins/sdk) and [Writing a plugin](/docs/plugins/writing)). This page is the contract underneath: what crosses the port, what each method takes and returns, and how it fails.

- **Version:** the RPC is version `1` (`api: 1`).
- **Below it:** the app forwards `server.*` calls to a server over the [wire protocol](/docs/reference/protocol), where your plugin's server part answers them.
- **From a terminal:** the [command line](/docs/reference/cli) makes the same plugin calls without a frame: `hyperpane call <plugin> '<json>'`.

## Overview

| Concept | What it is |
|---|---|
| **Request** | The frame sends `req` with an `id`, a method name `m` and arguments `a`. The app answers each with exactly one `res`. |
| **Subscription** | A request whose `res` says it started, followed by any number of `sub` messages and one `subEnd`. The frame ends it with `cancel`. |
| **Stream call** | A request whose request or reply carries a stream of bytes, sent as `chunk`s with credit-based flow control. |
| **Event** | An `ev` message the app sends on its own: the theme changed, a value arrived at a port, the window is closing. |
| **Ask** | The app asks the frame something (`ask`), and the frame answers (`answer`). Used for the Editor's text. |

Messages are plain objects sent with `postMessage` and structured cloning: there are no JSON strings on the port, and `Uint8Array` and `ArrayBuffer` values arrive as they are.

## Where a frame comes from

The app has no plugins of its own. A frame's files are its plugin's built interface (`dist/client/`), which the app gets from the plugin's server, file by file, with the store's [`client_file`](/docs/reference/protocol), checking each against the sha256 in the interface's `client.json`. Each plugin on each server has its own origin:

| App | A frame's address |
| --- | --- |
| Desktop | `plugin://<plugin>.<server>/`: Electron's handler asks the app for each file, which fetches it from the server. |
| Web | `https://<plugin>--<server>.plugins.<the app's host>/`: a small page there asks the app for the files, keeps them in the browser's cache by the interface's hash, and a service worker serves them. |

`<server>` is the server's id. The query says which view it is and which interface: `?v=<view>&k=<kind>&w=<window>&i=<instance>&h=<hash>`. When the plugin is rebuilt on the server, its hash changes, and its frames load again with the new files.

## Connecting

1. The app creates the iframe at the frame's address (above).

2. On the iframe's `load` event, the app creates a `MessageChannel` and transfers one port to the frame:

   ```ts
   iframe.contentWindow.postMessage({ hyperpane: 'connect', api: 1 }, frameOrigin, [port2]);
   ```

   The SDK accepts this message only once, only when `event.source === window.parent`, `data.hyperpane === 'connect'` and a port is attached. The frame's Content Security Policy (`frame-ancestors`) ensures the parent is the app.

3. The frame says hello on the port:

   ```json
   { "t": "hello", "api": 1, "sdk": "0.2.6", "batch": true }
   ```

   `sdk` is the SDK's version, for logs. `batch: true` says the frame accepts `batch` messages.

4. The app answers with `init`. It sends nothing else before it.

   ```json
   { "t": "init", "v": { "api": 1, "appVersion": "0.2.6", "plugin": { "id": "notes", "version": "1.0.0" }, "...": "..." } }
   ```

   An app that doesn't speak `api` 1 answers `{ "t": "init", "v": null, "error": "…" }`, and the SDK shows that message.

From then on, either side may send any message below.

## Messages

### From the frame

```ts
type FromFrame =
  | { t: 'hello'; api: 1; sdk: string; batch?: boolean }
  | { t: 'batch'; m: FromFrame[] }
  | { t: 'req'; id: number; m: string; a?: unknown }
  | { t: 'cancel'; id: number }
  | { t: 'ping' }
  | { t: 'log'; level: 'error' | 'warn' | 'info'; message: string; stack?: string }
  | { t: 'chunk'; id: number; data: Uint8Array }
  | { t: 'streamEnd'; id: number; error?: string }
  | { t: 'credit'; id: number; bytes: number }
  | { t: 'answer'; id: number; ok: boolean; v?: unknown; error?: string; more?: boolean };
```

| `t` | Meaning |
|---|---|
| `hello` | The first message (see [Connecting](#connecting)). |
| `batch` | Several messages, to be handled in order. |
| `req` | Calls method `m` with arguments `a`. |
| `cancel` | Ends a subscription, a stream call, a waiting `terminal.run`, or a `points.call`, by its request id. |
| `ping` | Sent every 2 seconds. |
| `log` | A log line; the app prints it as `[plugin <id>] …`. The SDK sends uncaught errors and unhandled rejections this way, with `level: 'error'` and the stack. |
| `chunk` | Bytes of a stream call's upload. |
| `streamEnd` | The upload's end, or `error` if the frame's source failed. |
| `credit` | The download may send this many more bytes. |
| `answer` | The frame's answer to an `ask`. |

### From the app

```ts
type ToFrame =
  | { t: 'init'; v: Init }
  | { t: 'res'; id: number; ok: true; v?: unknown; stream?: { at: (string | number)[] } }
  | { t: 'res'; id: number; ok: false; error: string }
  | { t: 'sub'; id: number; v: unknown }
  | { t: 'subEnd'; id: number; error?: string }
  | { t: 'chunk'; id: number; data: Uint8Array }
  | { t: 'streamEnd'; id: number; error?: string }
  | { t: 'credit'; id: number; bytes: number }
  | { t: 'streamCancel'; id: number; reason?: string }
  | { t: 'ev'; e: string; v: unknown }
  | { t: 'ask'; id: number; m: string; a?: unknown; from?: { plugin: string; window?: number } }
  | { t: 'askCancel'; id: number }
  | { t: 'pong' }
  | { t: 'batch'; m: ToFrame[] };
```

| `t` | Meaning |
|---|---|
| `init` | The frame's starting state (see [`Init`](#init)). |
| `res` | The answer to a `req`: `ok: true` with an optional result `v`, or `ok: false` with an `error`. |
| `sub` | One event of a subscription. |
| `subEnd` | The subscription ended; `error` says why when it failed. |
| `chunk` | Bytes of a stream call's download. |
| `streamEnd` | The download's end, or `error` if it didn't all arrive. |
| `credit` | The upload may send this many more bytes. |
| `streamCancel` | The upload is no longer read. |
| `ev` | An [event](#events). |
| `ask` / `askCancel` | The app asks the frame something, or gives up asking (see [The app asks a frame](#the-app-asks-a-frame)). |
| `pong` | The answer to `ping`. |
| `batch` | Several messages, to be handled in order. |

### Rules

- **Ids** belong to the frame and count up from 1. Every `req` gets exactly one `res`, including methods with nothing to return (`ok: true` without `v`). The SDK turns `ok: false` into a rejected promise; for methods it doesn't wait on, into a `log` line.
- **Batches.** Each `postMessage` crosses a process boundary, so each side sends everything it has in one turn of its event loop as a single `batch`. The app batches only for a frame whose hello said `batch: true`; the SDK batches only when `init.batch` is true. A batch never contains `init`, `hello`, or another batch.
- **Pings.** The frame sends `ping` every 2 seconds and the app answers `pong`. A visible frame that sends nothing for 6 seconds is shown as not responding.
- **Unknown events are ignored**, so the app can add new ones.
- **Coordinates** (`x`, `y`) are CSS pixels in the frame's viewport, unless a method says canvas units; the app maps them through the window's position and the canvas's zoom.

## `Init`

```ts
interface Init {
  api: 1;
  appVersion: string;                       // the SDK files are served under /@sdk/<appVersion>/
  plugin: { id: string; version: string };
  view:
    | { type: 'node'; kind: string; window: WindowInfo }
    | { type: 'card'; id: string; place: 'left' | 'right' | 'bottom' | 'canvas'; window?: WindowInfo }
    | { type: 'page'; id: string }
    | { type: 'footer'; id: string }
    | { type: 'panel'; id: string; side: 'left' | 'right' }
    | { type: 'overlay'; id: string }
    | { type: 'dialog'; view: string; data: unknown };
  project: ProjectInfo | null;
  servers: ServerInfo[];
  theme: { id: string; dark: boolean; vars: Record<string, string> };
  locale: 'en-US';
  platform: { os: 'mac' | 'windows' | 'linux'; desktop: boolean; machine: string; thisMachine: string };
  settings: Record<string, unknown>;        // this plugin's settings, defaults filled in
  inputs: Record<string, { value: unknown; link: Link }[]>;   // the latest value at each in-port, per link
  links: Link[];                            // the project's links to and from this window
  focused: boolean;                         // the window has the keyboard
  scroll: boolean;                          // its header's scroll switch is on
  zoom: number;                             // the canvas's zoom (1 = 100%)
  shortcuts: Shortcut[];                    // the app's shortcuts, to hand back with input.key
  permissions?: string[];                   // the permissions the user granted
  ports?: PortSpec[];                       // its window's ports
  batch?: boolean;                          // the app accepts batch messages
  canvas?: { view: { x: number; y: number; zoom: number }; selection: number[] };  // with `canvas`
  points?: Record<string, Contribution[]>;  // contributions to this plugin's extension points
}

interface WindowInfo { id: number; title: string; named: boolean; plugin: string; kind: string;
                       data: Record<string, string>; server: string | null }
interface ProjectInfo { id: string; name: string; folder: string; server: string; plugins: string[];
                        windows: { id: number; plugin: string; kind: string; title: string; server: string | null;
                                   data?: Record<string, string> /* only this plugin's */ }[] }
interface ServerInfo { id: string; name: string; local: boolean; status: string; os: string | null;
                       target: string | null; part: { version: string; status: string } | null }
interface Link { id: number; from: { window: number; port: string }; to: { window: number; port: string } }
interface PortSpec { id: string; label: string; direction: 'in' | 'out'; type: string; max?: number }
interface Shortcut { id: string; code: string; meta: boolean; ctrl: boolean; alt: boolean; shift: boolean }
```

| Field | Notes |
|---|---|
| `view` | Where the frame is shown. A `panel` is docked at the left or right edge of the canvas; like a card in a sidebar, an overlay, or a page, it has no window, so `links`, `inputs` and `ports` are empty. |
| `theme.vars` | CSS custom properties: the app's color tokens (`--background`, `--foreground`, …), `--node-bg`, `--node-fg`, `--node-muted`, `--node-border`, `--node-header`, `--node-accent`, `--node-selection`, and `--ansi-0` … `--ansi-15`. The SDK sets them on `:root`, toggles the `dark` class on `<html>`, and sets `color-scheme`. |
| `servers[].part` | This plugin's server part on that server, or `null` when it isn't installed there. |
| `permissions` | The permissions the user approved (not merely those `plugin.json` asks for): `canvas`, `canvas-edit`, `clipboard-read`, `editor`, `editor-write`, `network`, `terminal`, `webview`, `camera`, `microphone`, `screen`, `notifications`, `global-shortcuts`, `tray`, `deep-links`, `oauth`. Check it before calling a method that needs one. |

### Permissions

Every permission the app checks is the **approved** one: what the user confirmed when they first showed the plugin. An update that asks for more runs with what it had until the user allows the rest (its Plugins page and its windows' menu offer **Allow**); an update that asks for less loses it at once. `init.permissions`, the app's checks, the frame's CSP and its iframe's `allow` attribute all use that set.

| Permission | Unlocks |
|---|---|
| `network` | `fetch`, WebSockets, images, media and fonts from `https:`/`wss:` anywhere, and `http:`/`ws:` on `localhost`, `127.0.0.1` and `[::1]`. Without it, a frame reaches only its own origin (and `data:`/`blob:`). Never frames, remote scripts or forms; sites must allow `plugin://<id>` with CORS. A server part always has the network. |
| `clipboard-read` | `app.clipboardRead`, `app.clipboardFormats` |
| `webview` | `web.*` (desktop app only) |
| `webview-control` | With `webview`: `web.run` and `web.capture`, reading and driving the page it shows |
| `control` | `windows.*`: opening the windows of the plugins in its `uses` and `dependencies` and calling their `api` |
| `canvas` | Reading the canvas: `canvas.watch`, `canvas.windows`, `canvas.drawings`, `canvas.setView`, `canvas.select`, `canvas.reveal`, overlays |
| `canvas-edit` | Changing the canvas: `canvas.moveWindows`, `canvas.raise`, `canvas.draw`, `canvas.updateDrawings`, `canvas.eraseDrawings` |
| `terminal` | `terminal.*`, and `server.call`/`server.subscribe` to `terminal` |
| `editor` / `editor-write` | `editor.list`, `editor.read`, `editor.watch` / `editor.edit`, `editor.select` |
| `camera`, `microphone`, `screen` | `getUserMedia` / `getDisplayMedia` through the app |
| `notifications` | `app.notify` |
| `tray` | `app.setBadge`, `contributes.tray` |
| `global-shortcuts` | `contributes.globalShortcuts` |
| `deep-links` | `hyperpane://plugin/<id>/…` links, `link` events |
| `oauth` | `app.authorize` |

## Calling a server

These three methods reach plugins' **server parts** on a server. The app sends them on over the [wire protocol](/docs/reference/protocol) as plugin calls, and the server routes them to the plugin's process, starting it if it isn't running.

### `server.call`

Calls a server part and waits for its reply.

| Argument | Type | Description |
|---|---|---|
| `plugin` | `string` | The plugin to call: this plugin's own id, a dependency's, or one listed in `plugin.json`'s `uses`. |
| `request` | any JSON value | The request. May contain `Uint8Array`s (see [Bytes](#bytes)). |
| `server` | `string?` | The server's id. Defaults to the window's server, else the project's home server. |

**Result:** the server part's reply, any JSON value (with `Uint8Array`s if the part sent bytes).

```json
{ "t": "req", "id": 3, "m": "server.call", "a": { "plugin": "git", "request": { "op": "status" } } }
{ "t": "res", "id": 3, "ok": true, "v": { "branch": "main", "changed": 2 } }
```

```ts
const status = await host.call<{ branch: string }>('git', { op: 'status' });
```

A plugin listed in `uses` but not installed on that server fails with the server's message.

### `server.subscribe`

Opens a subscription to a server part: the part answers with a stream of events.

| Argument | Type | Description |
|---|---|---|
| `plugin`, `request`, `server` | | As for `server.call`. |
| `resume` | `boolean?` | Default `true`: when the server restarts, the app makes the subscription again on the same id, so `sub` messages continue (the part sends its state again first). With `false`, the subscription ends then, with `subEnd` and the reason. |

**Result:** `res` with `ok: true` when it started, then `sub` messages (each an event), then one `subEnd`. `res` with `ok: false` means it never started. The frame's `cancel` ends it; after that the app sends nothing more for that id (a `subEnd` already on its way is ignored).

```json
{ "t": "req", "id": 5, "m": "server.subscribe", "a": { "plugin": "git", "request": { "op": "watch" } } }
{ "t": "res", "id": 5, "ok": true }
{ "t": "sub", "id": 5, "v": { "branch": "main", "changed": 3 } }
{ "t": "cancel", "id": 5 }
```

Calls made while the server is away wait for it, for up to 10 seconds.

### `server.stream`

As `server.call`, but the request, the reply, or both carry a **stream** of bytes of any size: a file going up, a download coming back, or a transform. See [Streams](#streams).

| Argument | Type | Description |
|---|---|---|
| `plugin`, `request`, `server` | | As for `server.call`. |
| `upload` | `{ at: (string \| number)[] }?` | Where the upload goes in `request` (a `null` at that path). |

**Result:** the reply; `res.stream.at` says where the download is in it, if it carries one.

### Bytes

`server.call`'s request and reply, and `server.subscribe`'s request and events, may contain bytes anywhere: a `Uint8Array` (or another typed array, or an `ArrayBuffer`) as a value, a field or an array item. They cross as bytes the whole way, never base64: `postMessage` carries them as they are, the app puts them in a binary body (see [the wire protocol](/docs/reference/protocol#bodies-json-and-binary)), and the server part's SDK hands them to the plugin as `Uint8Array`s, and the same way back.

```ts
const { png } = await host.call<{ png: Uint8Array }>('charts', {
  op: 'render',
  csv: new Uint8Array(await file.arrayBuffer()),
});
```

- What comes back is always a `Uint8Array`, a view into the reply as it arrived. Its `buffer` may be larger: use `byteOffset` and `byteLength`, or `slice()`.
- A request without bytes goes as JSON.
- The bus (`bus.publish`, `bus.request`) and ports (`window.emit`) carry JSON only.
- A message is at most 64 MiB, bytes included. Anything larger goes as a stream.

## Methods

The app checks every request before acting on it. "Own window" means the frame's own window. Arguments are `req.a`; results are `res.v`. "—" means no arguments or no result.

### `window.*`: the frame's window

| Method | Arguments → result | Rules |
|---|---|---|
| `window.setData` | `{key, value: string \| null}` | Own window. `null` removes the key. Keys starting with `hyperpane.` are reserved for the app. |
| `window.setTitle` | `{title}` | Own window. A name the user gave the window stays. |
| `window.setDescription` | `{description: string \| null}` | Own window. A line under its title in the window's header (at most 200 characters); `null` removes it. |
| `window.setHeaderColor` | `{color: string \| null}` | Own window. `#rrggbb`: its header tinted with it, its icon's tile and its border while focused too; `null`: the theme's. The user can pick another in the window's menu. |
| `window.setIcon` | `{svg: string \| null}` | An SVG (24-unit box, stroked), at most 64 KB. `null` restores the type's icon. |
| `window.setMenu` | `{items: MenuItem[]}` | Items shown above the app's own in the window's menu. Choosing one sends a `menu` event. |
| `window.setCloseQuestion` | `{question: string \| null}` | Asked before the window closes. While set, the frame is kept alive. |
| `window.emit` | `{port, value}` | Sends a JSON value from one of the window's out-ports along its links. |
| `window.setPorts` | `{ports: PortSpec[] \| null}` | Own window. Its own ports, replacing its type's (at most 32; ids unique per direction). `null` goes back to its type's. |
| `window.close` | — | Closes its own window. |
| `window.keepAlive` | `{on: boolean}` | Keeps the frame running while off screen. At most 4 per plugin. |
| `window.connectDialog` | — | Opens the dialog for linking the window's ports. |
| `window.openChild` | `{kind?, title?, data?, frame?: {x, y, width, height}, focus?}` → window id | Own window. Opens a window of one of its own plugin's types (`kind` defaults to this window's), as this window's **child**: linked to it, listed by `window.children`, aware of its parent through `window.parent`, and closed when this window closes. Placed at `frame` (canvas units), else to the right of this window, each further one a step down. Focused unless `focus: false`. At most 64 open per window. |
| `window.children` | — → `[{id, kind, title, frame: {x, y, width, height}, data}]` | Own window. Its child windows open now. |
| `window.parent` | — → window id or `null` | Own window. The window it was opened from, while that one is open. |
| `window.setExtent` | `{left?, right?, top?, bottom?, animate?}` → the extent now | Own window. Grows the window on the canvas by that much on each side given (canvas units, the frame's CSS pixels, 0 to 4000) past its size without it; the sides not given stay as they are. Left and top move the window as it grows, so what it shows stays where it is on screen; `0` gives a side back. One move, saved and shared like a drag; kept in the window's data (`hyperpane.extent`). `animate` (default true) glides it. |

#### More room, or more windows

A window that needs room for a sidebar, an inspector or a preview has two choices, both optional:

- **Grow.** `window.setExtent({ right: 280 })` makes it 280 wider on the right, and `{ right: 0 }` gives the room back. The content keeps its size and place; the panel takes room of its own instead of covering it. The UI kit's `SidePanel` and `useWindowExtent` do this for you (see the [SDK reference](/docs/plugins/sdk#ui-components)).
- **Open a child window.** `window.openChild` opens another of the plugin's windows beside this one, linked to it and closed with it: a detached preview, a second view.

A window that does neither keeps its size and draws everything inside it.

#### Ports

A node type declares its ports in `plugin.json` (`contributes.nodes[].ports`: `id`, `label`, `direction`, `type`, `max`). A window can override them with `window.setPorts`; they're kept in its shared data (`hyperpane.ports`) so every app draws them. `init.ports` and the `ports` event say what they are now.

- Links join an out-port to an in-port of the same type, or where either is `any`. A port takes at most `max` links. The app refuses others ("Text (text) can't go into Path (path): their types differ.").
- `window.emit` sends a value along an out-port's links, to frames (as `input` events) and to server parts (as `input` messages). `connect` and `disconnect` events report link changes.

### `app.*`: the app

| Method | Arguments → result | Rules |
|---|---|---|
| `app.openFile` | `{path, line?, server?, with?: {plugin, kind}, choose?}` | Without `with`, opens the file in the window type whose `opens` patterns score its name highest. `choose: true` asks the user which (Open With…), listing every type that opens it, best first. `with` focuses a window of that type showing the file, or opens one. When none shows it, a window of that type with `unlocked: "1"` in its data and no close question shows it instead (the one focused last). |
| `app.newNode` | `{plugin, kind, data?, state?, server?, title?, below?, frame?: {x, y, width, height}}` | A window type enabled in the project. `frame` places it exactly, in canvas units (at least 240 × 140); otherwise it goes beside the focused window. |
| `app.focusWindow` | `{window}` | A window of the project. |
| `app.closeWindow` | `{window}` | One of its own plugin's windows. The app asks first, as for any close. |
| `app.openPage` | `{page}` | One of its own pages (`<pageId>`), `plugins`, or `plugins/<id>`. |
| `app.toast` | `{message, description?, error?}` | Shows a toast. |
| `app.openExternal` | `{url}` | `http`, `https`, `mailto`, and schemes the user added to the Workspace setting "Other links plugins may open" (`vscode`, `slack`, …). Never `javascript:`, `data:`, `file:`, `blob:`, `app:`, `plugin:` or `hyperpane:`. |
| `app.clipboardRead` | `{format?: 'text' \| 'html' \| 'image'}` → `string \| Uint8Array \| null` | `clipboard-read`, and a focused frame. Text (the default) and HTML are `''` when there's none; an image is a PNG file's bytes, or `null`. |
| `app.clipboardFormats` | — → `('text' \| 'html' \| 'image')[]` | As `app.clipboardRead`. What the clipboard holds now. |
| `app.clipboardWrite` | `{text?, html?, image?: Uint8Array}` | A focused frame; no permission needed. At least one field; together they're one copy. `image` is a PNG, at most 32 MB; text and HTML at most 8 MB each. |
| `app.saveStream` | `{plugin, request, name?, server?}` → `string \| null` | Desktop app only. Makes the call as `server.call` does and saves the stream its reply carries to a file the user picks (`name` is the suggestion), straight from the server, not through the frame. Returns the path, or `null`. |
| `app.download` | `{paths, server?}` → `string \| null` | Desktop app only. Copies files and folders from a server (the window's by default) to this machine: one file where a save dialog says, several (or folders) into a chosen folder, with progress. Returns where they went, or `null`. |
| `app.notify` | `{title, body?, silent?, actions?: {id, title}[]}` → `{id, shown: 'native' \| 'toast' \| 'muted'}` | `notifications`. At most 10 a minute. See [Notifications](#notifications). |
| `app.setBadge` | `{count: number \| null}` | `tray`. This plugin's count on the app's badge. |
| `app.authorize` | `AuthorizeOptions` → `AuthorizeResult` | `oauth`. A sign-in in the user's browser; `cancel` gives it up. See [Signing in](#signing-in-oauth). |

### `ui.*`: menus and dialogs

| Method | Arguments → result | Rules |
|---|---|---|
| `ui.menu` | `{x, y, items: MenuItem[]}` → item `id` or `null` | Drawn by the app at frame coordinates, so it can extend past the frame. |
| `ui.confirm` | `{title, message, confirm?, destructive?}` → `boolean` | |
| `ui.prompt` | `{title, label, value?, placeholder?}` → `string \| null` | |
| `ui.dialog` | `{view, data?, title?, width?, height?}` → its result, or `null` if dismissed | A modal frame of the same plugin (`?v=dialog&k=<view>`), whose `init.view.data` is `data`. |
| `ui.closeDialog` | `{result}` | Only from a dialog. |
| `ui.size` | `{width?, height?}` | Cards (height), footer items (width, at most 320 px), dialogs. |

```ts
interface MenuItem { id: string; label: string; shortcut?: string; disabled?: boolean; separator?: boolean; danger?: boolean }
```

### `settings.set`

| Method | Arguments → result | Rules |
|---|---|---|
| `settings.set` | `{id, value}` | One of its own settings. Omit `value` (or send `undefined`) to restore the default. Every frame of the plugin then gets a `settings` event. |

### `live.*`: unsaved text

Shared unsaved text for files, so an Editor and a preview agree before anything is saved. For plugins that use `files`.

| Method | Arguments → result | Rules |
|---|---|---|
| `live.watch` | `{server, path}` → `string \| null` | The unsaved text now, or `null`. Later changes arrive as `live` events. |
| `live.unwatch` | `{server, path}` | |
| `live.set` | `{server, path, text: string \| null}` | `null`: nothing unsaved (saved, or reverted). |

### `bus.*`: the event bus

Events by topic between plugins' parts, routed by the server: a frame publishes `file.upload` with fields of its own, and every subscriber in the open project gets it, in every app with the project open and in the server parts assigned to it. The topic rules are in [the wire protocol](/docs/reference/protocol#the-event-bus).

| Method | Arguments → result | Rules |
|---|---|---|
| `bus.publish` | `{topic, data?, scope?}` → `{delivered}` | A topic `plugin.json`'s `events.publish` allows. |
| `bus.subscribe` | `{pattern}` → `res`, then `sub`… and `subEnd` | A pattern within `events.subscribe`. `cancel` ends it. |
| `bus.request` | `{topic, data?, scope?, timeout?}` → the first answer | As `bus.publish`. `timeout` in ms (default 5000, at most 60000). |
| `bus.reply` | `{request, data?}`, `{request, error}` or `{request, none: true}` | The answer to an event with `request` set. |

- **Checks.** The app checks each `bus.*` against the frame's `plugin.json` `events` ("Notes can't publish “file.upload”: it isn't in events.publish in Notes's plugin.json."), and refuses data over 1 MiB. It then sends it to the open project's home server. With no project open, `bus.publish` and `bus.request` fail ("Open a project to use events: …") and a subscription waits for one.
- **Scope:** `project` (the default) or `server` (every subscriber on that server, in any project).
- **Subscription events** are `{id, topic, data, from, project, time, request?}`. A subscription lasts until the frame cancels it or goes away. The app remakes it when the server restarts, and for the newly open project when another opens.
- **A frame doesn't hear its own events.** `from` is `{plugin, part: 'client', window?}` for frames, `{plugin, part: 'server'}` for server parts, and `{plugin: 'hyperpane', part: 'client'}` for the app, which publishes `project.opened` (`{id, name, folder}`) when it opens a project.
- **Requests:** an event with `request` wants an answer. The frame sends `bus.reply` once (the SDK does it with what your handler returns: `undefined` is `none`, a throw is `error`). The first answer with a value goes to the requester.

### `drag.*`: drag and drop

| Method | Arguments → result | Rules |
|---|---|---|
| `drag.begin` | `{payload: DragPayload, x, y}` | After 4 px of movement from a press. The app draws the ghost. |
| `drag.move` | `{x, y, mods}` | The pointer moved while dragging. |
| `drag.end` | `{x, y, mods}` | Released: the app drops it where it is. Alt (⌥) held copies rather than moves. |
| `drag.cancel` | — | Escape, or the pointer was lost. |
| `drag.out` | `{payload: DragPayload, x, y}` → `boolean` | From a `dragstart`: `true` when the app started the system's drag of those files (paths on this machine's server, in the desktop app); `false` means the frame continues with `drag.begin`. |
| `drag.over` | `{x, y}` | Files from outside the frame are being dragged over it; the app takes over the drag. |
| `drag.accept` | `{on: boolean}` | The frame accepts drops (it listens for `drop`), or no longer does. |
| `drag.upload` | `{upload, to: {folder, server?}}` → `string[] \| null` | Copies files dropped from this computer (a `drop`'s `upload`) into a folder on a server (the window's by default), after asking. Returns the new paths, or `null` if the user said no. At most 200 MB and 10,000 files per drop. |

```ts
type DragPayload =
  | { kind: 'paths'; server: string | null; paths: string[]; kinds?: ('file' | 'dir')[] }  // server null: the window's
  | { kind: 'text'; text: string };
type DragFrom = 'app' | 'system';   // the app's own drag, or files from outside the app
// mods: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }
```

- **Starting a drag.** `host.drag.begin(pointerdown, payload)` starts the app's own drag. `host.drag.start(dragstart, payload)` is for draggable elements: the browser's own drag is prevented (it can't leave the frame); paths on this machine's server go out as the system's drag of those files, which can land in Finder, on the desktop or in other apps; anything else becomes the app's own drag. Files on another server can't leave the app; use `app.download`.
- **Where it lands.** A frame that accepts drops hears `dragover`, `dragleave` and `drop`. On a terminal, paths are typed, quoted for its shell. On the canvas, each file opens in the window type that opens it best, and each folder in a new Explorer. Files from this computer dropped on the canvas of a project on another server are uploaded into the project's folder first, after asking.
- **`from`:** `app` for the app's own drags (and the system drag the app started), `system` for files from outside the app.

### `input.*`: input the frame hands back

The SDK sends these so the canvas behaves the same over a frame as anywhere else.

| Method | Arguments → result | Rules |
|---|---|---|
| `input.wheel` | `{x, y, dx, dy, mode, mods}` | A wheel event with Ctrl/⌘ held (zoom, or a pinch) goes to the canvas. `mode` is `WheelEvent.deltaMode`. |
| `input.pan` | `{phase: 'start' \| 'move' \| 'end', dx, dy}` | Middle-button panning, in screen pixels since the last message. |
| `input.key` | `{id, code, key, mods}` → whether a command ran | One of `init.shortcuts` that no handler in the frame took (`preventDefault`). The app runs that command with the frame's window focused. |
| `input.press` | `{x, y, button, mods}` | A press in a window that isn't focused: it only focuses the window. |
| `input.contextmenu` | `{x, y}` | A right-click nothing in the frame took: the window's menu. |
| `input.focused` | — | A press in the focused frame (selects the window). |

What the SDK does:

- **First press while not focused:** captures `pointerdown`, `mousedown` and `click`, stops them, and sends `input.press` once. The press only focuses the window.
- **Focus:** on the `focus` event, refocuses the element that last had focus in the frame. A press in a focused frame sends `input.focused`.
- **Wheel:** scrolls the nearest scrollable element; at the end of a list, it stops there (`preventDefault()`) and the canvas doesn't move. Only with Ctrl/⌘ held does it send `input.wheel`.
- **Middle button:** captures the pointer and sends `input.pan` start/move/end.
- **Shortcuts:** a `keydown` that no handler prevented and that matches one of `init.shortcuts` (as updated by `shortcuts` events) sends `input.key`. To keep a key for yourself, call `preventDefault()` on it. ⌘K (Ctrl+K) is among them, so the command palette opens from a frame too.
- **Right-click:** a `contextmenu` no handler prevented sends `input.contextmenu`.
- **Files dragged in:** a `dragenter`/`dragover` carrying files sends `drag.over`, and the app lays a layer over every frame for the rest of that drag.

### `web.*`: a real web page

With the `webview` permission, in the desktop app, a frame can show one real web page (Electron's `<webview>`), which the app creates beside the frame's iframe and draws where the frame says.

| Method | Arguments → result | Rules |
|---|---|---|
| `web.load` | `{url, userAgent?}` | `http`, `https`, `file` or `about:blank`. Creates the page the first time. |
| `web.place` | `{rect: {x, y, width, height, scale?} \| null}` | Where the page is drawn, in frame coordinates. `null` hides it. |
| `web.go` | `{by: -1 \| 1}` | Back or forward. |
| `web.reload` | `{hard?}` | `hard` ignores the cache. |
| `web.stop` | — | Stops loading. |
| `web.focus` | — | Gives the page the keyboard. |
| `web.close` | — | Ends the page. |
| `web.setUserAgent` | `{userAgent: string \| null}` | `null` restores Chrome's. An open page loads again. |
| `web.devtools` | `{x?, y?}` | Toggles DevTools for the page; at a `menu` event's `pageX`, `pageY`, inspects the element there. |
| `web.edit` | `{action}` | `cut`, `copy`, `paste`, `selectAll`, `undo` or `redo` in the page. |
| `web.run` | `{script}` → what it returns, as JSON | The `webview-control` permission too. Runs a script in the page (at most 256 KB): an expression, or a function body's statements with `return`; awaited. |
| `web.capture` | `{rect?: {x, y, width, height}}` → a PNG file's bytes | `webview-control`. The page as it's drawn now; `rect` in its CSS pixels for part of it. |

- **One per frame,** created by the first `web.load` and ended with the frame, `web.close`, or a reload of the frame. Hidden until `web.place` gives it a place.
- **Placement.** The page is laid out at `width` × `height` and drawn at `scale` from that corner. It moves, zooms and clips with its window, and takes the pointer only while its window is focused. Anything the frame draws under it is hidden: place `rect: null` while the frame shows its own content (an error, an empty state). Menus and dialogs go over it.
- **Isolation.** A sandboxed renderer with nothing of the app's, in a persistent session per plugin (sign-ins stay, separate from other plugins'). The frame never sees into the page, only the `web` events below, unless it also has `webview-control`: then `web.run` runs a script in the page, in a world of its own (the page's DOM, none of its scripts), and `web.capture` takes a picture of it. The Browser has it, to offer its pages to the plugins that drive it ([below](#windows-other-plugins-windows)).
- **New windows.** A link the page wants to open elsewhere opens nothing by itself: the frame hears `open` and decides.
- **Keys.** ⌘R (Ctrl+R) reloads the page; ⌘L, ⌘[, ⌘], ⌥⌘I and F12 reach the frame as `key` events.

```ts
type WebEvent =
  | { type: 'loading'; loading: boolean; back: boolean; forward: boolean }
  | { type: 'navigate'; url: string; back: boolean; forward: boolean; inPage: boolean }
  | { type: 'title'; title: string }
  | { type: 'favicon'; url: string | null }
  | { type: 'fail'; url: string; code: number; description: string }   // Chromium's net error
  | { type: 'crash'; reason: string }
  | { type: 'hover'; url: string }                                      // '' when off a link
  | { type: 'open'; url: string; disposition: string }                 // 'foreground-tab', 'new-window', …
  | { type: 'key'; key: 'address' | 'back' | 'forward' | 'devtools' }
  | { type: 'menu'; x: number; y: number; pageX: number; pageY: number;
      link: string; linkText: string; selection: string; editable: boolean; media: string; src: string;
      back: boolean; forward: boolean }
  | { type: 'focus' };
```

### `windows.*`: other plugins' windows

A plugin can open another plugin's window and drive it: an AI plugin opens a Browser, goes to a page, reads it and clicks. The window offers what it does (its plugin.json's [`api`](/docs/plugins/manifest#api)); the caller needs the `control` permission and the plugin in its `uses` (or `dependencies`). The app passes each call on to the window's frame, which answers with `host.serve` (see [The app asks a frame](#the-app-asks-a-frame)).

| Method | Arguments → result | Rules |
|---|---|---|
| `windows.methods` | `{plugin}` → `[{name, description, args?, stream?}]` | What a plugin's windows answer: its `api`, with JSON Schemas an AI plugin can hand a model as tools. |
| `windows.open` | `{plugin, kind?, title?, data?, frame?, focus?}` → window id | From its own window. A window of that plugin (`kind` defaults to its first type) as this window's child: beside it (or at `frame`), listed by `window.children`, closed with it. It stays running while it's open, even off screen. The user sees it and can use or close it. |
| `windows.call` | `{window, method, args?, timeout?}` → the answer | Any window of the project of a plugin it may control, and a method its `api` lists. A frame that isn't running is started first (up to 20 s). `timeout` in ms, default 30 s, at most 5 minutes. `cancel` stops it. |
| `windows.subscribe` | `{window, method, args?}` → `res`, then `sub`… and `subEnd` | A method with `stream: true`: its values as they come. `cancel` ends it. |

Refused: without `control`; a plugin not in `uses` or `dependencies`; its own windows (they have the bus and ports); a page, panel or card calling `windows.open` (it has no window to open from); a method not in the `api`, or one called the wrong way (`call` for a stream, `subscribe` for one that answers once).

```ts
const tools = await host.windows.methods('browser');
const id = await host.windows.open('browser', { data: { url: 'example.com' } });
await host.windows.call(id, 'waitForLoad');
const { text } = await host.windows.call(id, 'text', { max: 20_000 });
await host.windows.call(id, 'click', { text: 'Learn more' });
const stop = host.windows.subscribe(id, 'watch', null, (e) => console.log(e));
```

The Browser offers `open`, `state`, `back`, `forward`, `reload`, `waitForLoad`, `text`, `html`, `elements` (what can be clicked or typed in, numbered), `click` (by number, selector or text), `type`, `scroll`, `run` (a script), `screenshot` (PNG bytes) and `watch`.

### `canvas.*` and `overlay.*`: the canvas

With the `canvas` permission, any of the plugin's frames can see the canvas and move it. Changing windows and drawings needs `canvas-edit` too. Without the permission, each request fails, saying so ("Layout didn't ask to move windows or draw on the canvas (the canvas-edit permission).").

A point on the canvas is at `point × zoom + (x, y)` on screen, in CSS pixels from the canvas's top left.

| Method | Arguments → result | Rules |
|---|---|---|
| `canvas.watch` | `{view?, pointer?, selection?, active?, windows?, drawings?: boolean}` → `{view, pointer, selection, active, windows?, drawings?}` | `canvas`. Turns each event on or off for the frame, and answers with the current values. `active` is the focused window and its frame (canvas units), or `null`. |
| `canvas.windows` | — → `CanvasWindow[]` | `canvas`. Every window of the project. |
| `canvas.drawings` | — → `CanvasDrawing[]` | `canvas`. Every drawing of the project. |
| `canvas.setView` | `{x, y, zoom, animate?}` | `canvas`. Pans and zooms (zoom kept within 0.1 to 4), instantly or gliding. |
| `canvas.select` | `{windows: number[]}` | `canvas`. Selects these windows and drawings (empty clears it), at most 10,000. |
| `canvas.reveal` | `{window}` | `canvas`. Scrolls a window into view, moving as little as needed. Focus and selection stay. |
| `canvas.moveWindows` | `{windows: {id, x?, y?, width?, height?}[], animate?}` | `canvas-edit`. Windows, not drawings, each at most once, at most 1000. Each stays at least 240 × 140. |
| `canvas.raise` | `{window}` | `canvas-edit`. Brings a window or drawing to the front. |
| `canvas.draw` | `{drawings: NewDrawing[]}` → `number[]` | `canvas-edit`. At most 1000. Returns their ids, in order, once the server has made them. |
| `canvas.updateDrawings` | `{drawings: DrawingChange[]}` | `canvas-edit`. Drawings only, each at most once, at most 1000. |
| `canvas.eraseDrawings` | `{drawings: number[]}` | `canvas-edit`. At most 1000. Lines attached to them detach where their ends are. |
| `overlay.setHitAreas` | `{areas: {x, y, width, height}[]}` | Overlays only. The rectangles that take the pointer, in the overlay's pixels (at most 256; none at first). |
| `overlay.release` | — | Overlays only. The pointer left the hit areas; the canvas gets it back. The SDK sends this. |

- **Events while watched.** The app sends `view` each frame the canvas moves, `pointer` at most about 30 times a second (and `null` at once when it leaves the canvas or is over a plugin's own window), `selection` on change, and `windows`/`drawings` at most once a frame with everything that changed together. It computes each only while some frame watches it.
- **The SDK** watches while you have listeners (`host.on('view' | 'pointer' | 'selection' | 'windows' | 'drawings', fn)`), and reading `host.canvas.view`, `pointer`, `selection`, `windows` or `drawings` (or `toScreen`, `toCanvas`) watches that value from then on.
- **Changes are user edits.** A move or a drawing appears at once, goes into the project's document (saved in `.hyperpane/project.json` and sent to every app with the project open), and each call is one step for the canvas's Undo. A request that names something that isn't there changes nothing and fails, saying what.
- **Drawing defaults.** A new drawing takes the user's own defaults for its kind. A note or text box without a size fits its text; a shape is 180 × 110 (140 × 140 for an ellipse or diamond); a section is 720 × 480. Text is at most 100,000 characters; coordinates within ±10,000,000.

```ts
interface CanvasWindow {
  id: number; plugin: string; kind: string; title: string;
  frame: { x: number; y: number; width: number; height: number };  // canvas units
  z: number;                // stacking order: higher is in front
  server: string | null;    // the server it runs on; null: the project's home
  focused: boolean;
  selected: boolean;
  group?: number;           // the section it's in (the smallest, if several)
}
// windows event: { added: CanvasWindow[], removed: number[], changed: { window: CanvasWindow; what: string[] }[] }
// what: moved, resized, title, z, focused, selected, server, group

interface CanvasDrawing {
  id: number;
  kind: 'note' | 'text' | 'shape' | 'line' | 'pen' | 'section';   // an arrow is a line with a head
  frame: { x: number; y: number; width: number; height: number };
  z: number;
  text?: string;
  shape?: 'rect' | 'ellipse' | 'diamond';
  style: Style;
  locked: boolean;
  selected: boolean;
  from?: LineEnd; to?: LineEnd;                 // a line's ends
  points?: { x: number; y: number }[];          // a pen stroke's, in canvas units
}
// drawings event: { added: CanvasDrawing[], removed: number[], changed: { drawing: CanvasDrawing; what: string[] }[] }
// what: moved, resized, z, text, shape, style, locked, selected, from, to, points

interface Style {
  color?: string; fill?: string; stroke?: string;   // fg, muted, none, a note color (yellow, orange, red, pink,
                                                    // violet, blue, teal, green, gray, white), ansi:N, #rrggbb
  width?: number;                                   // stroke width, 0.5 to 64
  size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; wrap?: boolean;
  dash?: boolean; route?: 'straight' | 'elbow';
  start?: 'none' | 'arrow' | 'triangle'; end?: 'none' | 'arrow' | 'triangle';
}
type Side = 'top' | 'right' | 'bottom' | 'left';
interface LineEnd { x: number; y: number; window?: number; side?: Side }

type EndSpec = { x: number; y: number }          // a point
             | { window: number; side?: Side }   // a window or drawing of the project
             | { item: number; side?: Side };    // another drawing in the same canvas.draw, by index
type NewDrawing =
  | ({ kind: 'note' | 'text' | 'shape' | 'section'; x: number; y: number; width?: number; height?: number } & Fields)
  | ({ kind: 'line' | 'arrow'; from: EndSpec; to: EndSpec } & Fields)
  | ({ kind: 'pen'; points: { x: number; y: number }[] } & Fields);   // 2 to 10,000 points
interface Fields { text?: string; shape?: 'rect' | 'ellipse' | 'diamond'; style?: Partial<Style>; locked?: boolean }
interface DrawingChange extends Fields {          // a style key set to null goes back to its default
  id: number; x?: number; y?: number; width?: number; height?: number;
  from?: { x: number; y: number } | { window: number; side?: Side };
  to?: { x: number; y: number } | { window: number; side?: Side };
  points?: { x: number; y: number }[];
}
```

```ts
// An architecture diagram: two boxes and an arrow between them.
const [api, db] = await host.canvas.draw([
  { kind: 'shape', x: 0, y: 0, text: 'API' },
  { kind: 'shape', x: 400, y: 0, text: 'Postgres', shape: 'ellipse', style: { fill: 'blue' } },
  { kind: 'arrow', from: { item: 0, side: 'right' }, to: { item: 1 } },
]);

// Editors side by side, gliding into place.
const editors = host.canvas.windows.filter((w) => w.plugin === 'editor');
await host.canvas.moveWindows(
  editors.map((w, i) => ({ id: w.id, x: i * 820, y: 0, width: 800, height: 600 })),
  { animate: true },
);
```

#### Overlays

Overlays (`contributes.overlays`: `{id, title, order?, default?}`, at most 2 per plugin, `canvas` permission) are transparent frames over the whole canvas, above its windows and below the app's toolbars and menus. The pointer passes through them to the canvas except over their hit areas. The user can hide an overlay on its plugin's page; one shows only while a project is open and the permission is allowed. An overlay has no window.

```ts
// A comment pin that stays put on the canvas.
const pin = { x: 400, y: 300 };
const place = () => {
  const at = host.canvas.toScreen(pin);
  el.style.transform = `translate(${at.x}px, ${at.y}px)`;
  host.overlay.setHitAreas([{ x: at.x - 8, y: at.y - 8, width: 16, height: 16 }]);
};
host.on('view', place);
place();
```

### `terminal.*`: the project's terminals

With the `terminal` permission ("Runs commands in your terminals and reads what they print"), and Terminal on in the project, a frame drives the open project's terminals. The app sends each request on to Terminal's server part, with the open project's id added, on the server the terminal runs on (a new one opens on the project's home). Without the permission, these are refused ("Tasks didn't ask to use terminals (the terminal permission)."), and so is a `server.call` or `server.subscribe` to `terminal`.

| Method | Arguments → result | Rules |
|---|---|---|
| `terminal.list` | — → `TerminalInfo[]` | The project's terminals on every server it has terminals on (each with `server`). On the project's home, also those whose shells aren't running (`started: false`), which the methods below start. |
| `terminal.open` | `{cwd?, command?, title?, shell?}` → `{window}` | A new terminal window with its shell started now (by default, the shell chosen in Terminal's Shell setting). `command` is typed at its first prompt. |
| `terminal.input` | `{window, text}` | Text typed as is (`"\u0003"` is Ctrl+C). |
| `terminal.run` | `{window, command, wait?}` → `null`, or a `CommandResult` with `wait` | Types the command and Enter. Refused while a command is running there. With `wait`, `cancel` stops waiting: the app cancels the call on the server and sends no `res`. |
| `terminal.read` | `{window, lines?}` → `{text}` | The screen; with `lines`, the last that many lines of scrollback plus the screen. |
| `terminal.watch` | `{window, raw?}` → `res`, then `sub`… and `subEnd` | `TerminalEvent`s: output (escape sequences removed unless `raw`), `commandStart`, `commandEnd` with `exitCode`, `exit`. `cancel` ends it. |

`TerminalInfo`, `CommandResult` and `TerminalEvent`, and how command starts, ends and exit codes are detected, are described in [the wire protocol](/docs/reference/protocol#driving-terminals).

```ts
const window = await host.terminals.open({ cwd: 'web', title: 'Tests' });
const off = host.terminals.watch(window, (e) => e.type === 'output' && append(e.text));
const { exitCode, output } = await host.terminals.run(window, 'npm test', { wait: true, signal });
host.app.toast(exitCode === 0 ? 'Tests passed' : 'Tests failed', { description: output.slice(-200), error: exitCode !== 0 });
off();
```

Aborting `signal` makes the SDK send `cancel`, and the promise rejects with the signal's reason (an `AbortError`). The command keeps running unless you also pass `interrupt: true`, which types Ctrl+C.

### `editor.*`: the project's Editors

With the `editor` permission ("Reads the files open in your editors, and what's selected"), a frame reads the open project's Editors. With `editor-write` as well ("Changes the text in your editors"), it edits them and moves their selections, as edits the user can undo. The app checks both permissions, that the Editor is on in the project, and that the window is one of its Editors; then it [asks that Editor's frame](#the-app-asks-a-frame). Server parts can't reach Editors.

| Method | Arguments → result | Rules |
|---|---|---|
| `editor.list` | — → `EditorInfo[]` | The project's Editors with a file open. `[]` when there are none. |
| `editor.read` | `{window}` → `EditorText` | Its text, selection ranges and cursor. |
| `editor.watch` | `{window, text?, debounce?}` → `res`, then `sub`… and `subEnd` | `EditorEvent`s: changes (sent `debounce` ms after they stop, default 300, 0 for each), selection moves, saves. `cancel` ends it, and so does the window closing. |
| `editor.edit` | `{window, edits, version?, select?, each?}` → `{version}` | `editor-write`. One undoable step. With `version`, refused if the text changed since ("The text changed since version 4 …"). `each`: the text replaces every selection range. At most 1000 edits, 8 MB. |
| `editor.select` | `{window, ranges}` | `editor-write`. The first range is the main one; it's scrolled into view. |

```ts
interface EditorInfo { window: number; title: string; path: string; server: string | null;
                       dirty: boolean; language: string | null; focused: boolean;
                       loaded: boolean;    // its frame is running
                       version?: number }  // counts its changes since its frame started
interface EditorText extends EditorInfo { text: string; selection: EditorRange[]; main: number; cursor: EditorPosition }
interface EditorRange { anchor: number; head: number; from: number; to: number; text: string }   // UTF-16 offsets
interface EditorPosition { offset: number; line: number; col: number }                          // line and col from 1
type EditorPos = number | { line: number; col: number };
interface EditorEdit { from?: EditorPos; to?: EditorPos; insert: string }   // neither: the main selection
type EditorEvent =
  | { type: 'change'; version; dirty; changes: { from; to; insert }[]; text?; selection; main; cursor }
  | { type: 'selection'; version; selection; main; cursor }
  | { type: 'state'; version; dirty; path; language };   // saved, reverted
```

- An Editor off screen for a while has no frame (unless it has unsaved edits): `list` reports `loaded: false`, `read` answers the file's text on disk, and `watch`, `edit` and `select` fail until it's on screen again ("That Editor isn't running …"). A watch keeps its frame running.
- Errors: "That isn't an Editor in this project.", "Editor is off in this project.".

```ts
// Send the selection to a terminal.
const [ed] = (await host.editors.list()).filter((e) => e.focused);
const { selection, main, version } = await host.editors.read(ed.window);
await host.terminals.input(terminal, selection[main].text + '\n');
await host.editors.edit(ed.window, [{ from: { line: 12, col: 1 }, insert: '// TODO: handle null\n' }], { version });
```

### `points.call`: extension points

Plugins extend each other through **points**. A plugin declares points in its `plugin.json`; other plugins contribute items to them (`contributes["<owner>.<point>"]`), and an item with `call` is a **provider**: an op of the contributor's server part that the point's owner calls.

| Method | Arguments → result | Rules |
|---|---|---|
| `points.call` | `{point, plugin, index, data?, timeout?, server?}` → the provider's answer | `point` must be one of the frame's own plugin's points, and `plugin` must contribute item `index` to it, as a provider, and be on in the project ("Git contributes nothing there to Editor's “diagnostics” (or it's off in this project)."). The app calls the contributor's server part on `server` (the window's by default, else the project's home). `timeout` in ms, default 5000, at most 60000. `cancel` stops it. |

The provider's request is the owner's `data` (an object; anything else arrives as `{data}`) with `op` and `point` set by the app:

```json
{ "op": "lint", "point": "editor.diagnostics", "path": "/app/schema.prisma", "text": "…", "language": "Prisma" }
```

`init.points` holds the contributions to the frame's plugin's points, by point; a `points` event brings all of them again when any change.

```ts
interface Contribution<T = Record<string, unknown>> {
  plugin: string; name: string;   // who contributed it
  point: string;
  index: number;                  // its place in the contributor's list
  value: T;                       // the item, as its plugin.json has it
  provider: boolean;              // it has `call`, and the contributor has a server part
}

host.extensions('languages');
host.extensions.watch('diagnostics', (list) => render(list));
await host.extensions.call(c, { path, text }, { timeout: 5000 });
await host.extensions.callAll('diagnostics', { path, text });   // [{contribution, value} | {contribution, error}]
```

The SDK gives up after the timeout (a `TimeoutError`: "Prisma didn't answer within 5 s.") and sends `cancel`; the app then cancels the call on the server. `callAll` never rejects.

**`plugin.json` rules:** a point has `id` (lowercase letters, digits and `-`, at most 32, unique), `title` (at most 60 characters), `description`, and an optional `schema` (a JSON Schema subset: `type`, `properties`, `required`, `additionalProperties`, `items`, `enum`, `const`, `pattern`, `minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `maxItems`, `anyOf`). At most 32 points per plugin, and at most 64 items per contribution. Items for a point that doesn't exist, or that its schema refuses, are left out with a warning.

### `media.*`: camera, microphone and screen

A frame can use the camera, the microphone, and a screen or window when its plugin declares `camera`, `microphone` and/or `screen`, the user approved them at install, and the user allows each the first time it's used ("Pets wants to use your camera": **Allow once**, **Always allow**, **Don't allow**). Screen capture always goes through the app's picker. On macOS the system's own permission is needed too.

| Method | Arguments → result | Rules |
|---|---|---|
| `media.state` | `{kind: 'camera' \| 'microphone' \| 'screen'}` → `{state, reason?, last?}` | `state`: `granted`, `prompt` or `denied`. `reason` (when denied): `undeclared`, `unapproved`, `person`, `system`. `last`: why its latest request was refused, if within the last few seconds. |
| `media.started` | `{kinds}` | The kinds the SDK now holds, for the app's in-use indicator. |
| `media.ended` | `{kinds}` | The kinds it no longer holds. |

```ts
const stream = await host.media.camera({ width: 1280 });   // getUserMedia({video})
const mic = await host.media.microphone();                  // getUserMedia({audio})
const shared = await host.media.screen({ audio: true });    // getDisplayMedia, through the app's picker
```

A refusal is a `MediaError` with `code`: `undeclared`, `unapproved`, `denied`, `system`, `unavailable` or `unsupported`. While a frame holds media, its window shows a badge and the footer offers **Stop**, which sends a `media` event; the SDK stops those tracks.

### Notifications

`app.notify` (the `notifications` permission) shows a system notification while the app isn't in front, and a toast while it is. The user can choose per plugin: automatic, always the system's, only toasts, or off (`shown: 'muted'`).

- At most 10 a minute per plugin ("Too many notifications from Git: at most 10 a minute."). `title` at most 200 characters, `body` 2000, up to 3 `actions`.
- A click brings the app to the front, opens what showed it, and every frame of the plugin that's up hears `notificationClick` with the `id` (and the button's `action`).

```ts
const { id, shown } = await host.app.notify({ title: 'Build failed', body: 'web: 3 errors', actions: [{ id: 'open', title: 'Open log' }] });
host.on('notificationClick', ({ id, action }) => action === 'open' && showLog());
```

### Signing in (OAuth)

`app.authorize` (the `oauth` permission) runs the OAuth authorization-code flow for native apps (RFC 8252) in the user's browser and returns the code to exchange.

```ts
interface AuthorizeOptions {
  authorizeUrl: string;                 // the provider's authorization endpoint (https)
  clientId: string;
  scopes?: string[];
  redirect?: 'loopback' | 'scheme';     // default 'loopback'
  pkce?: boolean;                       // default true: S256
  extraParams?: Record<string, string>; // access_type, prompt, login_hint, …
}
interface AuthorizeResult { code: string; state: string; redirectUri: string; codeVerifier: string | null }
```

- **`loopback`** (default): a one-time server at `http://127.0.0.1:<free port>/callback` on the user's own computer.
- **`scheme`:** `hyperpane://oauth/<plugin>/callback`, for providers that accept a custom scheme.
- The app checks `state`, makes the PKCE verifier, and reports the provider's `error` (`access_denied` is "The sign-in was declined."). It gives up after 5 minutes ("The sign-in took longer than 5 minutes: try again.") or when cancelled.
- Exchange the code for tokens in your server part, and keep them with its secrets, never in the frame's storage.

```ts
const { code, redirectUri, codeVerifier } = await host.app.authorize({
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  clientId: 'Ov23li…',
  scopes: ['repo', 'read:user'],
});
await host.call('github', { op: 'signedIn', code, redirectUri, codeVerifier });
```

### Other operating-system features

These come from `plugin.json`, not from requests:

| Permission | Feature |
|---|---|
| `global-shortcuts` | `contributes.globalShortcuts`: `[{id, title, default?, command?, background?}]`, at most 8. A key that runs one of the plugin's commands from anywhere, even with the app in the background. `mod` is ⌘ on macOS, Ctrl+Shift elsewhere. A key another app holds is shown as taken, not registered. |
| `tray` | `contributes.tray`: `[{id, title, command?, background?}]`, at most 8 items in the tray's menu. `app.setBadge` sets the plugin's count; the app shows the sum of every plugin's counts (up to `9999+`). |
| `deep-links` | `hyperpane://plugin/<id>/<path>?<query>` links. The app asks before opening one ("Open this link in Git?"); then every frame of the plugin hears `link` with `{path, query, url}`. `host.app.linkFor('pr/42', { repo: 'web' })` builds one. |

In the web app (a plain browser), notifications use the browser's `Notification`, sign-in uses a popup that returns to the web app's `/oauth-callback.html`, the badge uses `navigator.setAppBadge` where available, and global shortcuts and the tray don't exist.

## Events

The app sends events as `{ t: 'ev', e, v }`.

| Event | `v` |
|---|---|
| `theme` | `{id, dark, vars}`, as `init.theme` |
| `settings` | `Record<string, unknown>`: all of this plugin's settings, defaults filled in |
| `window` | `{title?, data?, server?, focused?, scroll?, named?}`: what changed about its window |
| `project` | `ProjectInfo \| null` |
| `servers` | `ServerInfo[]` |
| `zoom` | `{zoom}` |
| `visibility` | `{visible}`: on screen or not (frames off screen are kept for a while) |
| `focus` | —: the window got the keyboard; the SDK refocuses what had it last |
| `links` | `{links: Link[]}` |
| `ports` | `{ports: PortSpec[]}`: its window's ports changed |
| `input` | `{port, value, link}`: a value arrived at an in-port |
| `connect` / `disconnect` | `{link}` |
| `menu` | `{id, window}`: an item from `window.setMenu` was chosen, in that window's menu |
| `action` | `{id, window}`: a card's header button (`contributes.cards[].actions`); `window` is the window the card is on, null in a sidebar |
| `button` | `{id, slot, window}`: `window` is the focused window's id, null if none; one of the plugin's buttons without an `action` (`contributes.buttons`); every open frame of the plugin hears it |
| `command` | `{id, window}`: `window` is the focused window's id, null if none; one of the plugin's commands without an `action` (`contributes.commands`) was run; every open frame of the plugin hears it |
| `shortcuts` | `Shortcut[]`: the keys to hand back from now on, replacing `init.shortcuts` |
| `live` | `{server, path, text: string \| null}` |
| `dragover` | `{x, y, payload: DragPayload \| null, from: DragFrom, mods}` (`payload` is `null` for a system drag until it's dropped) |
| `dragleave` | —: the drag left the frame, or ended elsewhere |
| `drop` | `{x, y, payload: DragPayload, from: DragFrom, mods, upload?}` |
| `close` | —: 300 ms before the app destroys the frame, a last chance to save |
| `view` | `{x, y, zoom}`: the canvas was panned or zoomed (while watched) |
| `pointer` | `{x, y, window} \| null`: the pointer on the canvas, in canvas units, and the window under it (while watched) |
| `selection` | `{windows: number[]}` (while watched) |
| `windows` | `{added, removed, changed}`: the project's windows changed (while watched) |
| `drawings` | `{added, removed, changed}`: its drawings changed (while watched) |
| `web` | `WebEvent`: something happened in the frame's web page |
| `points` | `Record<string, Contribution[]>`: contributions to its plugin's points changed |
| `media` | `{stop: ('camera' \| 'microphone' \| 'screen')[]}`: the user pressed Stop; stop those tracks (the SDK does) |
| `notificationClick` | `{id, action?}`: one of the plugin's notifications, or one of its buttons, was clicked |
| `link` | `{path, query, url}`: a link to the plugin was opened and allowed |

## Streams

`server.stream` is `server.call` whose request or reply carries a stream of bytes of any size. It flows in chunks only as fast as its reader takes it: the reader grants a window of **credit**, then each chunk's size as it reads it, and the writer never sends past its credit. The app passes chunks and credit between the frame and the server as they come, so neither it nor the server holds more than what's crossing.

```ts
// Up: a File, Blob, ReadableStream, or async iterable of bytes, anywhere in the request.
const { bytes } = await host.stream('files', { op: 'write', path, data: file });

// Down: a ReadableStream<Uint8Array> where the part put it.
const { name, data } = await host.stream<{ name: string; data: ReadableStream<Uint8Array> }>('files', { op: 'read', path });
for await (const chunk of data) hash.update(chunk);

// Or into a file the user picks, straight from the server (desktop app).
await host.app.saveStream('files', { op: 'read', path }, { name });
```

On the port:

```jsonc
// frame → app
{"t":"req","id":4,"m":"server.stream","a":{"plugin":"files","request":{"op":"write","data":null},"upload":{"at":["data"]}}}
{"t":"chunk","id":4,"data":"<Uint8Array>"}
{"t":"streamEnd","id":4}
{"t":"credit","id":4,"bytes":262144}
{"t":"cancel","id":4}
// app → frame
{"t":"credit","id":4,"bytes":2097152}
{"t":"streamCancel","id":4,"reason":"…"}
{"t":"res","id":4,"ok":true,"v":{"name":"a","data":null},"stream":{"at":["data"]}}
{"t":"chunk","id":4,"data":"<Uint8Array>"}
{"t":"streamEnd","id":4,"error":"…"}
```

| Rule | Detail |
|---|---|
| **One stream each way** | By the request's id. `chunk` and `streamEnd` from the frame are the upload's; from the app, the download's. `credit` from the frame is for the download; from the app, for the upload. |
| **Where** | `upload.at` is the upload's path in `request` (a `null` there); `res.stream.at` is the download's path in the reply. Paths are object keys and array indexes from the top; `[]` means the value itself. |
| **Limits** | The `res` for a stream with a download includes the server's limits (`limits: {window, maxWindow, maxChunk}`). The SDK's reader grants `window` first (default 2 MiB, at most 8 MiB). The frame's upload chunks are at most 1 MiB (the SDK's are 256 KiB). A side that sends more than its credit breaks the stream. |
| **Ends** | A `res` without `stream` ends the call (an upload still going is cancelled). With one, the call lasts until the download's `streamEnd`; a read after an `error` fails with it (a `StreamError`). `cancel` (or cancelling the `ReadableStream`, or aborting `signal`) stops both, and so does the frame going away. `res` with `ok: false` means the call failed. |
| **One per message, only in calls** | A request carries at most one stream, and so does a reply. Subscriptions, the bus and ports carry none. |

`app.saveStream` makes the call itself, writes the reply's stream to the file as it arrives (granting credit as each chunk is written), and shows a progress toast with **Cancel**. Cancelling or failing removes what was written; the frame hears `null` or the error.

## The app asks a frame

For the Editor's text, the app asks the Editor's frames; for another plugin's `windows.call`, it asks the window that's called. It sends `{t: 'ask', id, m, a, from: {plugin, window?}}` (ids are the app's own) and `{t: 'askCancel', id}` when whoever asked gives up. The frame answers once with `{t: 'answer', id, ok: true, v}` or `{t: 'answer', id, ok: false, error}`, optionally after any number of `{t: 'answer', id, ok: true, v, more: true}` (a watch's values).

```ts
host.serve('editor.read', async (args, { signal, emit, from }) => readState());
```

What the handler returns is the answer, a throw is its error, `emit` sends a value before it, and `signal` aborts on `askCancel`. With no handler, the frame answers "This window doesn't answer “m”.". The app asks only for its own methods, of the plugin they're for (`editor.*` of the Editor's frames), and for the methods in a plugin's `api` that another plugin calls, with `from` the caller. A method not in the `api` never reaches the frame.

## Errors

A failed request is a `res` with `ok: false` and an `error` string. A failed subscription or stream ends with `subEnd` or `streamEnd` carrying `error`.

```json
{ "t": "res", "id": 7, "ok": false, "error": "Git's server part stopped (exit code 1)." }
```

- **Errors are sentences** for the user (or the plugin's author), meant to be shown as they are. There are no error codes, except `MediaError.code`.
- **The SDK** turns `ok: false` into a rejected promise with an `Error` whose message is `error`; a stream read after an error throws a `StreamError`; a timed-out `points.call` throws a `TimeoutError`; an aborted call rejects with the signal's reason.
- **Server parts' errors** reach the frame unchanged: a part that replies with an error, crashes, can't start, or isn't installed fails the call with the server's message (see [the wire protocol](/docs/reference/protocol#errors)).

Common errors:

| Situation | Error |
|---|---|
| A permission the plugin didn't ask for, or the user didn't approve | "Layout didn't ask to move windows or draw on the canvas (the canvas-edit permission)." |
| A bus topic outside `events` | "Notes can't publish “file.upload”: it isn't in events.publish in Notes's plugin.json." |
| No project open for the bus | "Open a project to use events: …" |
| An editor window that isn't one | "That isn't an Editor in this project." |
| An app without a method | "There's no “server.stream” in this app's plugin API." |
| A server older than streams | "This server is from before streams: update it to send or read one." |
| A server older than bytes | "This plugin didn't understand the call: …" |
| An app older than bytes | "This app's canvas engine can't send bytes to a plugin. Update the app." |
| A stream in `host.call` | "A stream goes with host.stream(), not host.call()." |
| Two streams in one request | "A call carries one stream; this one has two (at [\"a\"] and [\"b\"])." |
| A stream in a subscription request | "A subscription's request can't carry a stream: send it with host.stream() instead." |
| A stream on the bus | "An event on the bus can't carry a stream: send it in a call's reply instead." |
| A `points.call` timeout | "Prisma didn't answer within 5 s." |
| Too many notifications | "Too many notifications from Git: at most 10 a minute." |

## Testing

`fakeHost()` from the SDK plays the app in tests. Its app answers `server.stream` with `answers['server.stream']`, `app.notify` with `{id: 'n<request id>', shown: 'native'}`, and `app.setBadge` with nothing; it refuses `app.authorize` until the test answers it (`app.answers['app.authorize'] = () => ({code, state, redirectUri, codeVerifier})`). `app.event(name, value)` sends an event, for example `app.event('link', {path, query, url})`.
