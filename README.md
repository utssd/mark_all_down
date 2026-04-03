# MarkAllDown

A desktop Markdown reader and editor with Mermaid diagram support, LaTeX equation rendering, Jekyll/GitHub Pages site preview, and SSH-based file sync.

Built with Electron.

---

## Features

- **Reader mode** — rendered Markdown with syntax highlighting via `marked`; optionally strips YAML/TOML front matter (for Jekyll, Hugo, Zola files)
- **Editor mode** — CodeMirror-based Markdown editor with live preview
- **Mermaid mode** — diagram editor with live Mermaid 11 rendering
- **LaTeX mode** — equation editor with KaTeX rendering
- **Pages mode** — general Markdown folder browser with auto-generated card index, collapsible file-tree sidebar, and optional Jekyll/Hugo/Zola layout support
- **Smart save dialogs** — Save As prefills the original filename for opened files (local or SSH); new files default to `YYYY-MM-DD-untitled.md`
- **SSH sync** — save files directly to a remote server over SFTP
- **Open from SSH** — browse and open `.md`/`.txt` files from a remote folder

---

## Getting Started

```bash
npm install
npm start          # launch Electron app
python3 serve.py   # browser-based preview at http://localhost:8081
```

---

## Build

```bash
npm run build          # Linux AppImage
npm run build:linux    # Linux AppImage + tar.gz
npm run build:deb      # Linux .deb
npm run build:mac      # macOS dmg + zip
npm run build:all      # all platforms
npm run release        # full cross-platform release via release.sh

# Install locally after building
npm run install:linux
```

---

## Architecture

The app follows the standard Electron three-layer model with strict context isolation:

```
┌─────────────────────────────────────────┐
│  Renderer (app.js)                      │
│  All UI: modes, editors, modals         │
│  Communicates only via window.electronAPI│
└──────────────┬──────────────────────────┘
               │ contextBridge (preload.js)
┌──────────────▼──────────────────────────┐
│  Main process (main.js)                 │
│  File I/O, SSH/SFTP, IPC handlers       │
└─────────────────────────────────────────┘
```

**`main.js`** — Electron main process. Handles all native operations: file dialogs, SSH connections (via `ssh2`), settings persistence, and IPC routing.

**`preload.js`** — Security boundary. Exposes a typed `window.electronAPI` object via `contextBridge`. The renderer has no direct Node.js access.

**`app.js`** — Renderer process. All UI logic: mode switching, editor instances, rendering, modals, and settings. Lazy-loads Mermaid (71 MB) and KaTeX (4.6 MB) on first switch to their respective modes.

**`index.html`** — Static shell with five mode views (`reader`, `mermaid`, `latex`, `md-editor`, `pages`) toggled by `app.js`.

### IPC Channels

| Direction       | Channel               | Purpose                                                                  |
| --------------- | --------------------- | ------------------------------------------------------------------------ |
| Main → Renderer | `file:opened`         | File content after open                                                  |
| Main → Renderer | `menu:openFile`       | File menu trigger                                                        |
| Main → Renderer | `menu:saveFile`       | Save menu trigger                                                        |
| Main → Renderer | `menu:openFromSsh`    | SSH open menu trigger                                                    |
| Main → Renderer | `menu:find`           | Find bar trigger                                                         |
| Renderer → Main | `dialog:openFile`     | Native open dialog                                                       |
| Renderer → Main | `dialog:saveFile`     | Native save dialog                                                       |
| Renderer → Main | `dialog:saveHtml`     | Save rendered HTML                                                       |
| Renderer → Main | `settings:load/save`  | Settings persistence                                                     |
| Renderer → Main | `ssh:sync`            | Write file via SFTP                                                      |
| Renderer → Main | `ssh:testConnection`  | Test SSH connectivity                                                    |
| Renderer → Main | `ssh:copyKey`         | Install SSH public key                                                   |
| Renderer → Main | `remote:sshListFiles` | List remote files                                                        |
| Renderer → Main | `remote:sshReadFile`  | Read remote file                                                         |
| Renderer → Main | `pages:loadPage`      | Load and render a single Markdown page from the configured folder        |
| Renderer → Main | `pages:listFiles`     | Recursively list all Markdown files with metadata (title, date, excerpt) |

---

## Settings

