# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other AI coding assistants working in this repository.

## Project Overview

MarkAllDown is an Electron desktop app for reading Markdown / PDF / text, editing Mermaid and LaTeX, running terminal sessions, syncing with WebDAV, backing up to end-to-end encrypted cloud storage, and running LLM-powered agents over a personal library.

## Rules

1. For any frontend/UI change, verify behavior in a browser (Playwright/headless Chrome is fine) before declaring the task done. Dump screenshots/videos under `./artifacts/`.
2. Save all test artifacts and smoke-test results under `./artifacts/`.
3. Run `npm run test:unit` and `npm run test:packaging` before concluding any non-trivial change.

## Commands

```bash
npm start                # launch Electron app
python3 serve.py         # browser-based preview at http://localhost:8081

npm run test:unit        # node --test over unit tests
npm run test:packaging   # verify electron-builder config
npm run lint             # eslint

npm run build            # Linux AppImage
npm run build:linux      # Linux AppImage + tar.gz
npm run build:deb        # Linux .deb
npm run build:mac        # macOS dmg + zip
npm run build:all        # all platforms
npm run release          # full cross-platform release (release.sh)

npm run install:linux    # install locally after building
```

## Architecture

Standard Electron three-layer model with strict context isolation:

- **`main.js`** (main process): windowing, native dialogs, all file I/O, WebDAV (`vendors/webdav.js`), optional SSH tunnel (`vendors/ssh2.js`), local terminal PTY (`node-pty`), cloud backup crypto, file-tracker, agent worker lifecycle. Exposes functionality through `ipcMain.handle`.
- **`preload.js`** (preload script): security boundary. `contextBridge.exposeInMainWorld` provides a typed `window.electronAPI` to the renderer. No direct Node.js access.
- **`app.js`** (renderer process): all UI — mode switching, CodeMirror editors, Mermaid/KaTeX rendering, Markdown via `marked`, tabs, find bar, WebDAV browser, Pages, Agents, Settings modal.
- **`index.html`**: static shell with mode views (reader, editor, pages, agents, terminal) toggled by `app.js`.

### Agents

Self-contained folders under `agents/<id>/` with an `AGENT.md` manifest. Auto-discovered at startup. See [`agents/README.md`](agents/README.md) for the full authoring guide and [`README.md`](README.md) § "Build Your Own Agent" for a quick-start.

### Supported File Types

Defined in `SUPPORTED_EXTENSIONS` in `main.js`:

- **Markdown** (`marked`): `.md`, `.markdown`, `.txt`
- **PDF** (`pdfjs-dist`): `.pdf`
- **Plain text** (monospace): `.json`, `.yaml`, `.yml`, `.xml`, `.csv`, `.log`, `.ini`, `.toml`, `.conf`, `.cfg`, `.env`, `.properties`, `.sh`, `.bash`, `.zsh`, `.py`, `.js`, `.ts`, `.html`, `.css`

### Third-Party Libraries

- **CodeMirror 5**, **Mermaid 11**, **KaTeX**, **marked 16**, **pdfjs-dist 5**, **xterm.js 6**, **d3 7**
- **webdav 4** — vendored to `vendors/webdav.js`
- **ssh2** — vendored to `vendors/ssh2.js`
- **node-pty** — native addon

## IPC Channels

See `main.js` `ipcMain.handle(...)` registrations for the authoritative list.
