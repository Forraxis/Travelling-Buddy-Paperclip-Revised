# Topic Guide Authoring

This directory contains the markdown source files for TowingBuddy's topic guide pages
(URL: `/guides/{slug}/`). No engineering help is needed to add or update guides.

---

## Creating a New Guide

1. Create a new `.md` file in this directory, e.g. `my-new-guide.md`
2. Add the required frontmatter block at the top (see schema below)
3. Write the body content in standard Markdown
4. Commit and push — the guide goes live on the next deploy

---

## Frontmatter Schema

Every guide **must** start with a YAML frontmatter block between `---` delimiters:

```yaml
---
title: "Your Guide Title"
slug: "your-guide-slug"
description: "One or two sentences. Used in meta tags and the guide header."
category: regulatory   # see categories below
tags:
  - gvm
  - towing
last_updated: "2025-05-14"   # ISO date YYYY-MM-DD
regulatory_references:       # optional — leave as [] if none
  - "ADR 43/04 — Vehicle Mass and Dimensions"
---
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Page title. Shown in the H1 and `<title>` tag. |
| `slug` | Yes | URL path segment. Must match the filename (without `.md`). Kebab-case. |
| `description` | Yes | Meta description. 120–160 characters ideal. |
| `category` | Yes | One of: `regulatory`, `state-guidance`, `accessory-category`, `decision` |
| `tags` | Yes | Array of lowercase kebab-case strings. Used for related-links sidebar. |
| `last_updated` | Yes | ISO 8601 date (`YYYY-MM-DD`). Shown in the byline and Article JSON-LD. |
| `regulatory_references` | No | List of regulatory standards referenced. Shown in a footer section. |

### Categories

| Category | Use for |
|----------|---------|
| `regulatory` | ADR/NHVR/road-rules explanations (GVM, ATM, towing capacity, CoR) |
| `state-guidance` | State-specific rules (e.g. SA rear-overhang rules, Vic permit thresholds) |
| `accessory-category` | Guides about accessory types (bull bars, weight distribution hitches, etc.) |
| `decision` | Buying/choosing guides (e.g. "how to pick your first caravan") |

---

## Body Content

Write standard Markdown. A few custom components are available for special blocks:

### Callout

```mdx
<Callout type="warning">
Watch out: this is a common mistake that catches many tow vehicle owners.
</Callout>
```

Types: `info` (blue), `warning` (amber), `danger` (red).

### DisclaimerBox

```mdx
<DisclaimerBox>
This guide is for informational purposes only. Always seek advice from a licensed specialist.
</DisclaimerBox>
```

Use `DisclaimerBox` at the end of any guide that touches legal limits, insurance, or engineering.

---

## Style Guide

- **Audience:** Australian caravan and 4WD owners, not engineers. Plain English.
- **Length:** 400–1,500 words per guide. Quality over length.
- **Tone:** Authoritative but friendly. No jargon without explanation.
- **Tables:** Use Markdown tables for comparison content — they render well.
- **Links:** Link to related guides using `/guides/{slug}/` and to tools using paths like `/calculator`, `/caravans`, etc.
- **Dates:** Use `last_updated` whenever you edit a guide.

---

## File Naming

Use the slug from the frontmatter as the filename:

```
slug: "gvm-explained"  →  gvm-explained.md
```

Slugs must be lowercase, hyphen-separated, and unique.

---

## State Guidance

State-specific content lives in `src/content/state-guidance/` (not this directory).
See that directory's README for the schema.

---

## Questions?

For technical issues (build failures, MDX errors), file a dev ticket.
For content questions (what to cover, SEO priorities), ask Tim or the content team.
