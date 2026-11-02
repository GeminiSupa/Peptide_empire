# Peptides Costa Rica — website + catalog

Open **this** folder in your editor or agent. Both projects live inside it.

| Folder | What it is | Live at |
|---|---|---|
| `peptidecosta` | The shop: catalog, cart, checkout, orders, admin portal, CRM | catalog.peptidescostarica.net |
| `peptidecosta-website` | The marketing site that will replace WordPress | not live yet — preview only |

## One repo, two Vercel projects

Both folders are the **same GitHub repo** (`GeminiSupa/peptidecosta`), just two
different branches checked out side by side:

- `peptidecosta` is on `main`
- `peptidecosta-website` is on `website`

They deploy as two separate Vercel projects because they are two separate
websites. Projects are free on Vercel — the bill is per team member and per
usage, not per project.

## Which folder do I work in?

- Shop, prices, cart, checkout, orders, admin, CRM, deals → **`peptidecosta`**
- Public marketing pages, the WordPress replacement → **`peptidecosta-website`**

Never edit one from inside the other. They are different applications.

## The WordPress site is still live

`peptidescostarica.net` is still served by WordPress (157.245.213.33), not
Vercel. The clone sits on a private Vercel preview URL with search-engine
indexing switched off. Going live is a DNS change, done deliberately, and it is
reversible by pointing the domain back.

## Agent context lives in AGENTS.md

`AGENTS.md` is the single source of truth. `CLAUDE.md` just imports it, so
Claude and Codex read the same file. Each project folder also has its own
`AGENTS.md` with the detailed rules for that codebase — read those too.
