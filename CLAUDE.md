# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarkAllDown is an Electron desktop app for reading/editing Markdown files, editing Mermaid diagrams, and editing LaTeX equations. It supports SSH-based file sync and remote file opening via SFTP.

## Commands

```bash
# Run in development (Electron)
npm start

# Browser-based testing (serves at http://localhost:8081)
python3 serve.py

# Build
npm run build          # Linux AppImage
npm run build:linux    # Linux AppImage + tar.gz
npm run build:deb      # Linux .deb
npm run build:mac      # macOS dmg + zip
npm run build:all      # All platforms
npm run release        # Full cross-platform release (via release.sh)

# Install on Linux after building
npm run install:linux
# Or with options:
bash install-linux.sh --build --system
```

There are no tests or lint commands.

## Architecture

The app uses the standard Electron three-layer pattern with strict context isolation:

- **`main.js`** (main process): Window management, native dialogs, all file I/O, and SSH/SFTP operations using the `ssh2` library. Exposes functionality to the renderer exclusively through IPC handlers (`ipcMain.handle`).

- **`preload.js`** (preload script): Security boundary. Uses `contextBridge.exposeInMainWorld` to expose a typed `window.electronAPI` object to the renderer. The renderer cannot access Node.js APIs directly.

- **`app.js`** (renderer process): All UI logic — mode switching, CodeMirror editor instances, Mermaid diagram rendering, KaTeX equation rendering, Markdown parsing via `marked`, tab management, find bar, SSH modals, and settings modal. Communicates with main process only through `window.electronAPI`.

- **`index.html`**: Static shell defining four mode views (reader, mermaid, latex, md-editor) that are shown/hidden by `app.js`. Loads all third-party libraries from `node_modules/` directly.

### IPC Channels

Main→Renderer (push events): `file:opened`, `menu:openFile`, `menu:saveFile`, `menu:openFromSsh`, `menu:find`

Renderer→Main (invoke/reply): `dialog:openFile`, `dialog:saveFile`, `dialog:saveHtml`, `settings:load`, `settings:save`, `ssh:sync`, `ssh:testConnection`, `ssh:copyKey`, `remote:sshListFiles`, `remote:sshReadFile`

### SSH / Settings

- SSH settings are persisted to `<userData>/settings.json` (Electron's `app.getPath('userData')`)
- SSH keys are auto-generated and stored at `~/.ssh/markalldown_rsa` (RSA 4096)
- The app enforces a single-instance lock; a second launch passes its file argument to the running instance

### Supported File Types

`.md`, `.markdown`, `.txt` — defined in `SUPPORTED_EXTENSIONS` in `main.js`

### Third-Party Libraries (bundled from node_modules)

- **CodeMirror 5** — editor for Mermaid, LaTeX, and Markdown editor modes
- **Mermaid 11** — diagram rendering in preview pane
- **KaTeX** — LaTeX math rendering
- **marked 16** — Markdown→HTML conversion in reader and editor modes
