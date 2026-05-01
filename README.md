## FROM HUMAN

MarkAllDown, or MAD, has grown from a markdown editor/reader into a combined app, cool things I want to emphasize:
- Gnome-style terminal is bundled together 
  - Claude Code support! You can view CC's diff and plan file in pop-up window. Check CC's section below.
- Self-hosted or cloud NAS for storage
- Agentic apps integrated with plug-in styles under way
  - We are trying support customized agents by agents.md/skills.md with dedicated UI.
- Smart RSS
  - A small recommendation model is bundled for preference tracking.
More on https://utssd.github.io/blog/.

# MarkAllDown

A desktop workspace for reading, writing, and making sense of your notes.

Read Markdown / PDF / code, edit Mermaid diagrams and LaTeX equations, run local and SSH terminals, sync to your own WebDAV server, back up to end-to-end encrypted cloud storage, and run LLM-powered agents over your library — all in one Electron app.

## Install & Run

```bash
npm install
npm start
```

Prebuilt binaries are also produced by `npm run build` (Linux AppImage), `npm run build:deb` (Debian), `npm run build:mac` (macOS dmg + zip), or `npm run build:all` for every platform at once.

Settings are persisted to your OS user-data folder (`~/.config/MarkAllDown/settings.json` on Linux, `~/Library/Application Support/MarkAllDown/` on macOS).

---

## Features

### Reader

Open any Markdown, PDF, or text file with **File → Open Local** (`Ctrl+O`) or drag-and-drop onto the window. Multi-tab; each tab remembers its own scroll.

- Markdown renders with GFM tables, Mermaid diagrams, KaTeX math, and syntax-highlighted code blocks.
- PDFs render page-by-page (canvas) with zoom and keyboard paging.
- `.json`, `.yaml`, `.py`, `.js`, `.ts`, `.xml`, `.csv`, `.log`, `.sh`, `.env`, and friends open as monospace text.
- Toggle **Settings → General → Strip front matter** to hide YAML/TOML headers from rendered Markdown.
- **Find** in the current doc with `Ctrl+F`.

### Markdown Editor

Switch to **Editor → Markdown** for a live-preview Markdown editor (CodeMirror). Left pane is source, right pane renders as you type. Save with `Ctrl+S` — works for both local files and remote (WebDAV) files.

### Mermaid Editor

**Editor → Mermaid** is a dedicated diagram editor. Type Mermaid DSL on the left, see the rendered diagram on the right. Export as SVG or PNG from the toolbar.

### LaTeX Editor

**Editor → LaTeX** renders equations with KaTeX as you type. Handy scratchpad for equation-heavy notes; copy the rendered HTML or the source as needed.

### Terminal

**Terminal** tab opens a full PTY shell (bash/zsh/powershell) rendered with xterm.js.

- `Ctrl+Shift+T` — new tab
- `Ctrl+Shift+W` — close tab
- `Ctrl+PageUp` / `Ctrl+PageDown` — switch tabs
- Rename tabs by double-clicking the sidebar label.
- Open an **SSH tab** for a persistent remote shell — the connection lives for the lifetime of the tab.

### Pages / Library

Every file you open or save is silently tracked. Visit the **Pages** tab to see your entire reading/writing history — local, WebDAV, and cloud files unified in one list with source badges, word counts, tags, and relative dates.

- Click any page to reopen it.
- **Sync** button refreshes a remote snapshot on demand.
- The tracker also powers the agents — so Pages is your agents' view of your world.

### WebDAV Sync

Connect MarkAllDown to any WebDAV server (Nextcloud, Synology NAS, QNAP, Nginx with `dav_methods`, Caddy + webdav plugin, wsgidav, etc.) via **Settings → Remote Storage → WebDAV**.

- **File → Open Remote** (`Ctrl+Shift+O`) browses the server; saves write back with one click.
- Optional **SSH tunnel** (Settings → WebDAV → SSH Tunnel) — point it at your home server and MarkAllDown opens an `ssh -L` port forward for you. No more manual tunnel setup.
- Files are stored as plaintext on **your** server. Use HTTPS for transport encryption.

Quick self-hosting options:

| Server        | Setup                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Nextcloud     | Enable in admin panel                                                     |
| Synology NAS  | File Station → WebDAV in Control Panel                                    |
| QNAP NAS      | App Center → WebDAV Server                                                |
| Nginx         | `dav_methods PUT DELETE MKCOL COPY MOVE;`                                 |
| Caddy         | `file_server` + `webdav` plugin                                           |
| Raspberry Pi  | `docker run -p 8080:80 bytemark/webdav`                                   |
| Laptop        | `pip install wsgidav && wsgidav --host=0.0.0.0 --port=8080 --root=./docs` |

