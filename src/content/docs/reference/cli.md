---
title: Command line
description: "The hyperpane command: every command and flag for working with a server from a terminal."
section: Reference
order: 32
---

# Command line

`hyperpane` works with a hyperpane [server](/docs/servers) from a terminal: list its projects, open and read terminals, call plugins, install plugins and run them in dev mode, and change the server's settings. It's a client like the app, speaking the [wire protocol](/docs/reference/protocol), so everything it does works the same against the server on your machine and one elsewhere.

```sh
hyperpane [--key KEY | --data-dir DIR] <command>
```

Run `hyperpane` or `hyperpane help` to print the usage.

The app comes with it: when a terminal can't find `hyperpane`, the app offers to install it at start (see [Install](/docs/installation#the-hyperpane-command)). The server's download has it too, beside `hyperpane-server`.

## Choosing a server

`hyperpane` connects to one server per run, found in this order:

1. `--key KEY`: a server key (`hpk1_…`), as the server prints it and the app's Servers page shows it.
2. The `HYPERPANE_KEY` environment variable.
3. This machine's server: the key in its data folder (`--data-dir DIR` to look in another folder).

Without a key and with no local server yet, it says so: "No server on this machine yet (… has no key). Start one: hyperpane-server run --local".

```sh
# This machine's server
hyperpane projects

# Another server, for one command
hyperpane --key hpk1_eyJpZCI6… projects

# Another server, for a whole session
export HYPERPANE_KEY=hpk1_eyJpZCI6…
hyperpane info
```

A server key grants full access as the server's user. Keep it out of shell history and shared scripts where you can, for example by reading it from a file: `HYPERPANE_KEY=$(cat ~/my-server.key) hyperpane info`.

## Global options

| Option | Description |
|---|---|
| `--key KEY` | The server to use, by its key. Overrides `HYPERPANE_KEY`. |
| `--data-dir DIR` | Read this machine's server key from `DIR` instead of the server's default data folder. |

Options go before the command. Each takes a value; an unknown option prints the usage.

| Environment variable | Description |
|---|---|
| `HYPERPANE_KEY` | The server key to use when there's no `--key`. |
| `HYPERPANE_PLUGINS_DIR` | The app's plugins folder, for `plugin dev`. Default: `~/.hyperpane/plugins` (`%APPDATA%\hyperpane\plugins` on Windows). |

## Output and exit status

Commands print plain text to stdout, one item per line, with fields separated by two spaces, so you can pipe them into `cut`, `awk` or `grep`. Errors go to stderr, as sentences, and the exit status is `1`; success is `0`.

## Commands

