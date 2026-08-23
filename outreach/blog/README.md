# NSLab logbook — the blog

A zero-dependency static site generator and the posts it builds. Same ethos as the tool: no framework, no CDN,
no network, opens from `file://`. About 700 lines of Node in total.

```bash
cd "outreach/blog"
node figures.js          # regenerate the charts from research/nslab/  (prints the numbers table)
node build.js            # build site/  (posts, pages, index, RSS, single-file edition)
```

Run `figures.js` first whenever a run has finished or advanced — it reads the archive, so the charts and the
tables in the posts always come from the same files as the research report.

## Layout

```
outreach/blog/
├── archive.js        reads research/nslab/<run>/final.json | partial.json — the one source of numbers
├── figures.js        writes assets/figures/*.svg from the archive; --check prints the table without writing
├── build.js          markdown → site/ ; also emits the single-file edition
├── theme.css         the whole stylesheet, inlined into every page at build time
├── posts/*.md        one file per post, newest wins by `order:`
├── pages/about.md    standalone pages
├── assets/figures/   generated SVG charts (do not hand-edit)
├── assets/img/       optional raster images; research/nslab/*.png is also searched
└── site/             build output — this is what you deploy
```

## Writing a post

Front matter, then markdown:

```markdown
---
title: "NS-004: something specific"
slug: ns-004-something-specific
date: 2026-09-01
study: NS-004 · what it is
order: 60
tag: resolution study
live: true
dek: One or two sentences that state the result, not the topic.
---
```

`order:` controls the position on the index (highest first); `live: true` adds the running-experiment marker.

Markdown supported: headings, paragraphs, lists, blockquotes, fenced code, tables (escape pipes inside cells as
`max\|ω\|`), links, `**bold**`, `*italic*`, `` `code` ``, `---`. Underscores are *not* italics, so `ε_max` and
`Re_Γ` are safe to type.

Block directives — each opens with `::: kind key=value` and closes with a bare `:::`, and they do **not** nest:

| Directive | Effect |
|---|---|
| `::: figure src=ns002-ommax` | inlines `assets/figures/ns002-ommax.svg`; the body becomes the caption. Inline, so the chart follows the light/dark theme |
| `::: image src=slices.png alt=…` | a raster figure; the file is found in `assets/img/` or `research/nslab/` and copied into the site |
| `::: note` / `::: warn` / `::: caveat` | callouts; `title=` overrides the default heading |
| `::: ladder study=ns-002` | the refinement-ladder table, generated from the archive at build time |
| `::: status study=ns-003` | one line per level of a study, live at build time |

The last two are why a post about a run in progress does not go stale: rebuild and the numbers move. A level
that has not yet integrated past the event (`tEvent` in `archive.js`) is shown as started and excluded from
every peak, integral and level-to-level comparison — a partial peak is a lower bound, not a measurement.

## Adding a study

Add it to `STUDIES` in `archive.js` (id, title, `tEnd`, `tEvent`, and the run folders per level), then to the
`studies` list in `figures.js` if it should appear in the scaling charts, and write the post. Everything else
follows.

## Deploying

`site/` is plain static files with relative links; it works from a disk, a memory stick or any host.

- **Cloudflare Pages** — `dash.cloudflare.com` → Workers & Pages → Create → Pages → *Upload assets* → drag the
  `site` folder. Free, instant, gives `<project>.pages.dev`, and a custom domain is two clicks.
- **Netlify Drop** — `app.netlify.com/drop`, drag `site`. Fastest possible route to a link.
- **GitHub Pages** — needs a repository: commit `site/` (or the whole `outreach/blog`) and enable Pages on the
  branch and folder.

Set the canonical URL before deploying so the RSS feed and `<link rel="canonical">` are right:

```bash
NSLAB_BLOG_URL=https://your-domain.example node build.js
```

`site/nslab-logbook.html` is the whole logbook as one self-contained file — every chart inline, every image
embedded, cross-references as anchors. Hand it to someone directly; it needs no server.

## House rules for the prose

The same three that govern the research: never claim a proof; judge vorticity growth on the Beale–Kato–Majda
integral across a ladder, never on a peak; do not write a conclusion the health report or the ladder did not
support. Every number in a post should be traceable to a file in `research/nslab/` — if it is not in the
archive, it does not go in a post.