### Cloud Backup (End-to-End Encrypted)

Optional — back up any file to an S3-compatible cloud with **client-side** AES-256-GCM encryption. Files are encrypted on-device before they leave.

```
password + userId
       │
       ▼  PBKDF2-HMAC-SHA256 (310,000 rounds)
      KEK  (ephemeral, never stored)
       │
       ▼  AES-256-GCM
    FEK blob  ←  stored encrypted on server
       │
       ▼  AES-256-GCM (per file, random IV)
    ciphertext  ←  stored in S3 / COS
```

The server only ever sees ciphertext. Changing your password re-encrypts the FEK **without** re-uploading files.

Set the server URL under **Settings → Cloud → Server URL**, then sign in. Use **File → Backup to Cloud** / **Restore from Cloud** to move files.

### Agents

Agents are LLM-powered tasks that run in an isolated local worker process and stream progress back to the UI. Configure your LLM once under **Settings → Agents** (OpenAI-compatible or Anthropic), then open the **Agents** tab.

Bundled agents:

- **MindMap** — reads every file in your library, asks the LLM to organize them into thematic swim lanes with cross-thread connections, and renders an interactive SVG knowledge map (d3.js, pan/zoom, hover tooltips, click-to-open).
- **LLM Wiki** — Karpathy-style personal wiki builder: ingest/query/lint modes that distill your notes into a cross-linked wiki on WebDAV.
- **On This Day** — picks one past note from a configurable lookback window (7 days, 30 days, 1 year ago…) and opens it in Pages.
- **Tension Finder** — names one unresolved tension across your last 7 days of writing, with verbatim quotes from your notes.

Agents are self-contained folders under `agents/`. Drop one in, it appears in the sidebar. See **Build Your Own Agent** below.

---

## LLM Configuration

Under **Settings → Agents**:

| Provider    | Format                 | Works with                                 |
| ----------- | ---------------------- | ------------------------------------------ |
| `openai`    | OpenAI-compatible REST | OpenAI, vLLM, llama.cpp, Ollama, LM Studio |
| `anthropic` | Anthropic Messages API | Claude via `x-api-key` header              |

Set `baseUrl`, `apiKey`, `model`, and optional `temperature` / `maxTokens` / `topP` / `systemPrompt`.

---

## Build Your Own Agent

An agent is a folder under `agents/`. Drop one in, restart MarkAllDown, and it shows up in the sidebar. Remove the folder, it disappears. No config file edits, no build step.

