# LLM Wiki — Schema and Conventions

> This file is the wiki's contract. You (the LLM) and the human co-own it.
> On the first ingest into an empty `wikiRoot`, the agent writes a copy
> into `<wikiRoot>/README.md`. From then on, the WebDAV copy wins — the
> human can edit it to change conventions for their wiki, and your
> subsequent runs must honor whatever they put there.

## Three layers

- **`raw/`** — immutable source material. You read from it; you never
  modify it. Filenames are `<YYYY-MM-DD>-<slug>.md`.
- **`pages/`** — LLM-maintained markdown pages. You own this layer.
- **`index.md` + `log.md`** — catalog + history. You maintain both on
  every ingest and lint.

## Page categories under `pages/`

| Subdir | What belongs here | Title convention |
|---|---|---|
| `entities/` | People, organizations, products, named things | Proper name: `google-brain.md`, `anthropic.md` |
| `concepts/` | Abstract ideas, techniques, algorithms, theories | Concept noun: `self-attention.md`, `vector-quantization.md` |
| `sources/` | One page per raw source — a summary + key takeaways | Matches the raw filename sans date: `attention-is-all-you-need.md` |
| `answers/` | Filed-back answers from the Query op | `<YYYY-MM-DD>-<slug>.md` |

Page slugs are lowercase kebab-case, stable over time. If you want to
rename a page, use `edit_page` on every inbound link before deleting the
old path.

## Page shape

Every wiki page (not raw, not log) has this frontmatter:

```yaml
---
title: Self-Attention
kind: concept          # entity | concept | source | answer
sources:               # raw file paths that contributed to this page
  - raw/2026-04-26-attention-is-all-you-need.md
updated: 2026-04-27
---
```

Body starts with a one-paragraph summary (the **lede**), then whatever
structure fits. Prefer short sections over long walls of text. Use
Markdown tables for comparisons. Use mermaid code blocks for diagrams.

## Cross-references

Link to other pages using relative markdown links:
`[self-attention](../concepts/self-attention.md)`. Link to raw sources the
same way: `[original paper](../../raw/2026-04-26-attention-is-all-you-need.md)`.
Use citations (footnote-style `[^1]` with a reference at the bottom of the
page) when you quote or paraphrase a specific claim from a source.

## `index.md`

Top-level catalog. Organized by kind, then alphabetically. Each entry is
one line with a link and a one-line summary. The agent regenerates or
patches this file on every ingest.

```markdown
# Wiki Index

## Concepts
- [self-attention](pages/concepts/self-attention.md) — how tokens attend
  to each other inside a transformer.

## Entities
- [google-brain](pages/entities/google-brain.md) — former Google research
  team behind the original transformer paper.

## Sources
- [attention-is-all-you-need](pages/sources/attention-is-all-you-need.md)
  — Vaswani et al. 2017, introduces the transformer.

## Answers
- [2026-04-27-what-is-multi-head-attention](pages/answers/2026-04-27-what-is-multi-head-attention.md)
```

## `log.md`

Append-only. Each line is a single log entry with this prefix:

```
## [2026-04-27] ingest | Attention Is All You Need (8 pages touched)
## [2026-04-27] query  | "what is multi-head attention?"
## [2026-04-27] lint   | 3 issues found, 2 auto-fixed
```

## Rules of the loop

1. `raw/` is read-only. Writing under `raw/` is rejected by the tool.
2. Every write stays under `wikiRoot`. `..` is rejected.
3. When ingesting, update entity and concept pages — don't just write a
   standalone source page. The wiki's value comes from cross-linking.
4. When you find a contradiction between a new source and an existing
   page, do not silently overwrite. Note both positions with citations
   and flag the contradiction in `log.md`.
5. Always call `append_log` and (when structure changed) `update_index`
   before calling `done`.
6. Keep each page under ~500 lines. Split into sub-pages when they grow
   past that.
