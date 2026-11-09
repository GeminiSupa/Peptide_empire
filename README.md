# Peptides Costa Rica — start here

This one repo holds **two separate apps, one per branch**. Both are live
production sites.

| Branch | App | Vercel project | Live at |
| --- | --- | --- | --- |
| `main` (this page) | The catalog / shop back end: catalog, cart, checkout, payments, admin portal, CRM, WhatsApp bot, cron jobs, DB migrations | `peptidecosta` | `catalog.peptidescostarica.net` |
| [`website`](../../tree/website) | The main business site (new design, replaced WordPress on 9 Nov 2026) | `peptidecostarica-website` | `peptidescostarica.net` |

- **Pushing `main` deploys the catalog. Pushing `website` deploys
  `peptidescostarica.net`.** Both are production — get the owner's OK first.
- **Never merge `website` into `main` or the reverse.** They are different
  apps with different file layouts. Work on one branch at a time.
- Both apps use the **same Supabase database**. The website posts its orders
  to the catalog's `/api/orders/create`, and card/bank payments still finish
  on the catalog — so a change on `main` can break the website.
- **Every other branch** is an old feature or Codex branch. Nothing deploys
  them to production. Don't start new work from them unless told to.
- **Retired:** the separate GitHub repo `GeminiSupa/peptidecostarica-website`
  stopped on 18 Oct 2026. Nothing builds from it — don't use it.
- `new.peptidescostarica.net` is retired too; ignore it.

## Read before changing code

1. [`docs/workspace/workspace-AGENTS.md`](docs/workspace/workspace-AGENTS.md)
   — the goal, current status, how the two apps connect, env vars, open items.
2. `AGENTS.md` on the branch you work on — the detailed rules for that app
   ([catalog](AGENTS.md), [website](../../blob/website/AGENTS.md)).

Paths like `C:\Projects\...` or `C:\Users\Maaz\...` in those files are the
owner's local folders. On your machine, just check out the branch you need:

```bash
git clone https://github.com/GeminiSupa/peptidecosta.git
cd peptidecosta
git switch website   # or stay on main for the catalog
npm install
npm run dev
```

Env vars live in each Vercel project (Settings → Environment Variables).
Never commit an `.env` file.
