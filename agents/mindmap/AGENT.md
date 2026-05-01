---
name: mindmap
title: Mind Map
description: Read your WebDAV folder recursively, understand mixed content with a multimodal OpenAI-compatible model, and write an iterative index page back to WebDAV.
version: 1.0.0
execution: local
entry:
  worker: worker.js
  ui:
    html: ui.html
    css: ui.css
capabilities:
  webdav: write
requires:
  llm:
    provider: openai
  webdav: true
---

# Mind Map

A personal-growth companion that reads your WebDAV content library and surfaces
patterns you might miss. It clusters related notes, draws connections, and
produces an iterative mind map you can revisit.

## What it does
Walks your WebDAV folder, uses a multimodal model to understand text + images,
and writes an iterative index page back to the same WebDAV location.

## Configuration
- Requires an OpenAI-compatible provider with vision support.
- WebDAV must be configured (Settings → General).

## Privacy
All LLM calls go through your configured provider. No data leaves your device
except via that provider and your own WebDAV server.