Persisted to `<userData>/settings.json` (Electron's `app.getPath('userData')`).

```jsonc
{
  "sshHost": "192.168.1.100",
  "sshUser": "user",
  "sshPort": 22,
  "remotePath": "/home/user/documents",
  "sshKeyPath": "", // defaults to ~/.ssh/markalldown_rsa
  "pages": {
    "source": "local", // "local" | "ssh"
    "localPath": "/home/user/my-site",
    "remotePath": "/home/user/my-site", // uses SSH tab credentials
  },
  "general": {
    "stripFrontMatter": true, // strip YAML/TOML front matter before rendering
  },
}
```

SSH keys are auto-generated at `~/.ssh/markalldown_rsa` (RSA 4096) when you click **Setup SSH Key** in Settings.

---

## Pages Mode

The Pages tab is a general-purpose Markdown folder browser. Point it at any folder and it automatically scans the contents, builds a navigable index, and renders files on demand. No special folder structure required.

### Layout

A two-panel interface:

- **Sidebar** (left, collapsible) — file tree grouped by subfolder, with a live filter input. Toggle with the `≡` button in the toolbar.
- **Content pane** (right) — shows either the auto-generated card index or a rendered Markdown file.

### How it works

1. On first switch to Pages mode, `pages:listFiles` recursively walks the configured folder (depth ≤ 3), reads every `.md`/`.markdown`/`.txt` file, and extracts metadata:
   - **Title**: `title:` in front matter → first `#` heading → filename
   - **Date**: `date:` in front matter → file modification time (local only)
   - **Excerpt**: first non-heading paragraph line, up to 160 characters
2. The sidebar is populated with the file list, grouped by top-level subfolder.
3. If no `index.md` exists, a card grid index is shown — files sorted newest-first, then alphabetically.
4. Clicking a card or sidebar item loads the file via `pages:loadPage` and renders it with `marked`.
5. Internal links are intercepted and navigate in-place. Back / Forward / Refresh work across both the index and file views.

### Optional Jekyll/Hugo/Zola support

The following features are applied automatically when the folder structure supports them — no configuration required:

| Feature                                   | Supported           |
| ----------------------------------------- | ------------------- |
| YAML front matter (`---`)                 | Yes                 |
| `_layouts/` HTML templates                | Yes                 |
| `_includes/` partials                     | Yes                 |
| `_config.yml` site variables              | Yes                 |
| `{{ page.X }}` / `{{ site.X }}` variables | Yes                 |
| `{{ content }}` in layouts                | Yes                 |
| Mermaid diagrams in pages                 | Yes                 |
| Liquid tags beyond `include`              | No (passed through) |
| Jekyll collections / `site.posts`         | No                  |
| Sass / SCSS                               | No                  |

Files and folders starting with `_` or `.` are skipped during the scan.

### Configuration

Open **Settings → Pages**:

- **Source**: Local (a folder on disk) or SSH (uses the SSH connection from the SSH tab, but with a separate path).
- **Pages Folder**: Any directory containing Markdown files.

### SSH Pages

When source is set to SSH, the app opens a single SFTP connection, recursively walks the remote directory to collect file metadata, then loads individual pages on demand via separate SFTP reads. Layout and config files are cached in memory for the duration of the session; the cache is cleared when settings are saved.

---

## Mac Distribution

### Signing and Notarization

The build is configured for macOS code signing and notarization (`build.mac` in `package.json`). Unsigned `.app` bundles are quarantine-scanned by Gatekeeper on **every launch**, adding 5–30 seconds of invisible delay. Signing eliminates this completely.

To build a signed and notarized release:

```bash
export APPLE_ID="you@example.com"
export APPLE_TEAM_ID="XXXXXXXXXX"          # 10-char Team ID from developer.apple.com
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # from appleid.apple.com
npm run build:mac
```

To build locally without notarization (development only):

```bash
SKIP_NOTARIZE=1 npm run build:mac
```

The `afterSign` hook (`build/notarize.js`) skips automatically if any of the three env vars are missing, so CI environments without signing keys won't fail.

**Required entitlements** (`build/entitlements.mac.plist`):

- `cs.allow-jit` and `cs.allow-unsigned-executable-memory` — required by Electron's V8 JIT
- `network.client` — for SSH connections
- `files.user-selected.read-write` — for native file open/save dialogs

---

## SSH Key Setup

1. Open **Settings → SSH**, enter your host/user/password.
2. Click **Setup SSH Key** — the app generates an RSA 4096 key pair at `~/.ssh/markalldown_rsa` and installs the public key into `~/.ssh/authorized_keys` on the remote.
3. Subsequent SSH operations (sync, open from SSH) use key authentication automatically.
