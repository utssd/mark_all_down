---
name: llm-wiki
title: LLM Wiki
description: Build and maintain a Karpathy-style LLM Wiki on your WebDAV vault. Ingest sources, query the wiki, lint for health.
version: 0.1.0
execution: local
entry:
  worker: worker.js
  ui:
    html: ui.html
    css:  ui.css
    js:   ui.js
capabilities:
  webdav: write
  pages: navigate
requires:
  llm:
    provider: openai
  webdav: true
params:
  - { name: wikiRoot,    type: text,     label: Wiki root (WebDAV path), default: "/wiki/" }
  - { name: maxRounds,   type: number,   label: Max tool-call rounds,    default: 40 }
  - { name: fileAnswers, type: checkbox, label: File Query answers back as wiki pages, default: false }
---

# LLM Wiki

Incrementally build a personal wiki on your WebDAV vault, in the
[LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
popularized by Andrej Karpathy.

## Three operations

- **Ingest** — point it at a source (the file open in Pages, a URL, or a
  WebDAV path) and it copies the source into `raw/`, reads it, writes a
  summary page, updates entity/concept pages, refreshes `index.md`, and
  appends to `log.md`.
- **Query** — ask a question against the wiki. It searches pages, reads
  the relevant ones, answers with citations. Optionally files the answer
  back as a new wiki page.
- **Lint** — health-check the wiki. Finds orphan pages, broken links,
  stale claims, and missing cross-references. Auto-fixes the safe ones.

## Wiki layout

```
<wikiRoot>/
├── raw/                immutable sources (LLM reads only)
├── pages/
│   ├── entities/       people, organizations, named things
│   ├── concepts/       abstract ideas, techniques
│   ├── sources/        one page per raw source
│   └── answers/        filed-back query answers
├── assets/             reserved for future image handling
├── README.md           the wiki's schema and conventions
├── index.md            global catalog (LLM-maintained)
└── log.md              append-only operation log
```

## Configuration

- **Provider.** Needs an OpenAI-compatible endpoint that supports
  function-calling (tool calls). Most OpenAI-compatible cloud providers
  work; some local llama.cpp setups don't.
- **WebDAV.** Your vault must be configured in Settings → General.
- **Model.** Larger-context models help — the agent loop reads multiple
  pages per ingest. Override the model per-agent in Settings → Agents →
  LLM Wiki if you want a different one from your global default.

## How long does it take

A typical ingest of a medium article touches 5–15 wiki pages and consumes
30–100K tokens across the tool-call loop. The progress log streams every
tool call so you can watch it think.

## Privacy

All LLM calls go through your configured provider. All reads/writes go
through your configured WebDAV server. No data leaves your device except
via those two endpoints.

## Status

v0.1 — Ingest/Query/Lint work against a configured wiki root. Batch
ingest, image handling, and an in-UI WebDAV path picker are not yet
implemented.

## Change Log

- **Address-card treatment for URL / WebDAV Path inputs.** Both fields
  now render as `.lw-addr-card` — a bordered card with a tiny uppercase
  over-label, a colored leading glyph (`↗` for URL, `↳` for WebDAV),
  and a borderless monospace input flush inside. On focus the card
  border and caret switch to the op's accent (`--lw-op`) with a soft
  halo. This makes the three source modes (Pages · URL · WebDAV)
  share a consistent visual language instead of the URL/WebDAV fields
  reading as raw form controls against the Pages hint card.
- **UI redesigned to conform to the app's templating system.** The
  "Editor's Study" custom fonts (Fraunces, IBM Plex Mono) and custom
  palette (gilt / vermilion / mint) are removed in favor of the app's
  shared CSS tokens — `--bg-*`, `--text-*`, `--accent`, `--success`,
  `--font-family`, `--font-mono`, `--radius`, `--transition`. Structural
  ideas that were working — numbered op tabs, source picker with
  CSS-only input-slot swap via `:has()`, per-panel marginalia hints —
  survive, re-expressed via the app's `.agents-param-*` shared classes.
  Each op gets a muted accent token scoped to `#agent-params-llm-wiki`:
  Ingest `--accent` (blue), Query amber `#d8a657`, Lint `--success`
  (green). Inline `<style>` block moved out into a separate `ui.css`
  referenced from the manifest. The output pane gains a compact result
  header card (op · rounds · pages touched) and a clickable chip grid
  of touched WebDAV pages, rendered by a new `ui.js` exporting
  `renderOutput(host, data)` — a Tier-2 opt-in convention extended from
  the existing Tier-1 pattern; the runtime falls back to the default
  markdown renderer when an agent does not export it. The class / ID /
  data-attribute contract with `app.js` is preserved verbatim.
- **Tier-2 UI (original "Editor's Study")**: custom editorial layout
  with Fraunces + IBM Plex Mono and a gilt/vermilion/mint palette.
  Replaced by the redesign above.
