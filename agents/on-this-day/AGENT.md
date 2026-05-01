---
name: on-this-day
title: On This Day
description: Surface one note from your past worth revisiting today.
version: 1.0.0
execution: local
entry:
  worker: worker.js
capabilities:
  webdav: read
  pages: navigate
requires:
  webdav: true
  llm: true
params:
  - { name: scanRoot,          type: text,   label: Scan root,           default: "/" }
  - { name: lookbacks,         type: text,   label: Lookback windows,    default: "1y,6mo,3mo,1mo,1w" }
  - { name: fuzzDays,          type: number, label: Fuzz window (days),  default: 3 }
  - { name: reflectionsFolder, type: text,   label: Reflections folder,  default: "reflections/" }
---

# On This Day

Surfaces one note from your past worth revisiting today. The agent walks
your WebDAV vault, finds files anchored to a past date (via filename
pattern `YYYY-MM-DD` or front-matter `date:` / `created:`), checks each
lookback window (1 year / 6 months / 3 months / 1 month / 1 week ago by
default), and asks the LLM to pick the single most interesting candidate.
The chosen note opens in Pages; a short reflection renders in the output
pane with an optional "save as reflection" button.

No cross-run memory — every run is fresh.

**Date anchoring** — files match if their name starts with `YYYY-MM-DD`,
their path contains a `YYYY/MM/DD/` or `YYYY-MM-DD/` segment, or their
YAML front-matter has a parseable `date:` or `created:` field. WebDAV
mtime is **not** used as a fallback (edit time ≠ authored-on date).
