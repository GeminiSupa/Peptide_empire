# Peptides Costa Rica — website + catalog

Open **this** folder in your editor or agent. Both projects live inside it.

| Folder | What it is | Live at |
|---|---|---|
| `peptidecosta-website` | **The main business site** (new design, its own cart). Replaced WordPress on 9 Nov 2026 | peptidescostarica.net (also www. and new.) |
| `peptidecosta` | The shop app: checkout, payments, orders, admin portal, CRM, WhatsApp bot, scheduled jobs | catalog.peptidescostarica.net |

Both are live production sites and both stay running: customers still reach
the catalog directly, and the main site still sends its orders and payments
through the catalog until its own copy of checkout is switched on.

## One repo, two Vercel projects

Both folders are the **same GitHub repo** (`GeminiSupa/peptidecosta`), just two
different branches checked out side by side:

- `peptidecosta` is on `main` → Vercel project `peptidecosta`
- `peptidecosta-website` is on `website` → Vercel project `peptidecostarica-website`

Pushing a branch deploys its site. Projects are free on Vercel — the bill is
per team member and per usage, not per project.

## Which folder do I work in?

- Prices, checkout logic, orders, admin, CRM, WhatsApp bot, cron jobs, database
  migrations → **`peptidecosta`**
- Anything customers see on peptidescostarica.net: pages, design, the cart,
  SEO, tracking → **`peptidecosta-website`**

Never edit one from inside the other. They are different applications.

## Agent context lives in AGENTS.md

`AGENTS.md` is the single source of truth: the goal, current status, how the
two sites connect, environment variables and the open-items list. `CLAUDE.md`
just imports it, so Claude and Codex read the same file. Each project folder
also has its own `AGENTS.md` with the detailed rules for that codebase — read
those too.