| Command | Description |
|---|---|
| [`info`](#info) | The server's details |
| [`projects`](#projects) | Its projects |
| [`add FOLDER`](#add) | Add a folder on the server as a project |
| [`windows PROJECT`](#windows) | A project's windows |
| [`term list`](#term-list) | Every terminal running on the server |
| [`term new PROJECT [FOLDER]`](#term-new) | Open a terminal window |
| [`term read PROJECT WINDOW`](#term-read) | What's on a terminal's screen |
| [`term send PROJECT WINDOW TEXT`](#term-send) | Type into a terminal |
| [`call PLUGIN JSON`](#call) | Call a plugin's server part |
| [`plugins list`](#plugins-list) | The server's plugin parts |
| [`plugins install DIR --project PROJECT`](#plugins-install) | Upload a plugin's server part and turn it on in a project |
| [`plugins enable PROJECT ID`](#plugins-enable-and-disable) | Turn a plugin on in a project |
| [`plugins disable PROJECT ID`](#plugins-enable-and-disable) | Turn it off |
| [`plugins restart ID`](#plugins-restart) | Restart a plugin's server part |
| [`plugins log ID`](#plugins-log) | A plugin's log |
| [`plugin dev [DIR]`](#plugin-dev) | Run a plugin in dev mode |
| [`config`](#config) | The server's settings |
| [`config get KEY`](#config-get) | One setting |
| [`config set KEY VALUE`](#config-set) | Save a setting |
| [`config unset KEY`](#config-unset) | Put a setting back to its default |
| [`restart`](#restart) | Restart the server and wait for it |
| [`new-key`](#new-key) | Replace the server's key |

## Server and projects

### `info`

Prints the server's name and id, version, operating system and architecture, uptime, home folder, and installed plugin server parts.

```sh
hyperpane info
```

```text
my-server (0123456789abcdef), hyperpane server 0.2.6 on macos aarch64
up 5321s, home /home/you
plugins: git 0.2.6, files 0.2.6, terminal 0.2.6
```

### `projects`

Prints each project on the server as `ID  NAME  FOLDER`.

```sh
hyperpane projects
```

```text
9f2c41e0b7a3  app  /home/you/app
51d0aa93c4e8  docs  /home/you/docs
```

Use the id (the first column) wherever a command takes `PROJECT`.

### `add`

```sh
hyperpane add FOLDER
```

Adds a folder on the server as a project, creating `.hyperpane/` in it if it has none, and prints the project as `ID  NAME  FOLDER`. `FOLDER` is a path on the server, not on your machine.

```sh
hyperpane add /home/you/app
```

### `windows`

```sh
hyperpane windows PROJECT
```

Prints the project's windows as `ID  PLUGIN  TITLE  STATE`, where `STATE` is the window's machine-local state.

```sh
hyperpane windows 9f2c41e0b7a3
```

```text
1  editor  main.rs  {}
2  terminal  Terminal  {"folder": "/home/you/app"}
```

## Terminals

Terminals run on the server and keep running when no client is watching. A terminal is a window of a project, so terminal commands take the project's id and the window's id.

### `term list`

Prints every terminal running on the server as `PROJECT WINDOW  COLSxROWS  pid PID  N watching  TITLE`.

```sh
hyperpane term list
```

```text
9f2c41e0b7a3 2  120x32  pid 48211  1 watching  zsh
```

### `term new`

```sh
hyperpane term new PROJECT [FOLDER]
```

Adds a terminal window to the project (660 × 440 at the canvas's origin), starts its shell at 80 × 24 in `FOLDER` (default: the project's folder), and prints the new window's id. The shell keeps running after the command exits, and the window appears in every app with the project open.

```sh
window=$(hyperpane term new 9f2c41e0b7a3 /home/you/app/web)
```

### `term read`

```sh
hyperpane term read PROJECT WINDOW
```

Prints what's on the terminal's screen now, as text.

### `term send`

```sh
hyperpane term send PROJECT WINDOW TEXT
```

Types `TEXT` into the terminal, as if typed. `\r` in the text becomes Return and `\n` a newline; quote the text so your shell passes the backslashes through.

```sh
hyperpane term send 9f2c41e0b7a3 2 'npm test\r'
sleep 5
hyperpane term read 9f2c41e0b7a3 2
```

## Calling plugins

### `call`

```sh
hyperpane call PLUGIN JSON
```

Calls a plugin's server part with `JSON` as the request and prints its reply. The text is sent as it is, as the call's payload, so it must be what the plugin expects (for hyperpane's plugins, a JSON object, usually with an `op`). The reply is printed as text. The call starts the plugin's server part if it isn't running.

```sh
hyperpane call git '{"op":"status","project":"9f2c41e0b7a3"}'
```

`call` waits for one reply, so it's for plain calls, not subscriptions or streams. If the plugin answers with an error, `hyperpane` prints it to stderr and exits with `1`.

The same command reaches the server's [reserved plugin ids](/docs/reference/protocol#reserved-plugin-ids):

```sh
# The plugin store
hyperpane call hyperpane '{"op":"info"}'
hyperpane call hyperpane '{"op":"settings_get","plugin":"git"}'

# The server's own settings, as JSON
hyperpane call hyperpane.server '{"op":"get","log":20}'
```

What a plugin's server part accepts is up to the plugin; see [Writing a plugin](/docs/plugins/writing). The calls a plugin's window makes through the app are described in the [RPC](/docs/reference/rpc).

## Plugins

These commands manage plugins' **server parts** on the server: the code that runs there. A plugin's client part (its windows) lives in the app.

### `plugins list`

Prints each server part as `ID VERSION  STATUS[  built in][  pid PID][  N MB]  projects: N`, followed by its last error on an indented line if it has one. `STATUS` is `idle`, `starting`, `running`, `stopping` or `failed`.

```sh
hyperpane plugins list
```

```text
git 0.2.6  running  pid 48302  52 MB  projects: 2
terminal 0.2.6  running  built in  projects: 3
docker 0.1.0  failed  projects: 1
    Docker's server part crashed 3 times in a minute; see its log.
```

### `plugins install`

```sh
hyperpane plugins install DIR --project PROJECT
```

Packs the server part of the plugin package in `DIR` (`plugin.json`, `src/server/` and `src/shared/`) into a deterministic archive, uploads it to the server, assigns it to `PROJECT`, and turns the plugin on there. `--project` is required, and may come before or after `DIR`.

```sh
hyperpane plugins install ./hyperpane-echo --project 9f2c41e0b7a3
```

```text
installed echo 0.1.0
on in 9f2c41e0b7a3: echo, editor, explorer, files, terminal
```

The package must have a server part (`src/server`). The server checks the archive and `plugin.json` and refuses one with problems, saying why. To install the whole plugin, client part included, use the app's Plugins page. While you're developing a plugin, use [`plugin dev`](#plugin-dev) instead.

### `plugins enable` and `disable`

```sh
hyperpane plugins enable PROJECT ID
hyperpane plugins disable PROJECT ID
```

Turns a plugin on or off in a project, and prints the plugins now on there, comma-separated. Run them against the project's home server. Turning a plugin off tells its server part to end its work in that project (Terminal ends that project's shells).

### `plugins restart`

```sh
hyperpane plugins restart ID
```

Restarts a plugin's server part: clears a `failed` status, stops the process if it's running, and starts it again.

### `plugins log`

```sh
hyperpane plugins log ID
```

Prints the last 200 lines of the plugin's server-part log, each with its time. The log holds what the part writes to stderr (including `console.log` from Node parts) and the server's own lines about it (started, stopped, crashed).

### `plugin dev`

```sh
hyperpane plugin dev [DIR] [--project PROJECT] [--server KEY] [--keep] [--debounce MS]
```

Runs the plugin in `DIR` (default: the current folder, which must hold `plugin.json`) live while you write it:

- **Checks** `plugin.json` as the server and the app do (`manifest` is 1, a valid id and version, `server.main` and `client.main` exist, `src/server/package.json` has `"type": "module"`), plus the SDK's own validator when the package has `@hyperpane/sdk` installed. Problems are printed, and it waits for you to fix them.
- **Installs the server part** (when there's `src/server`) on the server as a dev install, replacing any version there, and restarts it at once so a crash on start shows immediately. Each change under `src/server/`, `src/shared/` or to `plugin.json` installs and restarts it again, once the files have been still for the debounce time. `node_modules` isn't watched. A failed install is printed, and it keeps watching.
- **Shows the log** as it's written: the last 20 lines first, then everything the part and the server write about it, plus errors and warnings from the plugin's windows in the app.
- **Loads the client part** in the app on this machine from `DIR`, in place of any installed copy (its Plugins page shows a **Dev** badge). A change under `src/client/` or `src/shared/` reloads the plugin's frames; a change to `plugin.json` also rereads its contributions, settings and icons. Windows and their data stay.

**Ctrl+C** ends dev mode: the app goes back to the installed copy, if any, and the dev install is removed from the server (its data stays), unless you passed `--keep` or another install of the plugin was there before dev mode replaced it.

| Option | Description |
|---|---|
| `--project PROJECT` | Also turn the plugin on in this project. |
| `--server KEY` | The server to install on (`--key` works too). Default: the global `--key`, `HYPERPANE_KEY`, or this machine's server. |
| `--keep` | Leave the dev install on the server at the end. |
| `--debounce MS` | How long the files must be still before an install, in milliseconds. Default `300`. |
| `--help`, `-h` | Print the usage. |

```sh
cd ~/code/hyperpane-echo
hyperpane plugin dev --project 9f2c41e0b7a3
```

```text
dev mode: Echo 0.1.0 from /home/you/code/hyperpane-echo
  server: my-server (127.0.0.1:38888)
  app: loads Echo's client part from here (/home/you/.hyperpane/plugins/.dev.json)
✓ server part installed (3f9a1c2e) and started
  on in 9f2c41e0b7a3: echo, editor, explorer, files, terminal
watching for changes; Ctrl+C ends dev mode

· changed: src/server/main.ts
✓ server part installed (b71e04d9) and started
```

The app learns about dev plugins through `.dev.json` in its plugins folder, so dev mode works with the app closed, and the app picks the plugin up when it starts. If `hyperpane` is killed rather than stopped with Ctrl+C, the app ignores its entry once the process is gone. See [Writing a plugin](/docs/plugins/writing) for the whole workflow.

## Server settings

These read and change the server's `config.json`. You can also edit that file by hand: the running server rereads it.

| Setting | Meaning | Applies |
|---|---|---|
| `name` | What the server is called in clients (at most 64 characters). Default: the machine's name. | At once |
| `address` | The IP address it listens on: `0.0.0.0` for every interface, `127.0.0.1` for this machine only. Default `0.0.0.0` (this machine's local server always listens on `127.0.0.1`). | After a restart |
| `port` | The port it listens on, 1 to 65535. Default `38888` (this machine's local server reuses its last port). | After a restart |
| `host` | The name or IP address clients reach this machine by, written into the key. Default: the machine's host name (`127.0.0.1` for the local server). | At once |
| `idle_exit_secs` | Exit after this many seconds with nothing running and no client attached; `0` never (at most 2,592,000). Default: never (60 for the local server). | At once |
| `plugin_idle_secs` | Stop an idle plugin server part after this many seconds (it starts again on its next call): 10 to 604,800, or `0` never. Default `300`. | After a restart |
| `node` | The full path of the Node that runs plugins' server parts. Default: `$HYPERPANE_NODE`, the bundled runtime, or `node` on `PATH`. | After a restart |

### `config`

Prints the server's name, id, version, host name, pid and listening address, then each setting with its value and notes: whether it's the default, whether a restart is needed to apply a saved value, and whether a command-line flag the server was started with overrides it.

```sh
hyperpane config
```

```text
my-server (0123456789abcdef), hyperpane server 0.2.6 on my-server (pid 48190), listening on 0.0.0.0:38888
  name               my-server                  (default)
  port               4000                       restart to apply (running: 38888)
  plugin_idle_secs   600
```

`hyperpane config get` with no setting does the same.

### `config get`

```sh
hyperpane config get KEY
```

Prints one setting's saved value, or its default when it isn't set.

```sh
hyperpane config get port
```

### `config set`

```sh
hyperpane config set KEY VALUE
```

Saves one setting. The server applies it at once if it can, and `hyperpane` says which happened:

- "Saved and applied."
- "Saved. It takes effect when the server restarts: hyperpane restart"
- "Saved. The server runs with …, which wins over it." (a flag the server was started with overrides it)

Everything after `KEY` is joined with spaces into the value, so a name with spaces needs no quotes. An invalid value is refused and nothing is saved ("“70000” isn't a port (1 to 65535).").

```sh
hyperpane config set name Build box
hyperpane config set plugin_idle_secs 0
```

### `config unset`

```sh
hyperpane config unset KEY
```

Puts a setting back to its default. (`config set KEY ''` with an empty value does the same.)

### `restart`

```sh
hyperpane restart
```

Restarts the server (it stops everything it runs, then runs again with the same arguments and data folder) and waits up to 60 seconds for it to come back, then prints the address it's back at. Plugin server parts start again on their next call; terminals' shells start again when a client shows them. If the restart changed the server's port, `hyperpane` prints a key with the new address.

```text
restarted; back at 127.0.0.1:38888
```

### `new-key`

```sh
hyperpane new-key
```

Replaces the secret in the server's key and prints the new key. **Every connected client is cut off at once**, and only clients given the new key can connect again: paste it into the app's Servers page on each machine that uses this server. Use it when a key may have leaked.

```text
New key made. Every client was cut off; this key gets them back in:

hpk1_eyJpZCI6…
```

## Scripting examples

Run the tests in a new terminal and print the screen:

```sh
project=$(hyperpane projects | awk '$2 == "app" { print $1 }')
window=$(hyperpane term new "$project")
hyperpane term send "$project" "$window" 'npm test\r'
sleep 10
hyperpane term read "$project" "$window"
```

Find plugin parts that failed, and print their logs:

```sh
hyperpane plugins list | awk '$3 == "failed" { print $1 }' | while read -r id; do
  echo "== $id"
  hyperpane plugins log "$id" | tail -n 20
done
```

Check a remote server's settings without changing your environment:

```sh
hyperpane --key "$(cat ~/keys/my-server.key)" config
```
