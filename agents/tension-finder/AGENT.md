---
name: tension-finder
title: Tension Finder
description: Name one unresolved tension in your recent thinking.
version: 1.0.0
execution: local
entry:
  worker: worker.js
capabilities:
  webdav: read
requires:
  webdav: true
  llm: true
params:
  - { name: scanRoot,          type: text,   label: Scan root,           default: "/" }
  - { name: days,              type: number, label: Recency (days),      default: 7 }
  - { name: maxFiles,          type: number, label: Max files,           default: 10 }
  - { name: reflectionsFolder, type: text,   label: Reflections folder,  default: "reflections/" }
---

# Tension Finder

Reads the N most-recently-modified notes in your vault and asks the LLM
to name **one** unresolved tension, contradiction, or question you keep
circling without answering. Output is specific — it quotes the notes and
cites their paths. The save button writes the result to
`reflections/YYYY-MM-DD-tension.md` for later review.

This is not a summarizer or a dashboard. One tension, stated directly,
with real citations.

**Prompt constraints** — the LLM is instructed to avoid cheerleading,
motivational language, and generic "reflect on this" closings. If the
output is still sycophantic, tighten `agents/tension-finder/prompts/tension-finder.md`.