The design mirrors the [Agent Skills](https://agentskills.io) open standard.

### Minimum viable agent — two files

```
agents/my-agent/
├── AGENT.md        # manifest (YAML frontmatter + docs)
└── worker.js       # async run() function
```

`AGENT.md`:

```markdown
---
name: my-agent
title: My Agent
description: One-line summary shown in the sidebar.
execution: local
entry:
  worker: worker.js
requires:
  llm: { provider: openai }
params:
  - { name: topic, type: text, label: Topic }
---

# My Agent

Markdown body is rendered as in-app documentation.
```

`worker.js`:

```js
exports.run = async ({ params, sendProgress, helpers }) => {
  sendProgress('Thinking about ' + params.topic, 'info');
  // Call the LLM, read files from WebDAV, etc.
  sendProgress('Done', 'done');
  return { markdown: '# Results\n\nSomething interesting about ' + params.topic };
};
```

That's it. The shell auto-generates the params form, run/cancel buttons, progress log, and output pane.

### Three UI tiers

Progressive disclosure — pick the level that fits:

- **Tier 0** — 2 files. Declare `params` in the manifest; the shell renders a form + log + output pane. Output is any `{ markdown }`, `{ html }`, `{ json }`, or `{ text }` the worker returns, rendered by MarkAllDown's built-in Markdown/KaTeX/Mermaid pipeline.
- **Tier 1** — 3 files. Add `ui.js` exporting `renderOutput(host, data)` for a custom output view (tables, charts).
- **Tier 2** — 4+ files. Add `ui.html` + `ui.css` + expand `ui.js` to `mount({host, api}) / unmount()` for full control (like MindMap's d3 visualization).

### What `run()` receives

```ts
run({
  runId: string,
  agentId: string,
  params: { [key: string]: any },
  signal: AbortSignal,
  sendProgress: (message: string, level?: 'info'|'warn'|'error'|'done') => void,
  helpers: {
    webdav?: { read, write, exists },   // if capabilities.webdav is set
    openWebdavFile?: (path) => Promise<void>,
  },
})
```

`sendProgress` levels color-code the progress log (`info`, `warn`, `error`, `done`).

### Test while you iterate

MarkAllDown watches `agents/`. **Folder add/remove and `AGENT.md` edits update the sidebar live** — no restart. Code edits to `worker.js` / `ui.js` still need a restart.

Full authoring guide with every manifest field, the helpers API, cloud/hybrid execution modes, and discovery rules: [`agents/README.md`](agents/README.md).

---

## Claude Code Companion Windows

If you run [Claude Code](https://claude.com/claude-code) inside the MarkAllDown terminal tab, two dedicated pop-up windows turn the main app into a live inspector for the session — showing you the files being edited and the plan being followed without breaking your flow.

Both windows are opened from the **View** menu or with a keyboard shortcut, float independently of the main window, remember their position, and shut down automatically when the app closes.

### Claude Diff Viewer — `Ctrl+Shift+D`

A side-by-side diff pop-up that shows every file Claude touched in its **latest assistant turn**.

- **Round-based.** Each user prompt starts a new "round." The viewer clears and re-populates as Claude edits, creates, or deletes files during that round.
- **Tab per file.** Files touched in the round become tabs across the top; click to inspect any of them.
- **Auto-binds to the active terminal tab.** The window walks the tab's process tree to find the `claude` PID and reads the transcript file directly — no configuration, no copy-paste.
- **Works over SSH.** If the terminal tab is an SSH session and you're running Claude Code on the remote host, the viewer reads the remote transcript over the existing SSH connection (the same `ssh2` stack WebDAV uses). File snapshots come from the remote filesystem.
- **Session picker.** If the PID walk is ambiguous or the session file can't be resolved automatically, a picker lists recent Claude Code sessions for the tab's working directory so you can re-bind with one click.
- **Pin** to keep the current round frozen while you keep working — useful for reviewing a chunk of changes before moving on.

### Claude Plan Viewer — `Ctrl+Shift+P`

A live-watched Markdown pane for the plan file Claude Code writes when you're in plan mode.

- **Auto-discovers the plan.** Resolves the plan-file path for the active terminal tab's Claude session and opens it.
- **Re-renders on every write.** The plan updates in-place as Claude refines it — no manual reload.
- **Full Markdown rendering.** Headings, lists, tables, code blocks, Mermaid diagrams, and KaTeX math all render with the same pipeline as the Reader tab.
- **Works over SSH** too: plan files on a remote host are watched over the SSH connection.

### Cycle windows — `` Ctrl+` ``

Rotates focus through Main → Diff → Plan → Main. Closed or destroyed windows are skipped automatically. Handy when you have all three open and want to glance at one without reaching for the mouse.

### Typical workflow

1. Open a **Terminal** tab (local or SSH) and run `claude`.
2. Press `Ctrl+Shift+D` — the diff window attaches to that session and starts tracking edits.
3. Press `Ctrl+Shift+P` — the plan window opens alongside if Claude is in plan mode.
4. Keep working in the terminal. Every time Claude finishes an assistant turn, the diff window refreshes with exactly the files it touched. The plan window live-updates as the plan evolves.
5. Use `` Ctrl+` `` to cycle focus between windows.

No telemetry, no cloud calls — these windows read Claude Code's local session files (or remote ones over your existing SSH tunnel) and render them locally.

---

## Keyboard Shortcuts

| Shortcut          | Action              |
| ----------------- | ------------------- |
| `Ctrl+O`          | Open local file     |
| `Ctrl+Shift+O`    | Open remote file    |
| `Ctrl+S`          | Save                |
| `Ctrl+F`          | Find in document    |
| `Ctrl+Shift+T`    | New terminal tab    |
| `Ctrl+Shift+W`    | Close terminal tab  |
| `Ctrl+PageUp/Dn`  | Switch tabs         |
| `Ctrl+Shift+D`    | Claude Diff Viewer  |
| `Ctrl+Shift+P`    | Claude Plan Viewer  |
| `` Ctrl+` ``      | Cycle windows       |

---

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Free for personal, educational, and research use. Commercial use requires a separate license — contact the maintainer.
