---
title: SDK reference
description: "The SDK's API for a plugin's windows and its server part: the host, hooks, UI components, events, storage, menus and pages."
section: Plugins
order: 22
---

# SDK reference

This page lists what the SDK gives a plugin's two parts. For a step-by-step guide, see [Writing a plugin](/docs/plugins/writing). For the manifest, see [plugin.json](/docs/plugins/manifest). For the messages underneath, see the [RPC reference](/docs/reference/rpc).

## Modules

| Import | Used in | What it has |
|---|---|---|
| `@hyperpane/sdk/client` | client part | `mount`, the client `Host`, React hooks, `files()`, `keys()` |
| `@hyperpane/ui` | client part | The app's components: `ToolButton`, `NodeMessage`, `useMenu`, `Tabs`, `Button` and more |
| `@hyperpane/code` | client part | CodeMirror, set up the way the Editor sets it up |
| `@hyperpane/markdown` | client part | Markdown to safe HTML, with highlighted code |
| `@hyperpane/sdk/server` | server part | `serve`, `json`, `PluginError`, the server `Host`, path helpers |
| `@hyperpane/sdk` | both | Path helpers, `formatSize`, `formatTime`, `formatAgo` |
| `@hyperpane/sdk/testing` | tests | A server host in memory (`testHost`, `invoke`, `stream`, `testBus`) and a fake app for the client part (`fakeHost`, `bootFrame`) |
| `@hyperpane/sdk/manifest` | tools | `validatePackage` (the app's checks), and the manifest's types |

At run time the SDK always comes from where the code runs. The server maps `@hyperpane/sdk*` to its own copy, and the app serves the client modules to frames. React, the SDK, the UI kit, CodeMirror and Lucide (`lucide-react`) always come from the app, so don't bundle them. The npm package you install is for types, tests and the checker.

## Rules for the TypeScript

Neither part has a build step: Node strips the types from the server part, and the app does the same for the client part. So only erasable syntax works:

- no `enum`, no `namespace` with values, no parameter properties, no `import x = require()`, no legacy decorators;
- relative imports name the file with its extension (`./count.ts`);
- types are imported with `import type`;
- `src/client/package.json` and `src/server/package.json` say `"type": "module"`, and JSX is only allowed in `src/client`.

Plugins are pure JavaScript: no native addons (`.node` files), and npm install scripts don't run.

## The client part

The client part is a web app. It runs in a sandboxed frame, one per window, card, page, panel, overlay, footer item or dialog. It reaches everything else through the app, by way of the `Host`.

```tsx
// src/client/main.tsx
import { mount, useData, useHost } from '@hyperpane/sdk/client';
import { ToolButton } from '@hyperpane/ui';
import { RefreshCw } from 'lucide-react';

function Note() {
  const host = useHost();
  const data = useData(); // the window's shared data
  return (
    <div className="flex h-full flex-col text-xs">
      <ToolButton label="Refresh" icon={RefreshCw} onClick={() => host.call('notes', { op: 'read' })} />
      <textarea value={data.text ?? ''} onChange={(e) => host.win.setData('text', e.target.value)} />
    </div>
  );
}

mount((host) => (host.view.type === 'node' ? <Note /> : null));
```

### mount and the host

| Export | What it does |
|---|---|
| `mount(render: (host: Host) => ReactNode)` | Connects to the app, applies the theme, and renders into `#root`. If the connection fails, it shows the error. |
| `connect(): Promise<Host>` | Connects without React. `mount` calls it for you. |
| `currentHost(): Host \| null` | The connected host, outside React. |
| `HostProvider` | Provides a host to components, for tests. |
| `typedBus<Topics>(host.bus)` | The bus, typed by a topic map. |

### host.view

`host.view` says what this frame is:

| `view.type` | Other fields | From |
|---|---|---|
| `node` | `kind`, `window` | `contributes.nodes`: a window on the canvas |
| `card` | `id`, `place` (`left`, `right`, `bottom` or `canvas`), `window?` | `contributes.cards` |
| `page` | `id` | `contributes.pages` |
| `panel` | `id`, `side` | `contributes.panels` |
| `overlay` | `id` | `contributes.overlays` |
| `footer` | `id` | `contributes.footer` |
| `dialog` | `view`, `data` | `host.ui.dialog(view, { data })` |

One client part usually serves all its views from one `main.tsx`:

```tsx
import { mount } from '@hyperpane/sdk/client';
import { NodeMessage } from '@hyperpane/ui';

mount((host) => {
  const view = host.view;
  if (view.type === 'node' && view.kind === 'note') return <Note />;
  if (view.type === 'card' && view.id === 'pins') return <Pins />;
  return <NodeMessage error>Notes has no “{view.type}” view here.</NodeMessage>;
});
```

### State the host keeps current

| Property | Type | What it is |
|---|---|---|
| `init` | `Init` | Everything the app sent when the frame connected. |
| `window` | `WindowInfo \| null` | Its window: `id`, `title`, `named`, `plugin`, `kind`, `data`, `server`. `null` for pages, panels, footer items, dialogs and cards in a sidebar. |
| `project` | `ProjectInfo \| null` | The open project: `id`, `name`, `folder`, `server` (its home), `plugins` (turned on in it), `windows`. |
| `servers` | `ServerInfo[]` | The servers: `id`, `name`, `local`, `status`, `os`, `target`, and `part` (this plugin's server part there, if installed: `version`, `status`). |
| `theme` | `Theme` | `id`, `dark`, `vars` (CSS variables). |
| `focused` | boolean | Its window has the keyboard. |
| `zoom` | number | The canvas's zoom. |
| `visible` | boolean | On screen. |
| `inputs` | `Record<string, Input[]>` | The latest value at each in-port, per link. |
| `links` | `Link[]` | The project's links to and from this window. |

### Hooks

The hooks re-render when what they read changes. Use them inside `mount()`.

| Hook | Returns |
|---|---|
| `useHost()` | The `Host`. |
| `useOptionalHost()` | The `Host`, or `null` outside a frame. |
| `useWindow()` | Its `WindowInfo`, or `null`. |
| `useData()` | Its window's shared data, `Record<string, string>`. |
| `useSetting<T>(id)` | `[value, set]` for one of the plugin's settings. `set(undefined)` goes back to the default. |
| `useProject()` | The open project, or `null`. |
| `useServers()` | The servers. |
| `useServerPart(server?)` | This plugin's server part on a server (the window's, else the project's home): `{ version, status }`, or `null`. |
| `useInputs()` | The latest value at each in-port, per link. |
| `useInput<T>(port)` | The latest value at one in-port. |
| `usePorts()` | Its window's ports. |
| `useTheme()` | The theme. |
| `useFocused()` | Whether its window has the keyboard. |
| `useEvent<T>(pattern, handler)` | Handles bus events while the component is mounted. The handler can change between renders without subscribing again. For a request, what it returns is the answer. |

### Calling the server part

The client part calls its own server part, or those of the plugins in its `dependencies` and `uses`, by plugin id. Calls go to the window's server, or the project's home server, unless `{ server }` says otherwise.

```ts
// One request, one reply.
const n = await host.call<number>('notes', { op: 'pin', project: project?.id, text });

// A subscription: events until you cancel.
const cancel = host.subscribe<Pin[]>('notes', { op: 'pins', project: project.id }, setPins, {
  onEnd: (error) => error && setError(error),
});
```

| Method | What it does |
|---|---|
| `call<T>(plugin, request, { server? })` | Sends a JSON request and resolves with the reply. Requests and replies may contain `Uint8Array`s, which travel as bytes. A thrown error in the server part rejects with its message. |
| `stream<T>(plugin, request, { server?, window?, signal? })` | A call whose request or reply carries a stream of bytes of any size. A `ReadableStream`, `Blob` or async iterable in the request is sent in chunks. A stream in the reply arrives as a `ReadableStream<Uint8Array>`. |
| `subscribe<E>(plugin, request, onEvent, { server?, resume?, onEnd? })` | Events until you call the cancel it returns. When the server restarts, the app subscribes again, unless `resume: false`. |
| `has(plugin)` | Whether a plugin is on in the open project. One in `uses` may not be. |

A call to a plugin in `uses` that isn't installed fails with a message saying so. The `files(host, server?)` helper wraps the Files plugin's calls: `list`, `stat`, `read`, `write`, `mkdir`, `create`, `rename`, `copy`, `delete`, `watch`, `watchFile`, and more. To use it, add `"files"` to `dependencies`.

### host.win: its own window

| Method | What it does |
|---|---|
| `setData(key, value \| null)` | Sets a key of the window's shared data, saved in the project. `null` removes it. Keys starting with `hyperpane.` are the app's. |
| `setTitle(title)` | Sets its title. A name the user gave it stays. |
| `setHeaderColor(color \| null)` | Its header's color (`#rrggbb`): the header, its icon's tile and its focused border. `null`: the theme's. |
| `setDescription(text \| null)` | A line under its title in the window's header: where it points, what it shows. `null` removes it. |
| `setIcon(svg \| null)` | An SVG icon for this window (at most 64 KB). `null` goes back to the type's icon. |
| `setMenu(items: MenuItem[])` | Items shown above the app's own in the window's menu. Choosing one sends a `menu` event. |
| `setCloseQuestion(question \| null)` | A question asked before the window closes (unsaved changes). |
| `emit(port, value)` | Sends a value from an out-port along its links. |
| `setPorts(ports \| null)` | Ports of its own, over its type's. |
| `close()` | Closes the window. |
| `keepAlive(on)` | Keeps the frame loaded while it's off screen. At most 4 per plugin. |
| `connectDialog()` | Opens the dialog for linking its ports. |
| `openChild({ kind?, title?, data?, frame?, focus? })` | Opens a child window of this plugin. Child windows close when this window does. Resolves with the new window's id. |
| `children()` | Its child windows open now. |
| `parent()` | The window it was opened from, or `null`. |
| `setExtent({ left?, right?, top?, bottom? }, { animate? })` | Grows the window on the canvas by that much on each side given (the frame's CSS pixels), past its size without it, so a sidebar gets room of its own instead of covering the content. Left and top move the window as it grows; `0` gives a side back; sides not given stay. Kept in the window's data. Resolves with the extent now. |
| `extent` | How far it's grown now, by side. |

### host.app

| Method | What it does |
|---|---|
| `openFile(path, { line?, server?, with?, choose? })` | Opens a file in the window type whose `opens` scores it highest, or the one `with` names. `choose: true` asks the user (Open With…). |
| `newNode(plugin, kind, { data?, state?, server?, title?, below?, frame? })` | Opens a new window. `frame` places it exactly, in canvas units. |
| `focusWindow(id)`, `closeWindow(id)` | Focuses or closes a window. |
| `openPage(page)` | Opens one of its pages, `plugins`, or `plugins/<id>`. |
| `toast(message, { description?, error? })` | A toast. |
| `openExternal(url)` | Opens http, https and mailto links, and schemes the user allowed. |
| `clipboardRead(format?)`, `clipboardFormats()` | Reads the clipboard. Needs `clipboard-read`. |
| `clipboardWrite({ text?, html?, image? })` | Writes to the clipboard while one of its windows has the keyboard. |
| `download(paths, { server? })` | Copies files on a server to this machine. Desktop app only. |
| `saveStream(plugin, request, { name?, server? })` | Saves the stream a server part replies with to a file. Desktop app only. |
| `notify({ title, body?, silent?, actions? })` | A system notification. Needs `notifications`. |
| `setBadge(count \| null)` | Its count on the app's badge. Needs `tray`. |
| `linkFor(path?, query?)` | A `hyperpane://plugin/<id>/…` link. With `deep-links`, opening one sends `link` to its frames. |
| `authorize(options, { signal? })` | An OAuth sign-in in the person's browser, with PKCE. Needs `oauth`. |

### host.ui

| Method | What it does |
|---|---|
| `menu({ x, y }, items)` | A menu drawn by the app at frame coordinates, so it can go past the frame. Resolves with the chosen item's `id`, or `null`. |
| `confirm({ title, message, confirm?, destructive? })` | Resolves with `true` or `false`. |
| `prompt({ title, label, value?, placeholder? })` | Resolves with the text, or `null`. |
| `dialog<T>(view, { data?, title?, width?, height? })` | A modal frame of the same plugin (`host.view.type === 'dialog'`). Resolves with what the dialog passes to `closeDialog`, or `null`. |
| `closeDialog(result)` | Closes the dialog this frame is. |
| `size({ width?, height? })` | Sizes a card (height), a footer item (width, up to 320 px), or a dialog. |

### host.settings

`settings.get<T>(id)` reads one of the plugin's settings, with defaults filled in. `settings.set(id, value)` changes it. In React, `useSetting(id)` does both.

### Events

`host.on(event, fn)` listens for an event from the app and returns the unsubscribe.

| Event | Value | When |
|---|---|---|
| `theme` | `{ id, dark, vars }` | The theme changed. |
| `settings` | all its settings | A setting changed. |
| `window` | `{ title?, data?, server?, focused?, scroll?, named? }` | Its window changed. |
| `project` | `ProjectInfo \| null` | The project changed. |
| `servers` | `ServerInfo[]` | The servers changed. |
| `zoom` | `{ zoom }` | The canvas zoomed. |
| `visibility` | `{ visible }` | It went on or off screen. |
| `focus` | — | Its window got the keyboard. |
| `links`, `ports` | `{ links }`, `{ ports }` | Its links or ports changed. |
| `input` | `{ port, value, link }` | A value arrived at an in-port. |
| `connect`, `disconnect` | `{ link }` | A link was made or removed. |
| `menu` | `{ id, window }` | An item of `win.setMenu` was chosen, in that window's menu. |
| `action` | `{ id, window }` | A card's header button was pressed. `window`: the window the card is on, null in a sidebar. |
| `button` | `{ id, slot, window }` | One of its buttons without an `action` was pressed. `window`: the focused window's id, or null. |
| `command` | `{ id, window }` | One of its commands without an `action` ran. `window`: the focused window's id, or null. |
| `live` | `{ server, path, text }` | A file's unsaved text changed. |
| `dragover`, `dragleave`, `drop` | see `DropEvent` | Something is dragged over or dropped on the frame. Listening for `drop` makes the frame accept drops. |
| `close` | — | 300 ms before the frame is destroyed: a last chance to save. |
| `view`, `pointer`, `selection`, `windows`, `drawings` | | The canvas (with `canvas`). |
| `web` | `WebEvent` | Its web page (with `webview`). |
| `points` | contributions | What's contributed to its extension points changed. |
| `notificationClick` | `{ id, action? }` | One of its notifications was clicked. |
| `link` | `{ path, query, url }` | A link to the plugin was opened. |

```ts
// A command from plugin.json without an action:
useEffect(() => host.on('command', ({ id }) => id === 'find' && openFind()), [host]);
```

### The event bus

Events by topic between any plugins' parts, client and server, in the open project, or the whole server with `scope: 'server'`. `plugin.json`'s `events` sets what a plugin may publish and subscribe to.

```ts
await host.bus.publish('notes.saved', { path }); // resolves with how many it reached
const off = host.bus.subscribe('git.*', (event) => console.log(event.topic, event.data));
const count = await host.bus.request<Counts>('example.count', { text }, { timeout: 2000 });
```

| Method | What it does |
|---|---|
| `publish(topic, data?, { scope? })` | Sends an event to subscribers (not back to this frame). |
| `subscribe(pattern, handler, { onEnd? })` | A topic, `prefix.*`, or `*`. Returns the unsubscribe. For a request, what the handler returns is the answer, and `undefined` leaves it to others. |
| `request<R>(topic, data?, { scope?, timeout? })` | The first answer any subscriber gives. |

An event's fields are `topic`, `data`, `from` (`{ plugin, part, window? }`) and `project`.

### Ports and links

Windows have connectors (ports), declared per node type in `plugin.json`. Values flow along links from an out-port to an in-port of the same type.

| `host.ports` | What it does |
|---|---|
| `list` | Its ports now. |
| `emit(port, value)` | Sends a value from an out-port. |
| `onInput<T>(port, fn)` | Values arriving at an in-port. Returns the unsubscribe. |
| `value<T>(port)` | The latest value at an in-port. |
| `onConnect(fn)`, `onDisconnect(fn)` | Links coming and going. |
| `set(ports \| null)` | Ports of its own, over its type's. |

```ts
// Send the note's text to each new link from this window.
useEffect(
  () => host.ports.onConnect((link) => {
    if (link.from.window === host.window?.id) host.ports.emit('text', text());
  }),
  [host],
);
```

### More of the host

| Property | Permission | What it does |
|---|---|---|
| `host.canvas` | `canvas` (reading), `canvas-edit` (changing) | The canvas's view (`view`, `toScreen`, `toCanvas`, `setView`), the pointer, the selection (`select`, `reveal`), the focused window (`active`), and every window and drawing of the project (`windows`, `drawings`). With `canvas-edit`: `moveWindows`, `raise`, `draw`, `updateDrawings`, `eraseDrawings`. |
| `host.overlay.setHitAreas(rects)` | `canvas` | In an overlay, the rectangles that take the pointer. |
| `host.terminals` | `terminal` | The project's terminals: `list`, `open`, `input`, `run`, `read`, `watch`. |
| `host.editors` | `editor`, `editor-write` | The project's Editors: `list`, `read`, `watch`; with `editor-write`, `edit`, `insert`, `select`. |
| `host.extensions(point)` | — | What other plugins contributed to its extension points; `.watch`, `.call`, `.callAll`. |
| `host.web` | `webview` | A real web page in the frame: `load`, `place`, `back`, `forward`, `reload`, `stop`, `focus`, `devtools`, `on`. Desktop app only. With `webview-control` too: `run(script)`, a script in the page (its answer, as JSON), and `capture({ rect? })`, a PNG of it. |
| `host.windows` | `control` | Other plugins' windows, for those in `uses` and `dependencies`: `open(plugin, { kind?, data?, title?, frame? })` opens one as this window's child, `methods(plugin)` says what it offers (its `api`), `call(window, method, args, { timeout?, signal? })` asks it, `subscribe(window, method, args, fn)` follows a method that answers as it goes. |
| `host.serve(method, handler)` | — | Answers what the app asks of this frame: the methods in its plugin.json's `api` that other plugins call, `(args, { signal, emit, from }) => answer`. `emit` sends a value of a stream; `signal` aborts when the caller stops. Returns the undo. |
| `host.media` | `camera`, `microphone`, `screen` | `camera()`, `microphone()`, `screen()` give a `MediaStream`. A refusal is a `MediaError` with a `code`. |
| `host.drag` | — | `begin(e, payload)` and `start(e, payload)` to drag paths or text anywhere in the app; `upload(id, { folder, server? })` copies dropped files to a server. |
| `host.live` | — | `watch(server, path, fn)` and `set(server, path, text)`: a file's unsaved text, shared with the Editor. |

### Other client helpers

| Export | What it does |
|---|---|
| `files(host, server?)` | The Files plugin's calls, typed (`Entry`, `Listing`, `FileContent`). |
| `keys(mac)` | A shortcut label for this system: `keys('⌘S')` is `Ctrl+S` on Windows and Linux. |
| `appKeys(mac)` | The same for the app's canvas shortcuts (⌘ is Ctrl+Shift on Windows and Linux). |
| `mod(e)` | Whether a key event has ⌘ (Mac) or Ctrl (elsewhere). |
| `shortcutKey(e)` | The key of an event, lowercase, the same in any keyboard layout. |
| `formatSize`, `formatTime`, `formatAgo` | Sizes and times, as the app shows them. |
| `basename`, `dirname`, `join`, `extension`, `crumbs`, `isAbsolute` | Paths as servers send them: forward slashes on every system, `~` for home. |
| `MediaError`, `TimeoutError` | Errors from `host.media` and from extension point providers. |

## UI components

`@hyperpane/ui` is the kit the app itself is built with. Inside a window, components take the window's colors.

**Made for windows:**

| Component | What it is |
|---|---|
| `ToolButton` | A 28px square icon button for a window's toolbar: `label`, `icon` (a Lucide icon), `onClick`, `active`, `disabled`. |
| `NodeButton` | A 28px text button. `variant`: `default`, `primary`, `ghost`, `danger`. |
| `NodeInput` | A text field that fits a toolbar. `icon` puts one inside at the start, for a search field. |
| `NodeTextarea` | A field of several lines that looks like `NodeInput`: a description, a message, a body. |
| `NodeSelect` | A choice that fits a toolbar: `value`, `options`, `onChange`. |
| `NodeMessage` | A message in the middle of a window (empty, loading, failed). `error` turns it red. |
| `Empty` | An empty state: `icon`, `title`, `description`, `action`. `size="compact"` for a pane inside a window: smaller, and no border. |
| `useMenu()` | A right-click menu at the pointer: `menu.open(e, items)`, and render `menu.element`. In a frame, the app draws it. `null` items are separators. |
| `ContextMenu` | Its children, with a right-click menu (`items`). |
| `useAsync(load, deps)` | `{ value, error, loading, reload }` for a promise. |
| `fileIcon(name, kind?)` | A Lucide icon for a file name, or a folder. |
| `Toolbar`, `ToolbarSeparator`, `ToolbarSpacer`, `StatusBar` | A window's top and bottom bars. |
| `Tabs` | Tabs: `items`, `value`, `onValueChange`, `variant` (`underline`, `pills`). |
| `SplitPane`, `ResizeHandle`, `ColumnResizer` | Resizable areas and table columns. `SplitPane compactBelow={640} show="first" \| "second"` shows one pane at a time when narrow; `PaneBar` is the bar with a way back over the one shown. |
| `SidePanel` | A sidebar, an inspector or a preview beside the content: `side`, `size`, `open`, `panel`. In a window on the canvas it grows the window as it opens (`mode="grow"`, the default) and gives the room back as it closes; `mode="squeeze"` takes the room from the content. Where nothing can grow and it's narrow, it opens over the content. |
| `useWindowExtent(side, size, open)` | The growing alone, for a layout of your own. |
| `Sheet`, `SheetContent` | A panel that slides in from a side or the bottom. |
| `JsonTree`, `JsonText` | A JSON value as a tree, or as text. |

**General:** `Button`, `Badge`, `Checkbox`, `Switch`, `Input`, `Textarea`, `Select`, `Picker`, `SegmentedControl`, `Field`, `FieldLabel`, `Label`, `Kbd`, `Progress`, `Spinner`, `Separator`, `ScrollArea`, `Tooltip`, `Empty`, `EmptyNote`, `Dialog` (with `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter`, `DialogClose`, `DialogTrigger`), `DropdownMenu` (with `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`), `Toast`, `ToastProvider`.

**Any size, down to a phone's.** A frame's viewport is the plugin's own room, so Tailwind's breakpoints answer for it (`max-sm:` is narrower than 640px). `useCompact(below?, ref?)` and `useWidth(ref?)` ask the same in code; `useTouch()` says a finger is used, when the kit's controls grow and the `touch:` variant applies to your own (`touch:h-10`). A long press is a right-click, so every menu works by touch. Dialogs come up from the bottom when narrow; `Toolbar` and `Tabs` scroll sideways when out of room, and `ToolbarGroup hideBelow="sm"` holds tools a narrow window can do without.

**For components of your own:** `cn` (class names), `styles`, `motion`, and the primitives (`Slot`, `usePopper`, `useDismissable`, `useControllableState`, `useRovingFocus`, `useResizable`, and `primitives`).

### Styling

Tailwind classes work as they do in the app: the app compiles your plugin's classes (from `src/client/**`) against its theme. Every theme arrives as CSS variables, light or dark, without a rebuild. Set `"tailwind": false` in `plugin.json` to get the kit's precompiled stylesheet instead.

Inside a window, use the window's colors:

| Variable | What it is |
|---|---|
| `--node-fg` | Text. |
| `--node-muted` | Secondary text. |
| `--node-border` | Lines. |
| `--node-header` | Bars. |
| `--node-accent` | The accent. |
| `--node-selection` | Selected rows. |
| `--node-hover`, `--node-active` | Hovered and pressed. |
| `--ansi-0` … `--ansi-15` | The terminal palette. |

Elsewhere (cards, pages, panels), use the app's tokens: `bg-background`, `text-muted-foreground`, and so on.

To look like the rest of the app, follow its scale:

- spacing on a 4px grid (`p-1` is 4px);
- corners `rounded-chip` (4px), `rounded-control` (6px), `rounded-surface` (8px), `rounded-panel` (12px);
- text `text-2xs` (11px), `text-xs` (12px, the size inside windows), `text-sm` (13px), `text-base` (14px);
- a window's toolbar is 32px with 24px buttons;
- icons are 14px in rows and small controls, 16px on taller ones.

## The server part

The server part is a Node process on each server that needs it. It starts on the first call and stops when idle. It does the work: files, processes, the network.

```ts
// src/server/main.ts
import { serve, json, PluginError } from '@hyperpane/sdk/server';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

serve(
  json((host) => ({
    calls: {
      // host.call('notes', { op: 'read', project }) from a frame
      read: async ({ project }) => {
        const dir = await host.projectStorage(project);
        try {
          return JSON.parse(await readFile(path.join(dir, 'notes.json'), 'utf8'));
        } catch {
          throw new PluginError("Couldn't read notes.json.");
        }
      },
    },
    subscriptions: {
      // host.subscribe('notes', { op: 'watch', path }, …) from a frame
      watch: async ({ path }, out) => {
        const watcher = fs.watch(path, () => out.emit({ changed: true }));
        await new Promise((r) => out.signal.addEventListener('abort', r));
        watcher.close();
      },
    },
  })),
);
```

**stdout belongs to the protocol.** `console.*` and `process.stdout.write` go to stderr, which is the plugin's log. The Plugins page shows the log.

### serve and json

| Export | What it does |
|---|---|
| `serve(make)` | Connects to the server, calls `make(host)` once the server has said hello, and answers calls with the plugin it returns. |
| `json(spec)` | Makes a plugin of JSON calls by `op`. `spec` is an object, or a function of the host. |
| `PluginError` | An error whose message reaches the user as written. Other errors' messages reach them too, and their stacks go to the log. |
| `HostError` | What `host.call` and friends reject with. Its message is for the user. |
| `typedBus<Topics>(host.bus)` | The bus, typed by a topic map. |

A `json` spec (`JsonSpec`) has:

| Field | Shape | What it is |
|---|---|---|
| `calls` | `{ [op]: (req, ctx) => reply }` | One reply each, returned or resolved. A throw replies with the error. |
| `subscriptions` | `{ [op]: (req, out, ctx) => void \| Promise<void> }` | `out.emit(event)` sends an event and returns `false` once the client is gone; `out.signal` aborts then. One that returns a promise ends when it settles. One that returns nothing stays open until the client cancels. |
| `events` | `{ [pattern]: (event, { host }) => answer }` | Bus handlers, subscribed as the part starts. |
| `inputs` | `{ [port]: (value, at) => void }` | Values at its windows' in-ports. |
| `schedules` | `{ [id]: (when, { host, signal }) => unknown }` | Its scheduled jobs. |
| `windowClosed(project, window)` | hook | One of its windows closed: stop what it ran. |
| `projectOff(project)` | hook | It was turned off in a project: end its work there. |
| `connected` / `disconnected(project, link)` | hook | A link to one of its windows. |
| `busy()` | hook | Return `true` while work is running, to keep an idle server part up. |
| `shutdown()` | hook | 2.5 seconds to end everything. |

The context (`CallContext`) is `{ host, signal, from, project }`. `from` is the plugin that made the call (one that depends on yours), or `null` for a client. An unknown op replies "This plugin has no op `x`."

Don't block the event loop for long: the server pings every 30 seconds and ends a process that doesn't answer within 10. Put heavy work in `worker_threads`, and import heavy dependencies inside the op that needs them so the process starts fast.

### The server host

**Who and where:**

| Member | What it is |
|---|---|
| `host.id`, `host.version` | From `plugin.json`. |
| `host.dataDir` | `<server data>/plugins/<id>/`: this machine's own files, made on first use. |
| `host.info` | `{ os, arch, target, serverVersion, hostname, home, user }`. |
| `host.projects()` | The projects this server is home to: `[{ id, name, folder }]`. |
| `host.projectFolder(project)` | Its folder, or `null`. |
| `await host.windows(project)` | This plugin's windows there: `[{ id, kind, title, data, state }]`. |
| `await host.projectStorage(project)` | `<project folder>/.hyperpane/<id>/`, made if missing. |

**Other plugins:**

```ts
const listing = await host.call('files', { op: 'list', path }, { project, signal });
const cancel = host.subscribe('files', { op: 'watch', path }, (listing) => update(listing), { project, signal, onEnd(error) {} });
```

Only plugins in `dependencies` and `uses` can be called. `host.uses` lists both.

**Windows and the user:**

```ts
await host.notify(project, { title: 'Pushed main', description: '3 commits' }); // a toast
host.updateWindow(project, window, { title: 'main' });
host.updateWindow(project, window, { data: { key: 'path', value: '/x' } });  // shared, in the project
host.updateWindow(project, window, { state: { key: 'k', value: null } });    // this machine's
host.updateWindow(project, window, 'close');
host.emit(project, window, 'out', value); // from an out-port, along its links
```

**Processes and the log:**

```ts
const child = host.spawn('git', ['status'], { cwd, project }); // hidden on Windows, tracked until it exits
host.track(project, pid);
host.untrack(pid);
host.log('something happened', detail);
```

Tracked processes end when the server ends, however it ends.

**Also on the host:** `host.bus` (the event bus, the same as the client's, plus `{ project }` or `{ scope: 'server' }` on `publish`), `host.ports` (`onInput`, `onConnect`, `onDisconnect`, `emit`), `host.terminals(project)` (with `terminal`), `host.canvas(project)` (with `canvas` and `canvas-edit`), and `host.authorize(project, options)` (with `oauth`).

### Settings and secrets

```ts
const s = await host.settings();          // the server's, with defaults
const p = await host.settings(project);   // with that project's over them
const off = host.onSettings((values, project) => reload(values)); // project null: the server's changed

await host.secrets.set('token', value);   // names: [A-Za-z0-9._-]{1,128}, values up to 64 KiB
await host.secrets.get('token');          // the value, or null
await host.secrets.delete('token');
```

Secrets are per plugin, encrypted on the server, and never land in shared files or logs.

### Scheduled jobs

Declare them in `server.schedules` in `plugin.json`, then handle them:

```ts
host.onSchedule('tidy', async (when, { signal }) => tidy(signal));
// or, in a json spec:
json({ schedules: { tidy: async (when, { host, signal }) => tidy(signal) } });
```

The server starts the part when a job is due, even with nobody connected. A run ends when the handler settles; a throw is shown as its error on the Plugins page. A run is cancelled (`signal`) after its `timeout`. A job runs once per server, not per project: go through `host.projects()` when it's about them.

### Paths and helpers

Clients see the same paths on every server: forward slashes on Windows too (`C:/Users/me/app`), and `~` for home.

```ts
import { fromClient, shown, moveToTrash, powershell, killTree } from '@hyperpane/sdk/server';

await fs.readFile(fromClient(request.path)); // '~/x' → '/Users/me/x'; 'C:/x' → 'C:\x' on Windows
return { path: shown(realPath) };            // 'C:\x' → 'C:/x'
await moveToTrash(path);                     // the Trash or the Recycle Bin
await killTree(pid);                         // a process and everything below it
```

`isFull` and `canonical` are there too. On Windows, `powershell()` gives one hidden PowerShell per process (`await ps.run<T>(script)`).

## Storage and state

| Where | Who sees it | How |
|---|---|---|
| A window's shared data | Everyone with the project (saved in `project.json`) | `host.win.setData`, `useData()`; server: `updateWindow(…, { data })` |
| A window's state | This machine only | `newNode(…, { state })`; server: `updateWindow(…, { state })`, `host.windows(project)` |
| Settings | The user, set in Plugins | `useSetting`, `host.settings` |
| Project storage | Everyone with the project, if they commit it | `host.projectStorage(project)` |
| The plugin's data folder | That server only | `host.dataDir` |
| Secrets | The plugin, on that server | `host.secrets` |
| Unsaved text | Every plugin that uses `files` | `host.live` |

Keep machine-specific things in `dataDir`, not in project storage.

## Menus

A plugin can add to menus in three ways.

**A window's own menu.** `host.win.setMenu(items)` puts items above the app's own in the window's menu. Choosing one sends a `menu` event:

```ts
host.win.setMenu([{ id: 'refresh', label: 'Refresh' }, { id: 'sep', label: '', separator: true }, { id: 'clear', label: 'Clear', danger: true }]);
host.on('menu', ({ id }) => (id === 'refresh' ? refresh() : id === 'clear' && clear()));
```

**A menu at the pointer.** `useMenu()` from `@hyperpane/ui`, or `host.ui.menu(at, items)`:

```tsx
const menu = useMenu();
return (
  <div onContextMenu={(e) => menu.open(e, [{ label: 'Pin', run: pin }, null, { label: 'Clear', danger: true, run: clear }])}>
    …
    {menu.element}
  </div>
);
```

**The app's menus**, declared in `plugin.json`'s `contributes.menus`. `where` is a `MenuWhere`: `window`, `canvas`, `server`, `project`, `plugin` or `sidebar`. These items open a window (`newNode`), one of its pages (`openPage`), or publish what they were chosen on (`publish`: the right-clicked window's id and more), with placeholders like `${window.id}`, `${project.folder}` or `${window.data.KEY}`:

```json
"menus": [
  { "where": "server", "label": "Count code on ${server.name}", "action": { "newNode": { "plugin": "codestats", "kind": "codestats" } } }
]
```

`MenuWhere` is exported from `@hyperpane/sdk/manifest`. See [menus in plugin.json](/docs/plugins/manifest#menus) for every field and placeholder. Buttons and commands, which run any action or send a `button` or `command` event, are covered there too.

## Pages

A plugin can have pages of its own in the app, declared in `contributes.pages`. A page's frame has `host.view.type === 'page'` and fills the app's main area, with the app's colors (not a window's):

```json
"pages": [{ "id": "all", "title": "All notes", "icon": "icons/note.svg" }]
```

```tsx
mount((host) => (host.view.type === 'page' && host.view.id === 'all' ? <AllNotes /> : null));
```

Open a page with `host.app.openPage('all')`, or with an `{ "openPage": "all" }` action on a button, command or menu item.

Your plugin also has a page in the Plugins list. That page shows your `README.md` under the name, icon and description from `plugin.json`. See [Writing a plugin](/docs/plugins/writing#your-plugins-page).

## Testing

`@hyperpane/sdk/testing` runs both parts without a server or the app.

**The server part:**

```ts
import { testHost, invoke, stream } from '@hyperpane/sdk/testing';

const host = testHost({ id: 'notes', projects: [{ id: 'p1', name: 'app', folder: tmp }], settings: { depth: 2 } });
const plugin = notes(host); // what main.ts serves
assert.deepEqual(await invoke(plugin, { op: 'read', project: 'p1' }), []);
const watch = stream(plugin, { op: 'watch', path: tmp });
await watch.next();
watch.cancel();
host.notices; host.updates; host.emitted; host.logs; // what it did
```

`testHost` keeps settings and secrets in memory and `projectStorage` in the project folders you give it. It routes `call` and `subscribe` to plugins passed as `dependencies`. `testBus()` gives several test hosts one bus; `host.runSchedule(id)` runs a scheduled job.

**The client part:**

```ts
import { fakeHost } from '@hyperpane/sdk/testing';

const { host, app, close } = await fakeHost({
  plugin: { id: 'notes', version: '0.1.0' },
  settings: { depth: 2 },
  answers: { 'server.call': ({ request }) => (request.op === 'read' ? ['a.md'] : null) },
});
assert.deepEqual(await host.call('notes', { op: 'read' }), ['a.md']);
host.win.setTitle('Notes');
assert.deepEqual((await app.next('window.setTitle')).a, { title: 'Notes' });
app.event('zoom', { zoom: 0.5 });
close();
```

The fake app answers every method with no value unless `answers` says otherwise. It keeps what the frame sent (`app.sent`, `app.calls(m)`, `app.last(m)`). `bootFrame(() => import('../src/client/main.tsx'))` starts a frame's main file the way the app does. Node doesn't run `.tsx` on its own, so keep the logic you test in `.ts` files, or add a transform.

Run tests with `node --test` and the SDK's `register.mjs`. The template's `./build.sh --test` does both.
