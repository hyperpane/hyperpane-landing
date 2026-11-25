---
title: Writing a plugin
description: "Make a plugin from the template: its folder, plugin.json, its windows, a server part, testing it live, and sharing it on GitHub."
section: Plugins
order: 21
---

# Writing a plugin

Every window in hyperpane is a plugin, and the built-in ones are written with the same SDK you get. A plugin has up to two parts:

- **The client part** is a web app (React and TypeScript) that runs in a sandboxed frame, one per window, card, page or panel. It draws the interface and reaches everything else through the app.
- **The server part** is optional. It's a Node process on hyperpane's server, the one that holds the project, started on the first call and stopped when idle. It does the work: reading files, running processes, using the network.

You write both parts in TypeScript under `src/`; a build turns them into `dist/`, which is what a server runs and sends to the apps.

This page walks you through the template from start to finish. For the full API, see the [SDK reference](/docs/plugins/sdk). For every manifest field, see [plugin.json](/docs/plugins/manifest).

## What you need

- **A hyperpane server** to run it on: this machine's (the app starts one) or any other.
- **Node 24 or newer, with npm**, to build it. The template's `build.sh` installs the type checker and the SDK's types, checks the plugin, runs the tests, and builds it.
- **The SDK repository** ([hyperpane/hyperpane-sdk](https://github.com/hyperpane/hyperpane-sdk)): its `tools/plugins.mjs` builds plugins. Clone it beside your plugin, or point `HYPERPANE_SDK_REPO` at it.

## Start from the template

The template lives in the SDK's repository as `template/`. Copy it, then rename the folder and the `id` in `plugin.json` to your plugin's id (2–32 lowercase letters, digits and dashes, starting with a letter).

The template is a working plugin called Example. It has two window types (**Note** and **Stats**) linked by ports, a **Pinned notes** card, a server part that keeps pins in the project, settings, a secret, and the event bus. It's easiest to change it into your own plugin rather than start from an empty folder.

## The folder

```
my-plugin/
├── plugin.json            the manifest
├── icon.svg               the plugin's icon
├── icons/                 window type and card icons
├── README.md              the plugin's page in Plugins
├── build.sh, build.bat    install the dev tools, check, test, build
├── package.json           dev tools only (TypeScript, types); never shipped
├── src/                   what you write
│   ├── client/
│   │   ├── main.tsx       the client part's entry
│   │   ├── app/App.tsx    which view a frame is
│   │   ├── views/         one file per view
│   │   ├── lib/           helpers
│   │   └── tsconfig.json
│   ├── server/
│   │   ├── main.ts        the server part's entry
│   │   ├── plugin.ts      its calls and subscriptions
│   │   ├── ops/           groups of calls
│   │   ├── package.json   must say "type": "module"
│   │   └── tsconfig.json
│   └── shared/            types and code both parts use
├── dist/                  what runs: built from src/ (below)
│   ├── client/            the interface: index.html, its bundled code, client.json
│   └── server/main.mjs    the server part, one module with its dependencies
└── test/
    ├── server/            tests of the server part
    └── client/            tests of client code against a fake app
```

`dist/` is what a server runs and what it sends to the apps; `src/` is only for you (a plugin you share may leave it out). The app runs no plugin code of its own and builds nothing: every plugin's interface comes from the server it's on.

The rules the checks apply:

- The folder's name must equal the plugin's `id`.
- `client.main` is a path inside `src/client/`, and `server.main` is a path inside `src/server/`: the build starts there.
- `src/server/package.json` says `"type": "module"`.
- Relative imports name the file with its extension (`import { count } from '../shared/count.ts'`), and types come in with `import type`. The template's `tsconfig.json` files check this.

## plugin.json

The template's manifest, trimmed down:

```json
{
  "manifest": 1,
  "id": "example",
  "name": "Example",
  "version": "0.1.0",
  "publisher": "you",
  "description": "Notes that send their text along links, a Stats node that counts it, and a card of pinned notes.",
  "icon": "icon.svg",
  "category": "Other",
  "engines": { "hyperpane": ">=0.1.5", "node": ">=22.15.0" },
  "client": { "main": "main.tsx" },
  "server": { "runtime": "node", "main": "main.ts" },
  "events": { "publish": ["example.pinned"], "subscribe": ["example.pinned", "example.count"] },
  "contributes": {
    "nodes": [
      {
        "kind": "note",
        "title": "Note",
        "icon": "icons/note.svg",
        "size": [320, 260],
        "data": { "text": "" },
        "ports": [
          { "id": "text", "label": "Text in", "direction": "in", "type": "text" },
          { "id": "text", "label": "Text", "direction": "out", "type": "text" }
        ]
      }
    ],
    "cards": [{ "id": "pins", "title": "Pinned notes", "icon": "icons/pin.svg", "place": "right", "order": 10 }],
    "settings": [
      { "id": "noteFontSize", "title": "Note text size", "type": "number", "default": 14, "min": 10, "max": 32, "unit": "px" }
    ]
  }
}
```

To make it yours:

1. Set `id` (and rename the folder to match), `name`, `description` and `publisher`.
2. Replace the icons. Icons are SVGs in a 24-unit box, stroked, the way Lucide draws them.
3. List your window types under `contributes.nodes`. Each `kind` is what your client part sees as `host.view.kind`.
4. Drop `server` if your plugin doesn't need one. A plugin with only a client part is fine; the Pets plugin is one.

Window types, cards, pages, side panels, overlays, toolbar buttons, commands with shortcuts, menu items and settings are all declared here. See [plugin.json](/docs/plugins/manifest) for each one.

## The window UI

The client part's entry calls `mount()`, which connects to the app, applies the theme, and renders your React tree. One client part serves every view, so it checks `host.view` to see which one this frame is:

```tsx
// src/client/main.tsx
import { mount } from '@hyperpane/sdk/client';
import { App } from './app/App.tsx';

mount((host) => <App host={host} />);
```

```tsx
// src/client/app/App.tsx
import type { Host } from '@hyperpane/sdk/client';
import { NodeMessage } from '@hyperpane/ui';
import { Note } from '../views/Note.tsx';
import { Pins } from '../views/Pins.tsx';

export function App({ host }: { host: Host }) {
  const view = host.view;
  if (view.type === 'node' && view.kind === 'note') return <Note />;
  if (view.type === 'card' && view.id === 'pins') return <Pins />;
  return <NodeMessage error>Example has no “{view.type}” view here.</NodeMessage>;
}
```

A view reads the app's state through hooks, which re-render when it changes. Here is a smaller version of the template's Note:

```tsx
// src/client/views/Note.tsx
import { useState } from 'react';
import { Pin } from 'lucide-react';
import { useData, useHost, useProject, useSetting } from '@hyperpane/sdk/client';
import { ToolButton } from '@hyperpane/ui';

export function Note() {
  const host = useHost();
  const data = useData();                                   // the window's shared data
  const project = useProject();
  const [fontSize] = useSetting<number>('noteFontSize');   // one of its settings
  const [text, setText] = useState(data.text ?? '');

  const save = (value: string) => {
    setText(value);
    host.win.setData('text', value);                        // saved in the project
    host.ports.emit('text', value);                         // sent along its links
  };

  const pin = async () => {
    try {
      const n = await host.call<number>('example', { op: 'pin', project: project?.id, text });
      host.app.toast('Pinned', { description: `${n} pinned in ${project?.name ?? 'this project'}.` });
    } catch (e) {
      host.app.toast("Couldn't pin it", { description: (e as Error).message, error: true });
    }
  };

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex h-8 flex-none items-center gap-1 border-b border-[var(--node-border)] px-1.5">
        <span className="flex-1 truncate px-1 text-xs text-[var(--node-muted)]">Note</span>
        <ToolButton label="Pin to the project" icon={Pin} onClick={pin} disabled={!project || !text.trim()} />
      </div>
      <textarea
        className="min-h-0 w-full flex-1 resize-none bg-transparent p-2 outline-none"
        style={{ fontSize: `${fontSize}px` }}
        value={text}
        onChange={(e) => save(e.target.value)}
      />
    </div>
  );
}
```

Some things to know about how frames work:

- **Styling.** Tailwind classes work as they do in the app. The build compiles the classes your client code uses, on the app's theme tokens. Inside a window, use the window's colors (`--node-fg`, `--node-muted`, `--node-border`, `--node-accent` and the rest) so it follows every theme. The [SDK reference](/docs/plugins/sdk#styling) lists them.
- **Components.** `@hyperpane/ui` has the app's own components: `ToolButton`, `NodeButton`, `NodeInput`, `NodeMessage`, `Tabs`, `Toolbar`, `useMenu`, and more. React, the SDK, the UI kit, CodeMirror and Lucide icons come with the SDK, in the app's versions: you don't install them, and the build bundles one copy of each.
- **No network.** Frames have no network by default. Do network work in the server part, or ask for the `network` permission.
- **Input.** The app handles canvas input for you. The first click on a window only focuses it, wheel events that nothing in the frame scrolls pan the canvas, and the app's shortcuts work unless your handler calls `preventDefault()`.
- **Other npm packages** for the client go in `src/client/package.json` and are installed into `src/client/node_modules`. The build bundles them.

## A server part

The server part's entry hands a plugin to `serve()`. The template keeps the plugin in its own file so tests can build it with a test host:

```ts
// src/server/main.ts
import { serve } from '@hyperpane/sdk/server';
import { example } from './plugin.ts';

serve(example);
```

`json()` turns an object of handlers into a plugin that answers JSON calls by their `op`. A **call** returns its reply. A **subscription** sends events until the client cancels:

```ts
// src/server/plugin.ts
import { EventEmitter } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Host, json, PluginError } from '@hyperpane/sdk/server';
import { count } from '../shared/count.ts';

interface Pin { id: string; text: string; at: number }

export const example = json((host: Host) => {
  const changes = new EventEmitter();

  async function file(project: string) {
    if (typeof project !== 'string' || !project) throw new PluginError('Open a project to pin notes in it.');
    return path.join(await host.projectStorage(project), 'pins.json'); // <project>/.hyperpane/example/
  }
  async function load(project: string): Promise<Pin[]> {
    try {
      return JSON.parse(await readFile(await file(project), 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  return {
    calls: {
      count: ({ text }) => count(String(text ?? '')),
      pin: async ({ project, text }) => {
        if (!String(text ?? '').trim()) throw new PluginError('There’s nothing to pin: the note is empty.');
        const pins = await load(project);
        pins.unshift({ id: `${Date.now().toString(36)}-${pins.length}`, text: String(text), at: Date.now() });
        await writeFile(await file(project), JSON.stringify(pins, null, 2));
        changes.emit(project, pins);
        return pins.length;
      },
    },
    subscriptions: {
      // The pins now, and again whenever they change, until the client cancels.
      pins: async ({ project }, out) => {
        out.emit(await load(project));
        const send = (pins: Pin[]) => out.emit(pins);
        changes.on(project, send);
        await new Promise((resolve) => out.signal.addEventListener('abort', resolve, { once: true }));
        changes.off(project, send);
      },
    },
    projectOff: (project) => changes.removeAllListeners(project),
  };
});
```

The client calls it by the plugin's id:

```tsx
// A call: one request, one reply.
const n = await host.call<number>('example', { op: 'pin', project: project.id, text });

// A subscription: returns the cancel, so it fits in an effect.
useEffect(() => {
  if (!project) return;
  return host.subscribe<Pin[]>('example', { op: 'pins', project: project.id }, setPins, {
    onEnd: (error) => error && setError(error),
  });
}, [project?.id, host]);
```

Things to know about the server part:

- **Errors.** Throw a `PluginError` for a message the user should read as written. Any other error's message reaches them too, and its stack goes to the plugin's log.
- **stdout is for the protocol.** `console.log` goes to stderr, which is the plugin's log. The Plugins page shows it.
- **Where to keep things.** `host.projectStorage(project)` is a folder inside the project (`.hyperpane/<id>/`), so teammates who commit the project get it too. `host.dataDir` is this machine's own. Keep tokens in `host.secrets`.
- **Other plugins.** `host.call('files', …)` reaches another plugin's server part, if it's in your `dependencies` or `uses`.
- **Don't block.** The server ends a process that stops answering its pings. Move heavy work to `worker_threads`.
- **npm packages** go in `src/server/package.json` and are installed into `src/server/node_modules`. The build bundles them into `dist/server/main.mjs`. They must be pure JavaScript, without native addons.

Code both parts use (types, the bus's topics, a counting function) goes in `src/shared/`. The build bundles it into each part that imports it.

## Building and checking

```sh
./build.sh               # install the dev tools, type-check both parts, check plugin.json, build dist/
./build.sh --test        # the same, and run the tests
./build.sh --no-install  # check and build only
./build.sh --no-build    # don't build dist/
./build.sh --quiet       # print only problems
```

Use `build.bat` on Windows. `build.sh` installs TypeScript and the SDK's types into `node_modules`, installs `src/client` and `src/server` dependencies in place, runs `tsc --noEmit` for each part, checks `plugin.json`, and builds `dist/` with the SDK's `tools/plugins.mjs`. To build without it:

```sh
node ../hyperpane-sdk/tools/plugins.mjs build .
```

The build bundles each part with what it imports, npm packages included:

- **The interface** goes to `dist/client/`: an `index.html`, its code and styles in files named by their hash, the fonts and images it uses, and `client.json` listing every file with its sha256. Servers send these files to the apps as they are, and the apps check each against its hash.
- **The server part** goes to `dist/server/main.mjs`, one module. The SDK comes from the server that runs it.
- The plugin's icons are copied beside them.

To run only the manifest check:

```sh
node node_modules/@hyperpane/sdk/manifest/cli.js check .
```

## Running it in the app

A server runs the plugins in its **plugins folder**: for this machine's server, `~/.hyperpane/plugins` (`%APPDATA%\hyperpane\plugins` on Windows), unless you set another in its [settings](/docs/servers#plugins-folder). Put your plugin there, or a link to it, and it runs:

```sh
ln -s ~/work/my-plugin ~/.hyperpane/plugins/my-plugin    # the link's name is the plugin's id
./build.sh --no-install                                  # after each change
```

- The server looks at the folder every 2 seconds. It reads your plugin again when its `plugin.json` or `dist/client/client.json` changes, which every build does.
- A changed **server part** is replaced: the old one stops, the next call starts the new one.
- A changed **interface** reaches the app at once: your plugin's windows load again with the new files. Windows and their data stay.
- In the app, the plugin shows on the Plugins page, on in every project. Open a window of it from the canvas's new-window menu, or see its card in the sidebar. **Logs** on its page shows its server part's log, live; so does `hyperpane plugins log <id>`.

If `plugin.json` has a problem, the server logs it and leaves the plugin out until it's fixed.

## Driving other plugins' windows

A plugin can open another plugin's window and use it: an AI plugin opens a Browser, goes to a page, reads it and clicks. Ask for the `control` permission and name the plugin in `uses`:

```json
"permissions": ["control"],
"uses": ["browser"]
```

```ts
const tools = await host.windows.methods('browser');          // what it offers, with JSON Schemas
const browser = await host.windows.open('browser', { data: { url: 'example.com' } });
await host.windows.call(browser, 'waitForLoad');
const { text } = await host.windows.call(browser, 'text', { max: 20_000 });
await host.windows.call(browser, 'click', { text: 'Learn more' });
```

The window opens as your window's child: beside it, closed with it, kept running while it's open. The user sees it on the canvas.

To let other plugins drive **your** windows, list what they answer in plugin.json's [`api`](/docs/plugins/manifest#api) and answer each with `host.serve`:

```ts
host.serve('open', async ({ url }, { signal, from }) => {
  // from: the plugin (and window) that called
  return { url };
});
```

Calls to anything not in `api` are refused before they reach your frame. See [`windows.*`](/docs/reference/rpc#windows-other-plugins-windows).

## More room for a window

A sidebar or an inspector can grow the window instead of covering its content. The UI kit's `SidePanel` does it:

```tsx
import { SidePanel } from '@hyperpane/ui';

<SidePanel open={open} side="right" size={280} panel={<Inspector />}>
  <Main />
</SidePanel>
```

Opening it makes the window 280 wider on the canvas; closing it gives the room back. `mode="squeeze"` takes the room from the content instead. For a layout of your own, `host.win.setExtent({ right: 280 })` (and `{ right: 0 }`) does the growing; `host.win.openChild` opens another window of yours beside this one instead. All of it is optional.

## Testing

`@hyperpane/sdk/testing` runs your plugin without a server or the app. Tests go in `test/` and run with `./build.sh --test`.

The server part, with a test host:

```ts
// test/server/plugin.test.ts
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { invoke, stream, testHost } from '@hyperpane/sdk/testing';
import { example } from '../../src/server/plugin.ts';

const folder = await mkdtemp(path.join(os.tmpdir(), 'example-project-'));
const host = testHost({ id: 'example', projects: [{ id: 'p1', name: 'app', folder }] });
const plugin = example(host);

test('counts words, lines and characters', async () => {
  assert.deepEqual(await invoke(plugin, { op: 'count', text: 'one two\nthree' }), { words: 3, lines: 2, characters: 13 });
});

test('pins notes in the project, and streams them', async () => {
  const pins = stream(plugin, { op: 'pins', project: 'p1' });
  assert.deepEqual(await pins.next(), []);
  assert.equal(await invoke(plugin, { op: 'pin', project: 'p1', text: 'first' }), 1);
  pins.cancel();
});

test('refuses with a message for the user', async () => {
  await assert.rejects(invoke(plugin, { op: 'pin', project: 'p1', text: '  ' }), { message: 'There’s nothing to pin: the note is empty.' });
});
```

Client code, with a fake app that speaks the same protocol as the real one:

```ts
// test/client/links.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fakeHost } from '@hyperpane/sdk/testing';

test('a Note sends its text from its out-port', async () => {
  const { host, app, close } = await fakeHost({
    plugin: { id: 'example', version: '0.1.0' },
    ports: [{ id: 'text', label: 'Text', direction: 'out', type: 'text' }],
  });
  try {
    host.ports.emit('text', 'hello');
    assert.deepEqual((await app.next('window.emit')).a, { port: 'text', value: 'hello' });
  } finally {
    close();
  }
});
```

Node doesn't run `.tsx` on its own, so keep the logic you want to test in `.ts` files, as the template's `lib/links.ts` does. The [SDK reference](/docs/plugins/sdk#testing) covers the test hosts in full.

## Your plugin's page

On the Plugins page, and on GitHub, your plugin's page is its `README.md`, shown under the name, icon and description from `plugin.json`. hyperpane's own plugins follow one outline, and yours will fit in if it does too:

```markdown
# Name

The tagline, as a sentence. Then two or three sentences: what it is, who
it's for, what makes it worth having.

## Features

- **A thing it does:** what you get, in a line or two.

## How to use

1. Open it: where it is (the + menu, a command, a right-click).
2. The first thing you do.

## Settings            (only if it has settings)

| Setting | What it does | Default |
| --- | --- | --- |

## Permissions         (only if it asks for any)

| Permission | Why |
| --- | --- |

## Good to know        (limits, what it needs, what it won't do)

## How it works        (where it runs, what it calls)

## Develop

    ./build.sh --test
```

Write it plainly, in the second person, about what the user gets. Give every setting, window type, card, command and button in `plugin.json` a title people understand, and explain every permission you ask for in the README's Permissions table.

## Sharing it

A server runs what's in its plugins folder, so sharing a plugin means getting its folder there: the person who runs the server puts it in, the same as you did.

- **As a folder or a repository.** Ship `plugin.json`, `dist/`, the icons and the README. `src/` is optional. If you share the repository, commit `dist/`, or ask people to build it.
- **As an archive.** `node ../hyperpane-sdk/tools/plugins.mjs pack --out DIR` makes `DIR/<id>.tar.gz` (with `dist/`) and a `SHA256SUMS.txt`, for a release page. Unpacked into a plugins folder, it runs.
- **Updates.** Raise `version` in `plugin.json`, build, and replace the folder. The server picks the new one up within 2 seconds.

Dependencies are bundled into `dist/` by the build, so nobody needs `node_modules`, npm or install scripts to run it.

### Signatures

Built-in plugins are signed by hyperpane. A plugin you share doesn't have to be: unsigned, it still runs, and the server notes it in its log. A signature currently covers `src/` and `plugin.json`'s working fields, not `dist/`; sign last, after the version bump. See [`signature`](/docs/plugins/manifest#signature).

## Next

- [SDK reference](/docs/plugins/sdk): everything the host offers both parts.
- [plugin.json](/docs/plugins/manifest): every field the manifest takes.
- [RPC reference](/docs/reference/rpc): the messages between a frame and the app.
