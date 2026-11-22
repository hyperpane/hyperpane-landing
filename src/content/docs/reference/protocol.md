---
title: Wire protocol
description: "How clients talk to a hyperpane server, and how a server talks to plugins' server parts: framing, messages, handshakes, versions and payloads."
section: Reference
order: 31
---

# Wire protocol

A hyperpane [server](/docs/servers) speaks two protocols:

| Protocol | Between | Transport | Encoding | Version |
|---|---|---|---|---|
| **Client protocol** | A client (the desktop app, the web app, the [`hyperpane` CLI](/docs/reference/cli), an agent) and a server | WebSocket, encrypted with Noise | postcard (binary) | `3` |
| **Plugin protocol** | A server and a plugin's server part | The process's stdin and stdout | Length-prefixed frames with a JSON header and a raw body | `1` |

Plugin calls ride through both: a client sends `Call::Plugin` with an opaque payload, the server hands that payload to the plugin's process as a `call` frame's body, and the reply comes back the same way. Payloads are the plugin's own business; hyperpane's plugins use [JSON or binary bodies](#bodies-json-and-binary), and Terminal uses its own [terminal protocol](#the-terminal-protocol).

A plugin's frame never speaks either protocol directly: it talks to the app over the [RPC](/docs/reference/rpc), and the app speaks the client protocol for it. If you write a plugin in TypeScript, `@hyperpane/sdk` implements everything here (see the [SDK reference](/docs/plugins/sdk)). Read on if you are writing a client, a server part in another language, or debugging.

The Rust crates in `core/` implement the client side:

| Crate | What it holds |
|---|---|
| `hyperpane-protocol` | The key, the Noise channel, the messages, project documents, the store's and server's JSON types, bodies and streams |
| `hyperpane-client` (`core/connection`) | A client connection with no I/O of its own: feed it WebSocket frames, send what it gives back. Runs natively and in WebAssembly. |
| `hyperpane-terminal-protocol` | Terminal's messages |
| `hyperpane-cli` | The `hyperpane` command, and a blocking native client |

The first half of this page is the client protocol, from [the server key](#the-server-key) to [connecting from Rust](#connecting-from-rust). The second half, from [the plugin protocol](#the-plugin-protocol) on, is what a server part speaks.

## The server key

A client needs the server's **key** to connect. It's the only way in: it grants full access as the server's user, so treat it like an SSH private key.

```text
hpk1_eyJpZCI6IjAxMjM0NTY3ODlhYmNkZWYiLCJuYW1lIjoibXktc2VydmVyIiwiYWRkcmVzc2VzIjpbIm15LXNlcnZlcjozODg4OCJdLCJzZWNyZXQiOiIuLi4ifQ
```

A key is `hpk1_` followed by base64url (no padding) of a small JSON object:

```json
{
  "id": "0123456789abcdef",
  "name": "my-server",
  "addresses": ["my-server.example.com:38888", "192.0.2.10:38888"],
  "secret": "<32 bytes, base64url>"
}
```

| Field | Meaning |
|---|---|
| `id` | The server's public id (hex). Projects and windows refer to a server by it. It stays the same when the key is replaced. |
| `name` | What clients call the server (its host name by default). |
| `addresses` | `host:port` pairs, best first. Clients try the first. |
| `secret` | 256 random bits: the Noise pre-shared key. |

Keys printed before the rename (`xhk2_…`) are read the same way. Decoding errors: "That isn't a server key: keys start with hpk1_.", "This key is damaged: copy it again.".

A server on your own machine keeps its key in its data folder, where `hyperpane` finds it without being told. `hyperpane new-key` replaces the secret, cutting every client off.

## Transport

1. Open a WebSocket to `ws://<address>/`, where `<address>` is the key's first address. The server listens on port `38888` unless configured otherwise. (TLS, where there is any, is only for browsers: whatever terminates it sees only the encrypted channel below.)
2. Run the Noise handshake.
3. Exchange messages, each WebSocket message carrying one Noise message.

All WebSocket messages are binary.

### The Noise channel

| | |
|---|---|
| Pattern | `Noise_NNpsk0_25519_ChaChaPoly_BLAKE2s` |
| Pre-shared key | The key's `secret` (slot 0) |
| Prologue | `xharness/2` (the name from before the rename, kept on purpose so that old and new peers fail with a version message, not a key error) |
| Initiator | The client |

1. The client sends the first handshake message (no payload) as one WebSocket message.
2. The server answers with the second. A server with a different secret can't produce an answer the client accepts: the client reports "The server didn't accept the key." In practice, the real server sends nothing back.
3. Both sides switch to transport mode. Each connection has fresh keys, so recorded traffic can't be decrypted later.

### Framing

Inside the channel, each protocol message is length-prefixed:

```text
u32 BE   length of the message (at most 64 MiB)
bytes    the message (postcard)
```

Several length-prefixed messages may be concatenated and encrypted together; a long run is split into chunks of at most 65,519 bytes of plaintext (65,535 minus the 16-byte tag), each sealed as one Noise message and sent as one WebSocket message. The reader decrypts each WebSocket message, appends the plaintext to a buffer, and takes out every complete message.

- A WebSocket message over 65,535 bytes, a Noise message that fails to decrypt, or a length over 64 MiB breaks the connection.
- The server sends what's waiting in one WebSocket message where it can, up to 256 KiB.

## Messages

Messages are Rust enums encoded with [postcard](https://postcard.jamesmunns.com/): a variant is its index as a varint, followed by its fields in order. New variants are only ever added at the end, so what an older client sends keeps its meaning.

```rust
enum ClientMsg {
    Hello(ClientHello),          // 0
    Call { id: u64, call: Call },// 1
    Cancel { id: u64 },          // 2: ends a subscription
}

enum ServerMsg {
    Hello(ServerHello),                                  // 0
    Reply { id: u64, reply: Result<Reply, String> },     // 1
    Event { id: u64, event: Event },                     // 2
    Ended { id: u64, reason: Option<String> },           // 3: the server ended a subscription
}
```

### The hello

As soon as the channel opens, the client sends its hello, then any calls it queued. The server answers with its own hello.

```rust
struct ClientHello {
    protocol: u32,   // 3
    client: String,  // what the client is, for the server's log: "hyperpane-cli 0.2.6"
}

struct ServerHello {
    protocol: u32,
    info: ServerInfo,
    plugins: Vec<PluginInfo>,   // { id, version } of each plugin server part installed
}

struct ServerInfo {
    id: String,          // the public id, as in the key
    name: String,
    version: String,
    os: String,          // "macos", "linux", "windows"
    arch: String,
    target: String,      // the Rust target triple: "aarch64-apple-darwin"
    hostname: String,
    home: String,        // the server user's home folder
    uptime_secs: u64,
}
```

The client checks `protocol`: if it differs from its own, it stops with "This server is older than the app. Restart it if it's been updated, or update it." or "This server is newer than the app: update the app.".

The `client` string also carries capabilities an app can't express elsewhere: an app (`hyperpane-app <version>`) that reads binary bodies adds the word `+bytes`. Clients that aren't the app always receive bodies as they are.

### Calls, replies and subscriptions

- The client numbers its calls, counting up from 1 per connection. Many calls run at once on one connection.
- **Every call gets exactly one `Reply`** with its id: `Ok(reply)` or `Err(message)`.
- A call that is a **subscription** replies `Ok(Reply::Subscribed)`, then sends any number of `Event`s with the same id, until the server ends it with `Ended` (with a `reason` if it wasn't expected) or the client sends `Cancel { id }`.
- `Err` strings are sentences meant for the user, shown as they are.

### `Call`

| # | Call | Reply | Description |
|---|---|---|---|
| 0 | `Info` | `Info(ServerInfo)` | The server's details. |
| 1 | `Projects` | subscription of `Event::Projects` | The server's projects, now and on every change. |
| 2 | `AddProject { folder: String, name: Option<String> }` | `Project(ProjectInfo)` | Adds a folder on the server as a project, creating `.hyperpane/` there if needed. |
| 3 | `RemoveProject { project: String }` | `Done` | Takes a project off the list. Its folder is left as it is. |
| 4 | `OpenProject { project: String }` | subscription of `Event::Doc`, `Flow`, `Notice` | The project's document, now and on every change; values travelling along links; plugins' notices. |
| 5 | `Edit { project: String, op: DocOp }` | `Done`, `Window(id)` or `Link(id)` | Changes a project's document. |
| 6 | `CheckFolder { folder: String }` | `Folder(String)` | Whether a folder exists on the server; replies with its full path. |
| 7 | `Shutdown` | `Done` | Stops the server and everything running in it. |
| 8 | `Plugin { plugin: String, payload: Vec<u8> }` | `Plugin(Vec<u8>)`, or a subscription of `Event::Plugin` | A call to a plugin's server part (or a [reserved id](#reserved-plugin-ids)). Only the plugin reads `payload`. |
| 9 | `RenameProject { project: String, name: String }` | `Project(ProjectInfo)` | Renames a project in the server's list and its `project.json`. |
| 10 | `Emit { project: String, from: End, value: Vec<u8> }` | `Done` | A value from a window's out-port. The server keeps it as the port's latest and sends it along the port's links (`Event::Flow`). |
| 11 | `ServerConfig` | `Config(ConfigView)` | The server's settings and details. |
| 12 | `SetServerConfig { config: ServerConfig }` | `Config(ConfigView)` | Saves all the server's settings (one left out goes back to its default) and applies those that can be at once. Fails, saving nothing, if any is wrong. |
| 13 | `Restart` | `Done` | Restarts the server with the same arguments and data folder. Clients reconnect by themselves. |
| 14 | `RotateKey` | `Key(String)` | Replaces the key's secret and replies with the new `hpk1_…` key; then every client is cut off. |

### `Reply`

| # | Reply | For |
|---|---|---|
| 0 | `Done` | Calls with nothing to return |
| 1 | `Subscribed` | Subscriptions |
| 2 | `Info(ServerInfo)` | `Info` |
| 3 | `Project(ProjectInfo)` | `AddProject`, `RenameProject` |
| 4 | `Window(u64)` | `Edit` with `DocOp::AddWindow`: the new window's id |
| 5 | `Folder(String)` | `CheckFolder` |
| 6 | `Plugin(Vec<u8>)` | `Plugin`: the plugin's reply body |
| 7 | `Link(u64)` | `Edit` with `DocOp::Connect`: the link's id |
| 8 | `Config(Box<ConfigView>)` | `ServerConfig`, `SetServerConfig` |
| 9 | `Key(String)` | `RotateKey` |

### `Event`

| # | Event | On |
|---|---|---|
| 0 | `Projects(Vec<ProjectInfo>)` | `Projects` |
| 1 | `Doc(ProjectDoc)` | `OpenProject`: the whole document, after every change |
| 2 | `Plugin(Vec<u8>)` | `Plugin` subscriptions: one event body |
| 3 | `Flow(Flow)` | `OpenProject`: `{ from: End, links: Vec<u64>, value: Vec<u8> }`, a value on its way along these links (all of the port's, or a new one, which gets the port's latest value) |
| 4 | `Notice(Notice)` | `OpenProject`: `{ plugin, title, description: Option<String>, error: bool }`, a plugin's `notify`, shown as a toast |

## Project documents

A project's **document** is its windows, their layout, and the links between them. The server is its only writer: clients send operations, the server applies them, saves, and sends the new document to every subscriber. Conflicts resolve per property, last writer wins.

```rust
struct ProjectInfo { id: String, name: String, folder: String }

struct ProjectDoc {
    id: String,
    name: String,
    folder: String,
    windows: Vec<Window>,
    links: Vec<Link>,
    viewport: Option<Viewport>,   // where the canvas was left
    plugins: Vec<String>,         // plugins enabled in the project, sorted, unique
}

struct Window {
    id: u64,
    plugin: String,                    // "terminal", "editor", …
    kind: String,                      // the plugin's node type; empty: its main one
    title: String,
    frame: Frame,
    data: BTreeMap<String, String>,    // shared: saved in project.json
    state: BTreeMap<String, String>,   // this machine's: saved in state.json
}

struct Frame { x: f32, y: f32, width: f32, height: f32, z: u32 }   // canvas units; higher z is in front
struct Viewport { x: f32, y: f32, zoom: f32 }                      // screen = canvas × zoom + (x, y)
struct End { window: u64, port: String }
struct Link { id: u64, from: End, to: End }
```

- A project's `id` is stable and the same on every server: it's in the project's `project.json`.
- Well-known `state` keys: `server` (the public id of the server the window runs on; absent means the project's home) and `folder` (the folder the window works in).
- A project file without `plugins` (from before 0.1.5) loads with `editor`, `explorer`, `files` and `terminal` enabled; a new project starts with the same four.

### `DocOp`

| # | Operation | Effect |
|---|---|---|
| 0 | `AddWindow { plugin, kind, title, frame, data, state }` | Adds a window in front of the others. Replies `Window(id)`. |
| 1 | `SetFrame { window, frame }` | Moves or resizes a window. |
| 2 | `Raise { window }` | Brings a window to the front. |
| 3 | `SetTitle { window, title }` | |
| 4 | `SetState { window, key, value: Option<String> }` | `None` removes the key. |
| 5 | `SetData { window, key, value: Option<String> }` | Changes the shared data. `None` removes the key. |
| 6 | `RemoveWindow { window }` | Closes a window and removes its links. Its plugin stops what the window was running. |
| 7 | `SetViewport(Viewport)` | |
| 8 | `Connect { from: End, to: End }` | Links an out-port to an in-port of another window. Replies `Link(id)`; the same link again replies with the existing id. |
| 9 | `Disconnect { link }` | |
| 10 | `SetPlugin { plugin, on: bool }` | Turns a plugin on or off in the project; idempotent, last writer wins. It does the same as the store's `enable`/`disable`, including assigning or unassigning the plugin's server part. |

Operations on a window that no longer exists do nothing: another client closed it first.

## Server settings

`ServerConfig` is the server's `config.json`. Every field is optional; a missing one takes its default.

| Setting | Meaning | Default | Applies |
|---|---|---|---|
| `name` | What clients call the server (at most 64 characters) | The machine's name | At once |
| `address` | The IP address it listens on: `0.0.0.0` for all, `127.0.0.1` for this machine only | `0.0.0.0` (a local server always uses `127.0.0.1`) | After a restart |
| `port` | 1 to 65535 | `38888` (a local server reuses its last port) | After a restart |
| `host` | The name or address clients reach this machine by, put in the key | The machine's host name (`127.0.0.1` for a local server) | At once |
| `idle_exit_secs` | Exit after this many seconds with nothing running and no client attached; `0` never (at most 2,592,000) | Never (60 for a local server) | At once |
| `plugin_idle_secs` | Stop an idle plugin server part after this many seconds: 10 to 604,800, or `0` never | `300` | After a restart |
| `node` | The full path of the Node that runs plugins' server parts | `$HYPERPANE_NODE`, the bundled runtime, or `node` on `PATH` | After a restart |

`ConfigView`, the reply to `ServerConfig`, holds `saved` (what's in the file), `running` (what the server runs with), `defaults`, `restart_needed` (settings that wait for a restart), `overridden` (settings a command-line flag beats), `next_listen`, and `details`: the server's id, name, version, OS, architecture, target, host name, user, home, data folder, pid, uptime, whether it's local, where it listens, its addresses, command line, memory, process count, connected clients, projects, plugin parts, Node runtime, and recent log lines.

The server rereads `config.json` when you edit it by hand and applies what it can.

## Bodies: JSON and binary

A plugin call's payload, its reply, and a subscription's events are bodies the protocol doesn't look at. hyperpane's plugins use JSON text, or a **binary body** when the value contains bytes:

```text
4 bytes   00 48 50 42        "\0HPB" (JSON text never starts with a 0 byte)
u32 BE    J
J bytes   UTF-8 JSON: {"value": V, "bytes": [{"at": P, "length": N}, …]}
...       the byte arrays, one after another, in the order of "bytes"
```

- `V` is the value with `null` where each byte array was. `P` is that array's path from the top: object keys as strings, array indexes as numbers, `[]` when the value itself is a byte array.
- Each path must lead to a `null` in `V`, and the lengths must add up to the rest of the body; otherwise it's refused ("A binary body that can't be read: …").
- A body is at most 64 MiB, bytes included. Anything larger goes as a [stream](#streams).

For example, `{op: 'put', name: 'a.png', data: Uint8Array.of(1, 2, 3)}` is:

```text
00 48 50 42
00 00 00 56
{"value":{"op":"put","name":"a.png","data":null},"bytes":[{"at":["data"],"length":3}]}
01 02 03
```

The server passes binary bodies along unchanged. It never gives one to an app whose hello lacks `+bytes`: that call fails with "The git plugin answered with bytes, which this app is too old to read. Update the app." (and a subscription ends with it). The bus and ports carry JSON only.

In Rust, `hyperpane_protocol::body::Body` reads and writes binary bodies.

## Reserved plugin ids

Some `Call::Plugin` ids aren't plugins. They let clients (including the app's page, which can only make plugin calls) reach the server's own services with JSON requests, without changing the wire protocol.

| Id | What |
|---|---|
| `hyperpane` | The plugin store: install, enable, list, log, settings, the event bus, scheduled jobs |
| `hyperpane.server` | The server itself: settings, restart, new key |
| `hyperpane.stream` | Streams for clients |

Plugins can't call any of them ("Plugins can't call the store.").

### The store: `hyperpane`

Requests are JSON objects with an `op` field; replies are JSON.

```sh
hyperpane call hyperpane '{"op":"list"}'
```

| op | Request | Reply |
|---|---|---|
| `info` | — | `{protocol: 3, server, os, arch, target, runtime: {name: "node", version} \| null, limits: {archive, unpacked, files, chunk}, streams: {supported, window, maxWindow, maxChunk, perConnection, perProcess}}` |
| `list` | — | `{parts: Part[], schedules?, dev?}` |
| `watch` | — | Subscription: `{parts, schedules?, dev?}` now, on every change, and every 5 s (memory) |
| `install_begin` | `{plugin, version, sha256, size, force?}` | `{upload: "u-…"}`, or `{installed: Part}` when that id, version and sha256 are already installed (without `force`) |
| `install_chunk` | `{upload, offset, data}` (`data` base64, at most 1 MiB raw) | `{received}` |
| `install_commit` | `{upload, project?, dev?}` | `{installed: Part}`. Assigns `project` if given. `dev` marks a dev install. |
| `install_abort` | `{upload}` | `{}` |
| `enable` / `disable` | `{project, plugin}` | `{plugins: [...]}`: the project's enabled plugins |
| `assign` / `unassign` | `{project, plugin}` | `{}` |
| `uninstall` | `{plugin, force?, purge?}` | `{}` |
| `restart` | `{plugin}` | `{}` |
| `log` | `{plugin, lines?}` (default 200, at most 2000) | `{lines: string[]}` |
| `log_watch` | `{plugin, lines?}` | Subscription: `{lines, first: true}` with the last lines, then `{lines: [line]}` per new line |
| `log_write` | `{plugin, message, level?}` (`error`, `warn`, `info`) | `{}`: adds lines to a dev install's log as `[frame error] …`; refused otherwise |
| `settings_get` | `{plugin, project?}` | `{values}`: what was set (server-wide, or that project's own), without defaults |
| `settings_set` | `{plugin, project?, values}` | `{}`: replaces them; a running part gets `settings` |
| `bus_publish` | `{topic, data?, project?, scope?, from: BusFrom}` | `{id, delivered, dropped, woke}` |
| `bus_subscribe` | `{pattern, project?, from: BusFrom}` | Subscription: each bus event |
| `bus_request` | `{topic, data?, project?, scope?, timeout?, from: BusFrom}` | The first answer |
| `bus_reply` | `{request, data? \| error? \| none?, endpoint}` | `{}`: a frame's answer to a request |
| `bus_stats` | — | `{subscriptions: [{plugin, part, window, pattern, project, delivered, dropped}], published, delivered, dropped, requests}` |
| `schedule_pause` | `{plugin, schedule, paused}` | `{}`: pauses or resumes a scheduled job |
| `schedule_run` | `{plugin, schedule}` | `{}` once the run has started |

```jsonc
// Part
{"id":"git","version":"0.1.5","sha256":"…","builtin":false,"projects":["9f…"],
 "status":"idle|starting|running|stopping|failed","pid":4242,"memory":51200000,
 "since":1793700000000,"error":null,"calls":2}

// Schedule (in list/watch's "schedules": {<plugin id>: Schedule[]})
{"id":"fetch","cron":"*/15 * * * *","description":"Fetches every remote","paused":false,
 "next":1793700900000,"running":null,
 "last":{"at":1793700000000,"started":1793700000210,"finished":1793700003400,"result":"ok|error|skipped","error":"…","manual":true}}
```

- `memory` is resident memory in bytes, `since` when the process started (ms since 1970), `error` the last start failure or crash, `calls` its open calls. `pid`, `memory` and `since` are `null` when it isn't running. Terminal is always listed as built in.
- `dev` lists the ids of dev installs (see [`hyperpane plugin dev`](/docs/reference/cli#plugin-dev)).
- **Installing.** `install_begin` is refused when `size` exceeds `limits.archive` (64 MiB), the id is malformed or reserved, the version isn't `x.y.z[-pre]`, or a newer version is installed ("A newer Git (0.1.6) is on this server; 3 projects use it."), unless `force`. Send `install_chunk`s in order; `offset` must equal the bytes received so far. An upload idle for 10 minutes is dropped. `install_commit` checks [the archive](#the-archive) and, if anything is wrong, replies with why and leaves nothing behind.
- **Enabling.** `enable`/`disable` work only on the project's home server ("This server isn't the project's home: use assign."). They change the document (`DocOp::SetPlugin`) and assign or unassign the part if installed. A part with no projects left is stopped once its open calls end and is removed; its data stays. `assign` needs the part installed ("Git's server part isn't on this server.").
- **Uninstalling** is refused while projects are assigned, unless `force`. Terminal can't be uninstalled. `purge` also deletes the plugin's data folder, secrets and settings.
- `restart` clears `failed`, stops the process if running, and starts it.
- **`BusFrom`** is `{plugin, window?, endpoint}`: the frame's plugin (`hyperpane` for the app itself), its window, and an `endpoint` unique per app and frame. The server trusts what the app says; the app checks each frame's `events`.

### The server: `hyperpane.server`

The same operations as the `ServerConfig`, `SetServerConfig`, `Restart` and `RotateKey` calls, as JSON:

| op | Request | Reply |
|---|---|---|
| `get` | `{log?}` (lines of the log, default 200, at most 2000) | `ConfigView` |
| `check` | `{config}` | `{problems: [{setting, message}]}`, without saving |
| `set` | `{config}` | `ConfigView` |
| `restart` | — | `null`, then the server restarts |
| `rotate_key` | — | `{key: "hpk1_…"}`, then every client is cut off |
| `watch` | — | Subscription: a `ConfigView` (without the log) now and on every change |

### Streams: `hyperpane.stream`

A plugin call's payload or reply can carry one **stream** of bytes of any size. Clients open stream calls through `hyperpane.stream`; its requests and events are [binary bodies](#bodies-json-and-binary). `stream` is the client's own id for the call's streams, unique on its connection.

| op | Request | Reply |
|---|---|---|
| `call` | `{op, stream, plugin, upload?: {at}, payload: <bytes>}` | A subscription of the events below, ended when the call is over (`reason` if it failed) |
| `write` | `{op, stream, data: <bytes>}`, `{op, stream, end: true}` or `{op, stream, error}` | `{}`: a chunk of the upload (within its credit), its end, or the writer giving up |
| `credit` | `{op, stream, bytes}` | `{}`: the download's reader takes this much more |

```jsonc
// Events of a `call`
{"t":"reply","payload":"<bytes>"}                            // the plugin's reply; the call is over
{"t":"reply","payload":"<bytes>","stream":{"at":["data"]}}   // …carrying a download
{"t":"chunk","data":"<bytes>"}                               // the download's bytes
{"t":"credit","bytes":262144}                                // the upload may send this much more
{"t":"streamCancel","reason":"…"}                            // the upload is no longer read
```

- The subscription's `Ended` after a download's chunks is its end: `reason` is `None` when it all arrived. Before any `reply`, it means the call failed. `Cancel` cancels both streams; a client that goes away fails them ("The client went away.").
- At most 16 streams per connection ("16 streams are open on this connection, the most there may be: wait for one to end.").
- A plain `Call::Plugin` answered with a stream fails: "The files plugin answered with a stream, which a plain call can't read: open it with host.stream (an app from before streams can't: update it).".
- Older servers answer "The hyperpane.stream plugin isn't installed on this server.".

Flow control works as in the [plugin protocol's streams](#streams): the reader grants a window, then each chunk's size as it reads; a writer holds at most 8 MiB of credit; chunks are at most 1 MiB.

## The terminal protocol

Terminal's client and server parts talk through `Call::Plugin { plugin: "terminal", payload }` with **postcard**-encoded messages (not JSON), defined in `hyperpane-terminal-protocol`. The server runs the terminal emulator, so a client that opens a terminal gets the whole screen, then only the lines that change. Colors and attributes arrive resolved (inverse already swapped).

```rust
struct Target { project: String, window: u64 }   // a terminal is a project's window

enum Call {
    Open { target: Target, folder: Option<String>, size: Size, shell: Option<ShellChoice> }, // 0: subscription
    Input { target: Target, data: Vec<u8> },                  // 1
    Resize { target: Target, size: Size },                    // 2
    History { target: Target, start: u32, count: u32 },       // 3: replies History
    Kill { target: Target },                                  // 4
    List,                                                     // 5: replies List
    Read { target: Target },                                  // 6: replies Text
    Text { target: Target },                                  // 7: replies Text
    ClearScrollback { target: Target },                       // 8
    Shells,                                                   // 9: replies Shells
}

enum ShellChoice { Known(String), Command(String) }
struct Size { cols: u16, rows: u16, cell_width: u16, cell_height: u16 }

enum Reply {
    Done,                                          // 0
    History { lines: Vec<Line>, total: u32 },      // 1
    List(Vec<SessionInfo>),                        // 2
    Text(String),                                  // 3
    Shells(Vec<ShellInfo>),                        // 4
}

enum Event {
    Screen(Screen),                                                // 0: the whole screen
    Lines { lines: Vec<(u16, Line)>, cursor: Cursor, history: u32 }, // 1: changed rows
    Modes(u32),                                                    // 2
    Title(String),                                                 // 3
    Bell,                                                          // 4
    Exited,                                                        // 5: the subscription ends after this
    Clipboard(String),                                             // 6: OSC 52
}
```

| Call | Description |
|---|---|
| `Open` | A subscription to a window's terminal. Starts the shell if it isn't running: in `folder`, else the project's folder, else home; with `shell`, else the server's default. Sends `Screen` first, then changes. |
| `Input` | Bytes for the shell, as typed. The client encodes keys. |
| `Resize` | Changes the terminal's size. |
| `History` | Lines above the screen; `start: 0` is the line just above it. |
| `Kill` | Ends the shell and what it started. |
| `List` | Every terminal running on the server. |
| `Read` | The screen as text. |
| `Text` | The scrollback and the screen as text, with wrapped lines joined. |
| `ClearScrollback` | Clears the scrollback; the screen redraws. |
| `Shells` | The shells the server can start. |

```rust
struct Screen { cols: u16, rows: u16, lines: Vec<Line>, cursor: Cursor, modes: u32, title: String, history: u32 }
struct Line { runs: Vec<Run>, wrapped: bool }       // wrapped: continues in the next line
struct Run { col: u16, text: String, fg: Color, bg: Color, flags: u16 }
enum Color { Default, Index(u16), Rgb(u8, u8, u8) }
struct Cursor { col: u16, row: u16, shape: CursorShape }
enum CursorShape { Block, Underline, Beam, Hidden }
struct SessionInfo { target: Target, title: String, pid: u32, cols: u16, rows: u16, viewers: u32 }
struct ShellInfo { id: String, name: String, path: String, default: bool }
```

- A **line** is runs of cells that look the same, from column `col`. Blank cells with the default background aren't sent. Each character takes one column, or two in a run with the `WIDE` flag; zero-width characters (joiners, combining marks) share the previous character's column.
- **Colors:** `Index` 0–255 is xterm's palette; then 256 foreground, 257 background, 258 cursor, 259–266 dim black…white, 267 bright foreground, 268 dim foreground.
- **`ShellInfo.id`:** `pwsh`, `powershell`, `cmd`, `git-bash`, `wsl`; `login`, `zsh`, `bash`, `fish`. A `Known` id the server doesn't have starts its default.

| Run flag | Bit | | Mode | Bit |
|---|---|---|---|---|
| `BOLD` | 0 | | `APP_CURSOR` | 0 |
| `ITALIC` | 1 | | `APP_KEYPAD` | 1 |
| `UNDERLINE` | 2 | | `BRACKETED_PASTE` | 2 |
| `DIM` | 3 | | `MOUSE_CLICK` | 3 |
| `STRIKE` | 4 | | `MOUSE_DRAG` | 4 |
| `HIDDEN` | 5 | | `MOUSE_MOTION` | 5 |
| `WIDE` | 6 | | `SGR_MOUSE` | 6 |
| `DOUBLE_UNDERLINE` | 7 | | `UTF8_MOUSE` | 7 |
| `UNDERCURL` | 8 | | `ALT_SCREEN` | 8 |
| | | | `FOCUS_EVENTS` | 9 |
| | | | `ALTERNATE_SCROLL` | 10 |

Terminal's server part also takes JSON requests from other plugins (see [Driving terminals](#driving-terminals)), and `{"op":"shells"}` from the app's settings.

## Connecting from Rust

`hyperpane-client` has no I/O of its own, so the same code runs natively and in WebAssembly:

```rust
use hyperpane_client::{Connection, Incoming};
use hyperpane_protocol::{ServerKey, wire::Call};

let key = ServerKey::decode(&key_text)?;
let mut connection = Connection::new(&key, "my-agent 0.1.0");
send(connection.outgoing());              // the handshake's first message
let id = connection.call(Call::Info);     // queued until the channel opens
for frame in websocket {
    for incoming in connection.receive(&frame)? {
        match incoming {
            Incoming::Ready(hello) => { /* the server said hello */ }
            Incoming::Message(message) => { /* Reply, Event or Ended */ }
        }
    }
    send(connection.outgoing());
}
```

`hyperpane_cli::Client` wraps it in a blocking native client over a plain WebSocket, with `call`, `send`, `reply`, `cancel`, `plugin` and `next`.

## The plugin protocol

How a server runs a plugin's server part and talks to it. It's language-neutral: anything that reads and writes these frames on stdin and stdout can be a server part. The server launches Node parts (`"runtime": "node"`); `@hyperpane/sdk/server` implements the plugin's side.

## Processes

- **One process per plugin per server.** It starts on the first call for its id (from a client or another plugin), a bus event that wakes it, or a scheduled job. It stops after 5 minutes with no open calls and `busy` false. No plugin process runs when the server starts.
- **Pipes:** stdin carries host-to-plugin frames, stdout plugin-to-host frames, stderr UTF-8 log lines. stdout is for frames only: send `console.*` and other output to stderr. EOF on stdin means the server is gone: exit.
- **Writes are batched:** the host writes every waiting frame in one write, and the SDK writes one event-loop turn's frames in one write. A reader may get several frames in one chunk.

### The command line

```sh
node --no-addons --disable-warning=ExperimentalWarning --max-old-space-size=<memory> \
     --import <file URL of <sdk>/register.mjs> <part dir>/src/server/<main>
```

- `<memory>` is `server.memory` from `plugin.json` (MiB, default 512, at most 4096).
- `<main>` is `server.main`, relative to `src/server/`. A value starting with `src/server/` is relative to the package.
- `register.mjs` maps `@hyperpane/sdk` and `@hyperpane/sdk/*` to the server's own SDK, so the protocol and the SDK always match. `--import` is left out when the server has no SDK folder; then `@hyperpane/sdk` doesn't resolve, which is fine for a part that speaks the protocol itself.
- **Node** is, in order: `hyperpane-server run --node PATH`; `$HYPERPANE_NODE`; `runtime/node` beside `hyperpane-server`; `node` on `PATH`. The server reports its version in the store's `info`, and doesn't enforce a minimum: plugins say what they need in `engines.node`, which clients check.
- **The SDK folder** is `$HYPERPANE_SDK_DIR`, else `sdk` beside Node.

### Environment

| | |
|---|---|
| Working directory | The part's install folder: `<data>/plugin-parts/<id>/<version>-<sha8>/` |
| Environment | The server's own, without `NODE_OPTIONS`, `NODE_PATH` and `NODE_ENV`, plus `HYPERPANE_PLUGIN_ID`, `HYPERPANE_PLUGIN_DATA` (its data folder), `HYPERPANE_SERVER_VERSION`, `UV_THREADPOOL_SIZE=8`, and `PATH` with `<dataDir>/bin` first |
| Unix | Its own process group. Stopping it ends the whole group and its descendants. |
| Windows | No console window, and its own job object, so it and everything it starts end with the server. |

### Logs

stderr lines go to `<data>/plugin-parts/<id>/log.txt`, each prefixed with the time, rotated at 1 MiB (to `log.old.txt`). The server adds its own lines (started, stopped, crashed). After a crash, the last 20 lines also go to `server.log`. Clients read the log with the store's `log` op, follow it with `log_watch`, or run `hyperpane plugins log <id>`.

## Frames

```text
u32 BE   total = 4 + H + B
u32 BE   H
H bytes  header: a UTF-8 JSON object with a string field "t"
B bytes  body: raw bytes (B is 0 when the message has none)
```

- The body carries what isn't the protocol's: a call's payload, a reply, an event, a value. It's never base64'd or nested in the JSON.
- `total` is at most 64 MiB.
- **A malformed frame is fatal:** `total` under 4 or over the limit, `H` over `total - 4`, a header that isn't a JSON object with a string `t`, or a known `t` whose fields have the wrong types. The host kills the process and logs why.
- Unknown `t` values are ignored after the handshake. Unknown fields are always ignored, so either side may add optional fields.
- Header field names are camelCase.

### Ids

Ids are integers below 2^53.

| Ids | Owner | Used by |
|---|---|---|
| Call ids | The host, per process | `call`, `cancel`, `reply`, `subscribed`, `event`, `end`, `schedule` |
| Request ids | The plugin | `req`, `res`, `subEvent`, `subEnd`, `unsubscribe` |
| Ping ids | The host | `ping`, `pong` |
| Stream ids | The stream's writer | `chunk` and `streamEnd` come from the writer; `credit` and `streamCancel` from the reader |

## Handshake

1. The host sends `hello`, and holds everything else until the plugin's `hello` arrives.
2. The plugin answers within 10 seconds with `protocol: 1` and `id` equal to its installed id. Its first frame must be its `hello`; any other frame first is fatal.
3. If it doesn't, the host sends `shutdown`, kills it, and the waiting calls fail with "Git's server part didn't start: …":
   - "it didn't start in 10 s";
   - "it was built for plugin protocol 2; this server speaks 1";
   - "it says it's `gti`, but it's installed as `git`";
   - "it exited (exit code 1): <its last log line>".

```jsonc
// host → plugin
{"t":"hello","protocol":1,"server":"0.2.6","target":"aarch64-apple-darwin",
 "plugin":"git","version":"0.1.5",
 "dataDir":"/home/you/.local/share/hyperpane-server/plugins/git",
 "projects":[{"id":"9f…","name":"app","folder":"/home/you/app"}],
 "info":{"os":"macos","arch":"aarch64","target":"aarch64-apple-darwin","serverVersion":"0.2.6",
         "hostname":"my-server","home":"/home/you","user":"you"},
 "settings":{"maxResults":2000},
 "streams":{"supported":true,"window":2097152,"maxWindow":8388608,"maxChunk":1048576,"perConnection":16,"perProcess":64}}

// plugin → host
{"t":"hello","protocol":1,"id":"git","version":"0.1.5","sdk":"@hyperpane/sdk 0.2.6","streams":true}
```

| Field | Meaning |
|---|---|
| `server`, `info.serverVersion` | The server's version |
| `target` | The Rust target triple the server was built for |
| `dataDir` | `<data>/plugins/<id>/`, the plugin's own folder, created before the process starts |
| `projects` | Every project this server is home to. `projects` messages update it. Windows paths use forward slashes (`C:/Users/you/app`). |
| `info` | `os` is `macos`, `linux` or `windows`; `user` is the server's user name |
| `settings` | The plugin's server-wide settings, defaults filled in |
| `streams` | The stream limits (see [Streams](#streams)) |
| plugin's `sdk` | Free text for the log |
| plugin's `streams` | `true` when the part accepts calls carrying streams |

## Host → plugin

```jsonc
{"t":"call","id":7}                                   // body: the payload
{"t":"call","id":8,"from":"git","project":"9f…"}      // from another plugin; both optional
{"t":"call","id":9,"stream":{"id":4,"at":["data"]}}   // its payload carries the host's stream 4
{"t":"cancel","id":7}                                 // the caller cancelled or went away
{"t":"schedule","id":10,"schedule":"sync","at":1793700000000}   // a scheduled job is due: answer as a call
{"t":"windowClosed","project":"9f…","window":12}
{"t":"projectOff","project":"9f…"}                    // turned off or unassigned there: end its work
{"t":"connected","project":"9f…","link":{"id":1,"from":{"window":3,"port":"out"},"to":{"window":5,"port":"in"}},"window":3}
{"t":"disconnected","project":"9f…","link":{…},"window":3}
{"t":"input","project":"9f…","link":{…}}              // body: the value that arrived at link.to
{"t":"projects","projects":[{"id":"9f…","name":"app","folder":"/home/you/app"}]}
{"t":"settings","project":null,"values":{…}}
{"t":"res","id":1,"result":…}                         // answers request 1
{"t":"subEvent","id":2}                               // body: an event of subscription 2
{"t":"subEnd","id":2,"reason":null}
{"t":"chunk","stream":4}                              // body: bytes of the host's stream 4
{"t":"streamEnd","stream":4,"error":null}
{"t":"credit","stream":1,"bytes":262144}              // the plugin's stream 1 may send this much more
{"t":"streamCancel","stream":1}                       // the plugin's stream 1 is no longer read
{"t":"ping","id":3}
{"t":"shutdown"}
```

- `windowClosed`, `projectOff`, `connected`, `disconnected` and `input` go only to a running process, and are about the plugin's own windows.
- `connected` and `disconnected` come once for each end of the link that's one of the plugin's windows; `window` says which.
- `projects` is sent whenever the server's projects change.
- `shutdown`: end everything and exit. The host closes stdin right after, waits up to 3 seconds, then ends the process group (Unix: SIGTERM, then SIGKILL a second later; Windows: the job).

## Plugin → host

```jsonc
{"t":"reply","id":7}                                  // body: the reply
{"t":"reply","id":7,"error":"Couldn't run git: not found."}
{"t":"reply","id":9,"stream":{"id":1,"at":["data"]}}  // body: the reply, carrying its stream 1
{"t":"subscribed","id":7}
{"t":"event","id":7}                                  // body: the event
{"t":"end","id":7,"reason":null}
{"t":"updateWindow","project":"9f…","window":12,"change":{"title":"main"}}
{"t":"updateWindow","project":"9f…","window":12,"change":{"state":{"key":"k","value":null}}}
{"t":"updateWindow","project":"9f…","window":12,"change":{"data":{"key":"k","value":"v"}}}
{"t":"updateWindow","project":"9f…","window":12,"change":"close"}
{"t":"track","project":null,"pid":4321}
{"t":"untrack","pid":4321}
{"t":"emit","project":"9f…","window":12,"port":"out"} // body: the value
{"t":"busy","busy":true}
{"t":"pong","id":3}
{"t":"req","id":1,"op":"projects"}
{"t":"unsubscribe","id":2}
{"t":"publish","topic":"file.upload","project":"9f…"} // body: the event's data
{"t":"busReply","request":42}                         // body: the answer to a bus request
{"t":"chunk","stream":1}                              // body: bytes of its stream 1
{"t":"streamEnd","stream":1,"error":null}
{"t":"credit","stream":4,"bytes":262144}
{"t":"streamCancel","stream":4}
```

| Message | Meaning |
|---|---|
| `updateWindow` | Changes one of the plugin's own windows in a project this server is home to. `state` is this machine's part (`state.json`); `data` is the shared part (`project.json`). A `null` value removes the key; `"close"` closes the window. Both go through the project's document, so every client sees the change. |
| `emit` | Sends a value from one of its windows' out-ports along its links. |
| `track` / `untrack` | Puts a process the plugin started under the server's supervision, in a project's environment or the plugin's own (`null`). Stopping the server ends it. `untrack` when it has exited. |
| `busy` | Whether the plugin has work running (a transfer) that should keep it, and a server the app started, from stopping when idle. |
| `pong` | The host pings every 30 seconds. No `pong` within 10 seconds and the process is killed, as if it had crashed. Don't block the event loop for 10 seconds; move heavy work to worker threads. |

## Calls

A call is a client's (or another plugin's) message to the plugin. The host assigns the id and sends `call` with the payload as its body. The plugin answers **exactly once**, either:

- with `reply` (a body, or `error`: a message shown to the user as it is), which ends the call; or
- with `subscribed`, then any number of `event`s, then `end` (`reason` null when it ended as expected, otherwise a message).

After `cancel`, the host drops frames for that id; the SDK makes `event()` return false and aborts the call's `AbortSignal`. An `end` after a `cancel` is fine. An `end` before `subscribed` counts as a failed call ("Git's server part ended the call without answering.").

## Requests: the plugin asks the host

```jsonc
{"t":"req","id":1,"op":"settings","project":"9f…"}   // the op's fields beside "op"; a body if it takes one
{"t":"res","id":1,"result":{"maxResults":2000}}       // a JSON result (null when there's nothing to say)
{"t":"res","id":1,"error":"No such project on this server."}
```

- Every `req` gets one `res`; subscriptions may get more frames after it. Requests run concurrently, so `res` frames can arrive in any order.
- `error` is a message for the user. Results of `call` and `subscribe` come in the body instead.
- An unknown `op` gets "This server doesn't know the request "foo".", so a plugin can feature-test.

| op | Fields | Result |
|---|---|---|
| `projects` | — | `[{id, name, folder}]`: every project this server is home to |
| `windows` | `project` | `[{id, kind, title, data, state}]`: the plugin's own windows in that project |
| `canvas.windows` | `project` | `CanvasWindow[]` (the `canvas` permission) |
| `canvas.drawings` | `project` | `CanvasDrawing[]` (the `canvas` permission) |
| `canvas.moveWindows` | `project`, `windows: [{id, x?, y?, width?, height?}]` | `null` (the `canvas-edit` permission) |
| `canvas.raise` | `project`, `window` | `null` (`canvas-edit`) |
| `canvas.draw` | `project`, `drawings: NewDrawing[]` | The new drawings' ids, in order (`canvas-edit`) |
| `canvas.updateDrawings` | `project`, `drawings: DrawingChange[]` | `null` (`canvas-edit`) |
| `canvas.eraseDrawings` | `project`, `drawings: [id]` | `null` (`canvas-edit`) |
| `projectStorage` | `project` | The plugin's folder in the project, `<project>/.hyperpane/<id>/`, created if missing |
| `settings` | `project?` | The plugin's settings, defaults filled in |
| `secrets.get` | `name` | The value (a string), or `null` |
| `secrets.set` | `name`, `value` | `null` |
| `secrets.delete` | `name` | `null` |
| `notify` | `project`, `title`, `description?`, `error?`, `native?` | `null`; with `native`, `{id, native: true}` when apps showed it as a system notification |
| `authorize` | `project`, `authorizeUrl`, `clientId`, `scopes?`, `redirect?`, `pkce?`, `extraParams?` | Body: `{code, state, redirectUri, codeVerifier}` (the `oauth` permission) |
| `call` | `plugin`, `project?`, `streams?`, `stream?`; body: the payload | Body: the reply |
| `subscribe` | `plugin`, `project?`; body: the payload | `{"subscribed": true}`, then `subEvent`s and a `subEnd` |
| `bus.subscribe` | `pattern`, `project?` | `{"subscribed": true}`, then a `subEvent` per event |
| `bus.request` | `topic`, `project?`, `scope?`, `timeout?`; body: the data | Body: the first answer |

Requests are handled on a few threads shared by all parts (bus requests as they arrive, in order).

### Projects and windows

`projects` is the same list as `hello.projects`. `windows` needs a project this server is home to ("No such project on this server.") and returns only the caller's own windows; `data` and `state` are string maps. After an `updateWindow`, `windows` reflects the change.

### The canvas

With the `canvas` permission, a part reads every window and drawing of a project this server is home to and the plugin is on in; with `canvas-edit`, it changes them, so layout tools and diagram generators work with no app open. The shapes and rules are the same as the frames' (see [the RPC's canvas methods](/docs/reference/rpc#canvas-and-overlay-the-canvas)).

```jsonc
{"t":"req","id":7,"op":"canvas.windows","project":"9f…"}
{"t":"res","id":7,"result":[{"id":3,"plugin":"editor","kind":"","title":"main.rs","frame":{"x":0,"y":0,"width":800,"height":600},"z":4,"server":null,"focused":false,"selected":false}]}
{"t":"req","id":8,"op":"canvas.draw","project":"9f…","drawings":[
  {"kind":"shape","x":900,"y":0,"text":"Postgres","shape":"ellipse"},
  {"kind":"arrow","from":{"window":3,"side":"right"},"to":{"item":0}}]}
{"t":"res","id":8,"result":[12,13]}
```

- **All or none:** a request is checked whole first (at most 1000 items), then applied to the document at once, saved once, and sent once to every client.
- `focused` and `selected` are always `false` here (they're an app's).
- A note or text box without a size gets one estimated from its text, and a part's changes aren't in anyone's Undo.
- Refused without the permission ("Layout didn't ask to change the canvas (the canvas-edit permission in its plugin.json)."), for a project this server isn't home to, and for one the plugin is off in.

### Project storage

`projectStorage` returns `<project folder>/.hyperpane/<id>/`, created the first time it's asked for. It's part of the project, not ignored by `.hyperpane/.gitignore` (which ignores only `state.json`), so teammates who commit the project get it too. Keep this machine's own things in `dataDir` instead.

### Calling another plugin

A plugin may call the server parts of the ids in its `plugin.json` `dependencies` and `uses`, and no others. The call is routed like a client's (starting the other part if needed), and the callee's `call` frame carries `from` (the caller's id) and the `project` the caller named.

```jsonc
{"t":"req","id":4,"op":"call","plugin":"files","project":"9f…"}   // body: the payload
{"t":"res","id":4}                                                 // body: the reply
{"t":"res","id":4,"error":"…"}                                     // the callee's error, or the host's

{"t":"req","id":5,"op":"subscribe","plugin":"files"}               // body: the payload
{"t":"res","id":5,"subscribed":true}
{"t":"subEvent","id":5}                                            // body: an event
{"t":"subEnd","id":5,"reason":null}
{"t":"unsubscribe","id":5}                                         // plugin → host: stop it
```

Refused at once:

| Situation | Error |
|---|---|
| Not in `dependencies` or `uses` | "Git can't call docker: it isn't in the dependencies or uses in Git's plugin.json." |
| A dependency not installed here | "docker isn't installed on this server." |
| A `uses` plugin not installed here | "Git uses docker, but docker isn't installed on this server." |
| The store | "Plugins can't call the store." |
| `terminal` without the `terminal` permission | See [Driving terminals](#driving-terminals) |

- A `call` answered with a subscription is cancelled: "files answered with a subscription: use subscribe.".
- A `subscribe` answered with a reply gets one final `res` with the reply as body, and nothing follows.
- `unsubscribe` ends a subscription, or abandons an unanswered `call`/`subscribe`; the callee gets `cancel`.
- When the caller's process stops, its open calls to other parts are cancelled.

### Settings

A plugin's settings are what the user set in the app, declared by `contributes.settings` in `plugin.json`. The app sends them to each server (the store's `settings_set`); the server keeps them per plugin, server-wide and per project.

`settings` returns the defaults from `plugin.json`, then the server-wide values over them, then (with `project`) that project's values over those. Keys the manifest doesn't declare pass through. When the app changes them, a running process gets `{"t":"settings","project":null,"values":{…}}` (the server-wide result), or `"project":"9f…"` when only that project's values changed. A server-wide change changes every project's result too: ask again for projects you keep.

### Secrets

`secrets.get`, `secrets.set` and `secrets.delete` keep strings (tokens, passwords) for the plugin alone:

- Per plugin id: no plugin can read another's, and clients can't read them at all.
- Encrypted at rest with XChaCha20-Poly1305, with a key the server creates on first use, readable only by the server's user. Each value is bound to its plugin id and name.
- Never logged.
- Names match `^[A-Za-z0-9._-]{1,128}$`; values are at most 64 KiB.
- `uninstall` with `purge` deletes them.

This protects against the file being copied elsewhere, not against the server's own user.

### Notifications

```jsonc
{"t":"req","id":6,"op":"notify","project":"9f…","title":"Pushed main","description":"3 commits","error":false}
```

Every client with the project open shows a toast (`Event::Notice` on its `OpenProject` subscription). `title` is cut at 200 characters and `description` at 2000. At most 10 per plugin per 10 seconds ("Too many notifications: wait a moment.").

With `native: true` (the `notifications` permission; otherwise "Git didn't ask to show system notifications (the notifications permission)."), the apps show a system notification instead. The server sends it to them as a bus event on `hyperpane.os.notify`; the result is `{"id":"git-7","native":true}`, the id the plugin's frames hear in `notificationClick`. With no app that handles it, it's a toast and the result is `null`.

### The event bus

Events by topic between plugins' parts, routed by the server. Server parts are on the bus through these frames; frames through the app (see the [RPC](/docs/reference/rpc#bus-the-event-bus)), which uses the store's `bus_*` ops.

**Topics** are dotted names of letters, digits, `_` and `-`, at most 128 characters (`file.upload`, `git.commit`). A **pattern** is a topic, `prefix.*` (every topic below `prefix.`: `file.*` matches `file.upload` and `file.upload.done`, not `files.x`), or `*`.

What a plugin may do is declared in `plugin.json`, for both of its parts:

```json
"events": { "publish": ["file.upload", "file.*"], "subscribe": ["git.*"], "wake": true }
```

A subscription's pattern must be within one of `subscribe`'s (`git.*` allows `git.*`, `git.commit` and `git.a.*`, not `*`). Anything else is refused: "Git can't publish “file.upload”: it isn't in events.publish in Git's plugin.json.".

**An event,** as a subscriber receives it (a `subEvent`'s body):

```jsonc
{"id":17,                                    // unique on this server while it runs
 "topic":"file.upload",
 "project":"9f…",                            // null: the whole server's
 "from":{"plugin":"files","part":"server"},  // or {"plugin":"explorer","part":"client","window":12}
 "time":1793700000000,                       // ms since 1970
 "request":42,                               // only for a request
 "data":{"path":"/a.txt","size":3}}          // any JSON
```

`from` is set by the server (for parts) or the app (for frames), never by the publisher.

**Publishing:**

```jsonc
{"t":"publish","topic":"file.upload","project":"9f…"}          // body: the data (JSON; empty is null)
{"t":"publish","topic":"files.changed","scope":"server"}        // the whole server's
{"t":"publish","topic":"file.upload","project":"9f…","id":7}    // with id: answered by res
{"t":"res","id":7,"result":{"delivered":2,"woke":0}}
```

- An event is for a `project` (clients with it open and parts assigned to it) or, with `"scope":"server"`, for every subscriber on this server. Without either, it's refused ("Say which project the event is for, or publish it to the whole server (scope: server).").
- Without `id` there's no answer; a refused event goes to the part's log.
- `data` is at most 1 MiB of JSON. A publisher doesn't receive its own events.

**Subscribing:**

```jsonc
{"t":"req","id":5,"op":"bus.subscribe","pattern":"git.*"}                       // every project it's assigned to
{"t":"req","id":6,"op":"bus.subscribe","pattern":"git.commit","project":"9f…"}  // one project's
{"t":"res","id":5,"subscribed":true}
{"t":"subEvent","id":5}                                                          // body: an event
{"t":"unsubscribe","id":5}
```

A part's subscriptions get the events of every project it's assigned to (or `project`'s), plus the server's. They last while its process runs; a part has at most 256.

**Delivery** is at most once, in order from each publisher. A subscriber with more than 4 MiB not yet written to it misses events until it catches up; the store's `bus_stats` counts what it missed.

**Wake:** a stopped part receives nothing, unless its manifest says `"wake": true`: then a matching event starts it, and waits up to 10 seconds for a subscription that takes it. Subscriptions don't keep a part running.

**Requests** ask whoever handles a topic:

```jsonc
{"t":"req","id":8,"op":"bus.request","topic":"file.url","project":"9f…","timeout":5000}  // body: the data
{"t":"res","id":8}                                                                        // body: the first answer
{"t":"busReply","request":42}                       // a subscriber's answer; body: the answer
{"t":"busReply","request":42,"none":true}           // it leaves it to others
{"t":"busReply","request":42,"error":"The disk is full."}
```

The request goes to each subscriber once, as an event with `request`. The first answer with a value wins. When everyone answered `none` or `error`, the reply is the first error, or "Nobody answered “file.url”.". With no subscriber: "Nobody handles “file.url” here.". After `timeout` (ms, default 5000, at most 60000): "Nobody answered “file.url” within 5 s.".

Topics under `hyperpane.os.` belong to the server and the apps: only the app's own subscriptions receive them, and no plugin may publish one ("Topics under “hyperpane.os.” are the app's: no plugin publishes them.").

### Driving terminals

A part with the `terminal` permission drives the project's terminals by calling Terminal's server part (`"plugin":"terminal"`) with JSON requests, without listing it in `dependencies` or `uses`. Every request names the `project`, and a part drives the terminals running on its own server.

```jsonc
{"t":"req","id":6,"op":"call","plugin":"terminal","project":"9f…"}
// body: {"op":"run","project":"9f…","window":12,"command":"npm test","wait":true}
{"t":"res","id":6}
// body: {"command":"npm test","exitCode":1,"output":"…","truncated":false}
```

| `op` | Fields → reply | |
|---|---|---|
| `list` | `{project}` → `TerminalInfo[]` | The project's terminals on this server, including (on its home) terminal windows whose shells aren't running, with `started: false`. |
| `open` | `{project, cwd?, command?, title?, shell?}` → `{window}` | A new terminal window, its shell started now in `cwd` (relative to the project's folder; default the project's folder), with `shell` (an id from `{"op":"shells"}`), else Terminal's Shell setting. `command` is typed at its first prompt. Only on the project's home. |
| `input` | `{project, window, text}` → `null` | Text typed as is (`"\u0003"` is Ctrl+C, `"\r"` Enter). |
| `run` | `{project, window, command, wait?}` → `null`, or a `CommandResult` with `wait` | Types the command and Enter. Refused while a command runs there ("A command is running in this terminal (npm test): wait for it to finish, or send it input."). `wait` needs a shell that marks its commands. Cancelling stops waiting; the command keeps running. |
| `read` | `{project, window, lines?}` → `{text}` | The screen as text; with `lines`, the last that many lines (at most 20,000) of scrollback and screen, wrapped lines joined. |
| `watch` | `{project, window, raw?}` → subscription of `TerminalEvent`s | Use `subscribe`. Output from now on and commands' starts and ends; `{"type":"exit"}` when the shell exits, and the subscription ends. |

```ts
interface TerminalInfo {
  window: number; title: string;
  cwd: string | null;              // as its prompt last said, else where it started
  running: boolean;                // a command is running
  command: string | null;
  lastCommand: string | null; lastExitCode: number | null;
  shellIntegration: boolean;       // the shell marks prompts and commands
  started: boolean;                // its shell is running
  pid: number | null;
  cols: number; rows: number;      // 0 while not started
  viewers: number;
}
interface CommandResult { command: string; exitCode: number | null; output: string; truncated: boolean }
type TerminalEvent =
  | { type: 'output'; text: string }
  | { type: 'commandStart'; command: string | null }
  | { type: 'commandEnd'; command: string | null; exitCode: number | null }
  | { type: 'exit' };
```

- **Output** has escape sequences removed and `\r\n` turned into `\n` (a lone `\r` stays). With `raw: true`, the text as printed. A `CommandResult`'s `output` is the last MiB printed between the command's start and end (`truncated` when there was more).
- **Commands** are detected from the prompt marks hyperpane's shell setup prints (OSC 133: `A` a prompt, `C` a command starts, `D;<status>` it finished). zsh, bash, fish, Git Bash and PowerShell report exit statuses. cmd marks only prompts, so `running` stays false there. A custom shell command and WSL aren't set up: `shellIntegration` is false and `run` with `wait` is refused.
- **Before the first prompt,** `run` (and `open`'s `command`) are typed at the first prompt, or after 3 seconds if none comes; a `wait` then fails ("This terminal's shell showed no marked prompt in its first 3 seconds, …").
- **A window whose shell isn't running** is started by `input`, `run`, `read` and `watch`, at 80×24 until a client shows it.
- Refused: without the permission ("Runner didn't ask to use terminals (the terminal permission in its plugin.json)."), a body that isn't JSON, no `project` ("Say which project's terminals."), a project the part is off in, or a window that isn't a terminal on this server ("That terminal isn't running on this server.").

### Scheduled jobs

A server part can run on a schedule, with nobody connected. Jobs are declared under `server` in `plugin.json`:

```json
"server": {
  "runtime": "node", "main": "main.ts",
  "schedules": [
    { "id": "fetch", "cron": "*/15 * * * *", "description": "Fetches every remote", "timeout": 600 },
    { "id": "gc", "cron": "@daily" }
  ]
}
```

| Field | Rules |
|---|---|
| `id` | `^[a-z][a-z0-9-]{0,31}$`, unique in the part. At most 16 jobs. |
| `cron` | Five fields in the **server's local time**: minute, hour, day of month, month (`1–12` or `jan–dec`), day of week (`0–7`, or `sun–sat`). Each is `*`, `n`, `a-b`, a step (`*/15`, `10-50/20`), or a list. When both day fields are restricted, either matches. Or `@hourly`, `@daily` (`@midnight`), `@weekly`, `@monthly`, `@yearly` (`@annually`). No seconds, no `@reboot`. |
| `description` | At most 200 characters. |
| `timeout` | Seconds a run may take, 1 to 86,400. Default one hour. |

A manifest that breaks these isn't installed.

A job runs **once per server**, for a part installed and assigned to at least one project. At each due time the host starts the part if needed and sends:

```jsonc
{"t":"schedule","id":10,"schedule":"fetch","at":1793700000000}   // at: when it was due
{"t":"reply","id":10}                                             // done (the body is ignored)
{"t":"reply","id":10,"error":"The remote is down."}               // or how it failed
```

- It's answered and cancelled like a call; while it runs, the part isn't idle.
- **No overlap:** a due time while the previous run is going is skipped and logged.
- **Time limit:** a run past its `timeout` is cancelled and fails ("Git's server part didn't finish it in time: it was cancelled.").
- **Missed runs:** a due time missed while the server was down (or the computer slept) runs once, at once, when the server starts.
- **Time-zone changes** are picked up within a minute.
- **Pause** (`schedule_pause`) persists across restarts and updates; a paused job isn't caught up. **Run now** (`schedule_run`) runs it immediately, with `"manual": true` in its last run.

### Streams

A call's payload, or its reply, may carry one stream of bytes of any size. It flows in chunks only as fast as its reader takes it: the reader gives the writer **credit**, a window at first and then what it has read, and the writer never sends past it. So nobody along the way holds more than a window of a stream.

```jsonc
// A part answers call 7 with its stream 1, at ["data"] in the reply.
{"t":"reply","id":7,"stream":{"id":1,"at":["data"]}}  // body: {"name":"big.iso","size":4294967296,"data":null}
{"t":"credit","stream":1,"bytes":2097152}             // host → plugin
{"t":"chunk","stream":1}                              // plugin → host; body: up to 1 MiB
{"t":"streamEnd","stream":1,"error":null}             // plugin → host: that was all

// A call whose payload carries the host's stream 4.
{"t":"call","id":8,"stream":{"id":4,"at":["data"]}}   // body: {"op":"put","name":"a.bin","data":null}
{"t":"credit","stream":4,"bytes":2097152}             // plugin → host
{"t":"chunk","stream":4}                              // host → plugin
{"t":"streamEnd","stream":4,"error":"The file went away."}
{"t":"streamCancel","stream":4,"reason":"…"}          // the reader wants no more
```

| Rule | Detail |
|---|---|
| **Where** | `stream.at` is its path in the message's value, a `null` there, as in a binary body. |
| **Ids** | The writer's: the host numbers the streams it writes, the plugin those it writes. |
| **Credit** | The reader starts with a window (2 MiB by default) and gives back each chunk's size as it reads. A writer holds at most 8 MiB of credit. A chunk is at most 1 MiB (the SDK sends 256 KiB) and never more than the credit; a writer that exceeds it breaks the stream ("The stream's writer sent 2000 bytes when it was allowed 1000."). |
| **Ends** | `streamEnd` with `error: null` when it all went, or a message when the writer gave up. `streamCancel` means write no more; no `streamEnd` follows. A process that stops fails its streams. |
| **With its call** | A reply's stream keeps its call open until the stream ends. A payload's stream ends with its call, so a transform reads while it writes. The caller's `cancel` cancels both. |
| **Who takes them** | The host sends streams only to a part whose hello said `"streams": true` ("Files's server part doesn't take streams."). A part's `call` request says `"streams": true` when it can read a stream in the reply. |
| **Limits** | At most 64 streams per process ("A server part has 64 streams open, the most it may: wait for one to end.") and 16 per client connection. |
| **Only in calls, one each** | Never in subscription events, on the bus, or on ports. The host refuses one where none may go, with a reason ("Files's server part sent a subscription event with a stream in it: events carry none (send it in a call's reply instead)."). |

```jsonc
// Between parts: Relay calls Files with its stream 2, and reads the reply's.
{"t":"req","id":5,"op":"call","plugin":"files","streams":true,"stream":{"id":2,"at":["data"]}}
{"t":"res","id":5,"stream":{"id":9,"at":["data"]}}     // the host writes stream 9
```

```ts
// The SDK: return a stream anywhere in a reply; read one where it was in the request.
serve(json({ calls: {
  read: ({ path }) => ({ name: basename(path), size: statSync(path).size, data: createReadStream(path) }),
  write: async ({ path, data }) => { await pipeline(Readable.fromWeb(data), createWriteStream(path)); return {}; },
} }));
```

### Extension points

An item another plugin contributes to a point with a `call` field is a **provider**: `call` names an op of that plugin's server part. Nothing new crosses the pipe: the owner's frame calls `points.call` (see the [RPC](/docs/reference/rpc#pointscall-extension-points)), and the app calls the provider's part as a client call, with the owner's data plus `op` and `point`:

```jsonc
{"t":"call","id":9}       // no `from`: the app made it
// body: {"op":"lint","point":"editor.diagnostics","path":"/app/schema.prisma","text":"model A {}","language":"Prisma"}
{"t":"reply","id":9}      // body: the answer
{"t":"cancel","id":9}     // the owner gave up (its timeout: 5 s by default, at most 60 s)
```

The server checks contributions' form when a package is installed: `contributes["<plugin>.<point>"]` is a list of at most 64 objects, `call` an op's name; `points` is a list of at most 32 `{id, title}`.

### Sign-in through an app

A server part can't open a browser on the user's computer, but an app can. With the `oauth` permission:

```jsonc
{"t":"req","id":9,"op":"authorize","project":"9f…","authorizeUrl":"https://accounts.example.com/oauth/authorize",
 "clientId":"1234","scopes":["openid","email"]}
{"t":"res","id":9}                     // body: {"code":"…","state":"…","redirectUri":"http://127.0.0.1:53121/callback","codeVerifier":"…"}
{"t":"res","id":9,"error":"The sign-in was declined."}
```

- Refused at once without the permission ("Git didn't ask to sign in with OAuth (the oauth permission)."), without `project`, `authorizeUrl` or `clientId`, for a project this server isn't home to, or when no app has the project open ("No app has this project open to show the sign-in: open it in the hyperpane app (on the computer whose browser should sign in), then try again.").
- The server asks the apps over the bus (`hyperpane.os.authorize`). Each asks the user, runs the sign-in, and answers; the first code wins.
- At most 6 minutes ("Nobody answered “hyperpane.os.authorize” within 360 s.").
- Then exchange the code at the provider's token endpoint and keep the tokens with `secrets.set`.

## Lifecycle

| Event | What the host does |
|---|---|
| **Start** | Lazily, on the first call, a waking bus event, or a due scheduled job. Calls arriving meanwhile wait for the plugin's hello. A failed start fails them with "Git's server part didn't start: <reason>.". |
| **Idle stop** | After 5 minutes with no open calls and `busy` false: `shutdown`. The server's `plugin_idle_secs` setting changes the 5 minutes (0 never stops a part); `HYPERPANE_PLUGIN_IDLE=<seconds>` in the server's environment beats it. |
| **Crash** | The process exits unasked or fails a ping. Open calls fail with "Git's server part stopped (exit code N)." and subscriptions end with that reason. The next call starts it again. Three crashes within 60 seconds mark it `failed` for 60 seconds ("Git's server part crashed 3 times in a minute; see its log."), until the store's `restart` or the time passes. |
| **Update** | When a new version is installed, the old process gets up to 10 seconds to finish its open calls, then `shutdown`. New calls start the new one. |
| **Server stop** | Every process gets `shutdown` at once; after 3 seconds, what's left is ended with its whole tree. A restart is a stop, then a start. |

## The archive

A client installs a server part by uploading a deterministic `.tar.gz` of `plugin.json`, `src/server/**` and `src/shared/**` (without `node_modules/.bin`) through the store's `install_*` ops:

- ustar entries using `prefix` and `name` (paths at most 200 bytes), sorted by path bytewise, regular files only;
- mode 0644, uid and gid 0, empty user and group names, mtime 0;
- gzip level 9, header mtime 0, OS byte 255.

The same packer always gives the same bytes, and so the same SHA-256, for the same files. `hyperpane plugins install` packs this way.

The server checks, in order:

1. The size equals `install_begin`'s, and the SHA-256 matches.
2. Each entry is a regular file; has no absolute path, `..` or `.` segment, empty segment, backslash, drive letter, NUL or control character, or any of `<>:"|?*`; isn't a Windows reserved name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`9`, `LPT1`–`9`) and doesn't end in a dot or space; doesn't differ from another entry only in case; starts with `plugin.json`, `src/server/` or `src/shared/`; and isn't a native addon or binary (`*.node`, `*.dll`, `*.so`, `*.dylib`, `*.exe`, `binding.gyp`). At most 20,000 files, 256 MiB in all, 64 MiB per file.
3. `plugin.json` (at most 256 KB) parses, `manifest` is 1, its `id` and `version` match the request, `server.runtime` is `node`, `server.main` exists under `src/server/` and ends in `.ts`, `.js` or `.mjs`, and `src/server/package.json` has `"type": "module"`.
4. The staging folder becomes `<data>/plugin-parts/<id>/<version>-<sha8>/`.

## Limits

| Limit | Value |
|---|---|
| Client message, plugin frame, body | 64 MiB |
| Noise message | 65,535 bytes |
| Archive upload / unpacked / files / per file | 64 MiB / 256 MiB / 20,000 / 64 MiB |
| `install_chunk` | 1 MiB before base64 |
| Stream chunk / initial window / max credit | 1 MiB / 2 MiB / 8 MiB |
| Streams per connection / per process | 16 / 64 |
| Bus event data | 1 MiB |
| Bus subscriptions per part | 256 |
| Bus backlog per subscriber | 4 MiB |
| Bus request timeout | 5 s default, 60 s max |
| `notify` | 10 per plugin per 10 s |
| Secret name / value | 128 characters / 64 KiB |
| Plugin `hello` | 10 s |
| Ping interval / timeout | 30 s / 10 s |
| Idle stop | 300 s default |
| Scheduled jobs per part | 16 |

## Versions

| | Version | How it's checked |
|---|---|---|
| Client protocol | `PROTOCOL = 3` | In both hellos; a client refuses a server with another version. |
| Plugin protocol | `1` | In both hellos; the host refuses a part with another version. |
| Frame RPC | `api: 1` | In the frame's hello and `init`. |

hyperpane adds features without changing these numbers wherever older peers can keep working:

- **New calls and variants** go at the end of their enums, so older messages keep their meaning.
- **New services** come as reserved plugin ids (`hyperpane`, `hyperpane.server`, `hyperpane.stream`) with JSON requests, so the client protocol doesn't change.
- **New plugin frames and requests** are optional: an older server answers an unknown request with "This server doesn't know the request …", and unknown frames and fields are ignored.
- **Capabilities** are announced: an app's `+bytes`, a part's `"streams": true`, a request's `"streams": true`, the store's `info.streams`.

Version 3 of the client protocol added the project's `plugins` list, `DocOp::SetPlugin`, `ServerInfo.target`, and `Event::Notice`.

## Errors

Errors are sentences, meant to be shown to the user as they are. There are no error codes.

| Where | How an error arrives |
|---|---|
| Connecting | The client library's `ConnectionError`: a wrong key, a protocol version mismatch, or a broken connection |
| A client call | `ServerMsg::Reply { reply: Err(message) }` |
| A subscription | `ServerMsg::Ended { reason: Some(message) }` |
| A plugin's reply | A `reply` frame with `error` |
| A plugin's subscription | An `end` frame with `reason` |
| A plugin's request | A `res` frame with `error` |
| A stream | `streamEnd` with `error`, or `streamCancel` with `reason` |

Common server errors:

| Error | Meaning |
|---|---|
| "The server didn't accept the key. Paste the key it prints now." | The key's secret doesn't match (it may have been replaced). |
| "This server is older than the app. …" / "This server is newer than the app: update the app." | The protocol versions differ. |
| "No such project on this server." | The project isn't on this server, or this server isn't its home. |
| "Git's server part didn't start: …" | The part failed its handshake. |
| "Git's server part stopped (exit code 1)." | The part crashed during the call. |
| "Git's server part crashed 3 times in a minute; see its log." | The part is marked failed for 60 seconds. |
| "This server doesn't know the request "foo"." | A plugin request the server is too old for. |
| "The hyperpane.stream plugin isn't installed on this server." | The server is from before streams. |
