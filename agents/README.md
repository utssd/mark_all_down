# Writing a MAD agent

An **agent** is a self-contained folder under `agents/` that MarkAllDown
discovers at startup. Drop a folder in, it appears in the Agents sidebar.
Remove the folder, it disappears. No config file edits, no build flags.

The design mirrors the [Agent Skills](https://agentskills.io) open standard
(the same pattern Claude Code's `SKILL.md` uses) so authors familiar with
agent skills should feel at home.

## Minimum viable agent — two files

```
agents/my-agent/
├── AGENT.md
└── worker.js
```

`AGENT.md` — YAML frontmatter declares what the agent is, free markdown
below is user-facing documentation:

```markdown
---
name: my-agent
title: My Agent
description: One-line summary shown in the sidebar.
execution: local
entry:
  worker: worker.js
capabilities:
  webdav: read
requires:
  llm: { provider: openai }
  webdav: true
params:
  - { name: dryRun, type: checkbox, label: Dry run, default: true }
---

# My Agent
Body is rendered as markdown inside the agent panel — free documentation.
```

`worker.js` — exports a `run` function that receives params, sends progress,
and returns a result:

```js
exports.run = async ({ params, sendProgress, helpers }) => {
  sendProgress('Starting…', 'info');
  const files = await helpers.webdav.read('/notes/');
  sendProgress('Done', 'done');
  return { markdown: '# Results\n\n…' };
};
```

That's it. MAD auto-generates a params form, run/cancel buttons, progress
log, and output pane.

## Discovery rules

- Folder name must **not** start with `_` (framework) or `.` (hidden).
- Folder must contain an `AGENT.md` with valid frontmatter.
- `name:` in the frontmatter is the agent's runtime ID.
- Any referenced file (`entry.worker`, `entry.ui.html`, …) must exist.

## `AGENT.md` frontmatter fields

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Lowercase slug. Used as agent ID. |
| `title` | no | Display name. Falls back to titlecased `name`. |
| `description` | yes | Shown in sidebar. Keep under ~200 chars. |
| `version` | no | Semver. |
| `execution` | no | `local` (default) / `cloud` / `hybrid`. |
| `entry.worker` | iff local/hybrid | Path to worker module, relative to folder. |
| `entry.ui.{html,css,js}` | no | Any/all may be omitted — shell renders a default UI. |
| `capabilities.webdav` | no | `"read"` / `"write"`. Gates `helpers.webdav.*`. |
| `capabilities.messaging` | no | If `true`, renderer shows a mid-run input box. |
| `requires.llm.provider` | no | Validator enforces matching provider in settings. |
| `requires.webdav` | no | Validator enforces WebDAV configured. |
| `cloud.{run,message,cancel}` | iff cloud/hybrid | Declarative HTTP routes. `{sessionId}` templating supported. |
| `cloud.adapter` | no | Path to a bespoke adapter if declarative routes aren't enough. |
| `params` | no | Param descriptors for the auto-generated form. |

## UI templating tiers

Progressive disclosure — three levels:

**Tier 0 — declarative (2 files, no UI code).** Declare `params` in the
manifest; shell renders a generic form + progress log + output pane. Good
for quick user-authored agents. See the throwaway scratch agent under
"Testing while you iterate" below for a minimal example.

**Tier 1 — custom output (3 files).** Add `ui.js` exporting
`renderOutput(host, data)`. Shell still owns the params form and progress
log; your code owns the output pane. Good for tables, charts, or
interactive output.

**Tier 2 — full control (4+ files).** Add `ui.html`, `ui.css`, and expand
`ui.js` to export `mount({host, api}) / unmount()`. Shell steps out of the
way. Required for bespoke experiences like MindMap's D3 visualization.

## Output rendering (Tier 0 / Tier 1 default)

The shell renders the value returned by `worker.run(...)` by shape, using
MAD's built-in `marked` + KaTeX + syntax-highlighter pipeline. Agents get
rich rendering for free — this is not a terminal dump.

| Return shape | Rendered as |
|---|---|
| `{ markdown: "…" }` | Full markdown: headings, lists, tables, code, math, Mermaid |
| `{ html: "…" }` | Sanitized HTML (no scripts) |
| `{ json: … }` or any plain object | Collapsible key/value tree |
| `{ text: "…" }` or plain string | Monospace `<pre>` block |
| `undefined` | Output pane stays empty; only the progress log is shown |

`sendProgress(message, level)` levels — `info` / `warn` / `error` / `done`
— drive row color in the progress log.

## Helpers available to `run()`

The shell passes a context object to `run()`:

```ts
run({
  runId: string,
  agentId: string,
  params: { [key: string]: any },
  signal: AbortSignal,
  sendProgress: (message: string, level?: 'info'|'warn'|'error'|'done') => void,
  helpers: {
    // Present only if capabilities.webdav is set
    webdav?: {
      read:   (filePath: string) => Promise<string>,
      write:  (filePath: string, content: string, dirPath?: string) => Promise<void>,
      exists: (filePath: string) => Promise<boolean>,
    },
    // Present if the agent has any UI capability — opens the file in the main viewer
    openWebdavFile?: (filePath: string) => Promise<void>,
  },
})
```

## Execution modes

- **`local`** — runs in MAD's forked worker process. Bundled `worker.js`
  does the work.
- **`cloud`** — UI-only subtab. No local `worker.js`. `_cloud/client.js`
  reads `cloud.*` routes from the manifest and drives HTTP/SSE.
- **`hybrid`** — both. User toggles in the agent UI (if a cloud URL is
  configured).

## Testing while you iterate

MAD watches `agents/` — **folder add/remove and `AGENT.md` edits update the
sidebar immediately**. Code changes in `worker.js` / `ui.js` still require
an app restart.

Drop a throwaway folder to try:

```bash
mkdir -p agents/test-agent
cat > agents/test-agent/AGENT.md <<'EOF'
---
name: test-agent
title: Test Agent
description: Scratch agent for iteration.
execution: local
entry: { worker: worker.js }
---
EOF
cat > agents/test-agent/worker.js <<'EOF'
exports.run = async ({ sendProgress }) => {
  sendProgress('Hello from test-agent', 'done');
  return { markdown: '# It works!' };
};
EOF
```

## Framework folders (ignored by the scanner)

- `_runtime/` — AgentManager, loader, worker dispatcher, UI host.
- `_cloud/` — generic HTTP/SSE driver for `cloud` and `hybrid` agents.

## Shipped examples

- `mindmap/` — Tier-2 multimodal vault explorer (local).
- `llm-wiki/` — Tier-2 Karpathy-style personal wiki builder (ingest/query/lint).
- `on-this-day/` — Tier-0 resurfacer: picks one past note from configurable lookback windows and opens it in Pages.
- `tension-finder/` — Tier-0 reflection: names one unresolved tension across your last 7 days of writing, with verbatim quotes.
