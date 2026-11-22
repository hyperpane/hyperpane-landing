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

Both parts are TypeScript that runs as written. There is no bundler and no build output.

This page walks you through the template from start to finish. For the full API, see the [SDK reference](/docs/plugins/sdk). For every manifest field, see [plugin.json](/docs/plugins/manifest).

## What you need

- **The desktop app.** You'll load and run your plugin in it.
- **Node 24 or newer, with npm**, for the template's `build.sh`. It installs the type checker and the SDK's types, and runs the tests. (The plugin itself doesn't need these to run.)
- **git**, if you'll share the plugin on GitHub. The app also uses git to install plugins from GitHub.

## Start from the template

The quickest way to start: open **Plugins**, choose **Add plugin**, then **New plugin**. Give it an id (2–32 lowercase letters, digits and dashes, starting with a letter) and a name. The app copies the template into your plugins folder under that id and opens the plugin's page.

The plugins folder is:

| System | Plugins folder |
|---|---|
| macOS, Linux | `~/.hyperpane/plugins` |
| Windows | `%APPDATA%\hyperpane\plugins` |

You can also copy the template by hand. It ships with the app (`resources/sdk/template`) and lives in the SDK's repository as `sdk/template`. If you copy it, rename the folder and the `id` in `plugin.json` to match.

The template is a working plugin called Example. It has two window types (**Note** and **Stats**) linked by ports, a **Pinned notes** card, a server part that keeps pins in the project, settings, a secret, and the event bus. It's easiest to change it into your own plugin rather than start from an empty folder.

## The folder

```
my-plugin/
├── plugin.json            the manifest
├── icon.svg               the plugin's icon
├── icons/                 window type and card icons
├── README.md              the plugin's page in Plugins
├── build.sh, build.bat    install the dev tools, check, test
├── package.json           dev tools only (TypeScript, types); never shipped
├── src/
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
└── test/
    ├── server/            tests of the server part
    └── client/            tests of client code against a fake app
```

The rules the app checks:

- The folder's name must equal the plugin's `id`.
- `client.main` is a path inside `src/client/`, and `server.main` is a path inside `src/server/`.
- `src/server/package.json` says `"type": "module"`.
- Relative imports name the file with its extension (`import { count } from '../shared/count.ts'`), and types come in with `import type`. Both parts run as written, so only TypeScript that erases cleanly works: no `enum`s, no `namespace`s with values. The template's `tsconfig.json` files check this.

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

- **Styling.** Tailwind classes work as they do in the app. The app compiles the classes your client code uses. Inside a window, use the window's colors (`--node-fg`, `--node-muted`, `--node-border`, `--node-accent` and the rest) so it follows every theme. The [SDK reference](/docs/plugins/sdk#styling) lists them.
- **Components.** `@hyperpane/ui` has the app's own components: `ToolButton`, `NodeButton`, `NodeInput`, `NodeMessage`, `Tabs`, `Toolbar`, `useMenu`, and more. React, the SDK, the UI kit, CodeMirror and Lucide icons always come from the app, so you don't install or bundle them.
- **No network.** Frames have no network by default. Do network work in the server part, or ask for the `network` permission.
- **Input.** The app handles canvas input for you. The first click on a window only focuses it, wheel events that nothing in the frame scrolls pan the canvas, and the app's shortcuts work unless your handler calls `preventDefault()`.
- **Other npm packages** for the client go in `src/client/package.json` and are installed into `src/client/node_modules`. They must be ES modules.

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
- **npm packages** go in `src/server/package.json` and are installed into `src/server/node_modules`. They must be pure JavaScript, without native addons, and their install scripts never run.

Code both parts use (types, the bus's topics, a counting function) goes in `src/shared/`. Both parts load it as written.

## Building and checking

```sh
./build.sh               # install the dev tools, type-check both parts, check plugin.json
./build.sh --test        # the same, then run the tests
./build.sh --no-install  # only check
./build.sh --quiet       # print only problems
```

Use `build.bat` on Windows. Nothing gets built: `build.sh` installs TypeScript and the SDK's types into `node_modules`, installs `src/client` and `src/server` dependencies in place, runs `tsc --noEmit` for each part, and checks `plugin.json` the same way the app does. To run only the manifest check:

```sh
node node_modules/@hyperpane/sdk/manifest/cli.js check .
```

## Running it in the app

You have three ways to run your plugin while you work on it.

**From the plugins folder.** A plugin made with **New plugin** is already there. The app notices changes in the plugins folder by itself:

1. Open a project, open your plugin's page in **Plugins**, and turn it on in the project. The app asks you to approve its permissions, and uploads its server part to the project's server.
2. Open a window of it from the canvas's new-window menu, or see its card in the sidebar.
3. After you change the client part, reload the window from its menu.
4. After you change the server part, choose **Update** on the plugin's page to upload it again.

**From the Development tab.** Turn on **Developer mode** in the Plugins page's **⋯** menu, open **Development** and **Add folder** (or drop your plugin's folder there). The app loads the plugin from that folder and watches it: saving a client file reloads its windows, and saving a server file (or `plugin.json`) installs its server part again on the project's server and restarts it. **Logs** shows its log live. It stays until you take the folder out or turn Developer mode off. See [Plugins](/docs/plugins#developer-mode).

**Live, from a terminal.** Dev mode watches your folder and reloads as you save:

```sh
hyperpane plugin dev                 # in the plugin's folder (npm run dev in the template)
hyperpane plugin dev ../my-plugin --project <project id>
```

- The **server part** is installed on this machine's server as a dev install, then installed again and restarted each time a file in `src/server/`, `src/shared/` or `plugin.json` changes. `--server KEY` uses another server. `--project` turns the plugin on in that project.
- The **log** prints as it's written: the server part's `console` output, the server's lines about it, and errors from its frames.
- The **app** loads the client part from your folder and reloads its frames when a file in `src/client/` or `src/shared/` changes. Windows and their data stay. The plugin's page shows a **Dev** badge, a live **Logs** tab and **Reload**.
- **Ctrl+C** stops it. The app goes back to the plugins folder's copy, if any, and the dev install is removed from the server (`--keep` leaves it).

If `plugin.json` has a problem, dev mode prints it and waits for you to fix it.

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

## Sharing it on GitHub

People install plugins from git repositories: in **Plugins**, they choose **Add plugin**, then **Install from GitHub**, and paste a link. The app clones the repository with the system's git, checks the package exactly as it checks any other, and puts it in their plugins folder under its id. It also remembers where the plugin came from, so they can update it later.

### Set up the repository

1. **Put the plugin at the root of the repository**, with `plugin.json` at the top. A plugin in a subfolder works too: people paste a link to that folder (`https://github.com/you/plugins/tree/main/notes`).
2. **Name it after the id.** hyperpane's own plugins live at `github.com/hyperpane/hp-<id>` (`hp-pets`, `hp-codestats`). Naming yours `hp-<id>` makes it easy to recognize. The repository name doesn't have to match the id, though: the app names the folder after the `id` in `plugin.json`.
3. **Set `homepage`** in `plugin.json` to the repository's address.
4. **Commit `src/client/node_modules` and `src/server/node_modules`** if your plugin has npm dependencies. The app never runs npm or install scripts: a package that lists dependencies must bring them. The template's `.gitignore` already leaves out only the root `node_modules` (your dev tools).
5. **Check it** with `./build.sh --test` before you push.

### Links people can paste

| Link | What it installs |
|---|---|
| `https://github.com/you/hp-notes` | The default branch. |
| `github.com/you/hp-notes` | The same, as copied from the address bar. |
| `https://github.com/you/hp-notes/tree/v0.2.0` | A branch or tag. |
| `https://github.com/you/plugins/tree/main/notes` | A plugin in a subfolder. |
| `git@github.com:you/hp-notes.git` | Over SSH. |

Other https git hosts work the same way, GitLab's `/-/tree/` links included. Private repositories work if the user's git can reach them. The app keeps no tokens: credentials are left to git.

### What happens when someone installs it

- The app warns that plugins run code with the user's access, and names the repository.
- It refuses a package that fails the checks, listing the problems, and refuses one whose id is already in the plugins folder.
- It shows the permissions the plugin asks for, and whether it has a server part. The user approves the permissions when they turn the plugin on in a project.
- The installed copy keeps no `.git` folder.

**Install from file** in the same menu takes a plugin's folder or a `.tar.gz` of one. That's useful for sharing a plugin without a repository.

### Releasing updates

Raise `version` in `plugin.json` and push. On your plugin's page, users choose **Check for updates**. The app looks at the repository, and if its `plugin.json` has a newer version, offers **Update to x.y.z**. The copy it replaces is kept in the plugins folder's `.backup`. If the user changed the plugin's files locally, the app asks before replacing them.

### Signatures

Built-in plugins are signed by hyperpane. A plugin you share doesn't have to be signed. Unsigned, it still installs, with a warning. If you do sign it, the app shows it as **Verified** once the user trusts you as a publisher, and refuses the package if any of its files changed after signing. So sign last, after the version bump. See [`signature`](/docs/plugins/manifest#signature).

## Next

- [SDK reference](/docs/plugins/sdk): everything the host offers both parts.
- [plugin.json](/docs/plugins/manifest): every field the manifest takes.
- [RPC reference](/docs/reference/rpc): the messages between a frame and the app.
