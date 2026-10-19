# Marketing website launch

The marketing clone is on `clone-website`. The catalog admin editor is on
`codex/website-admin` in the same repository. These are separate deployments:
`peptidescostarica.net` serves the clone, while
`catalog.peptidescostarica.net` keeps the existing catalog and checkout.

## Required setup

The Supabase migration and import were completed on 2026-10-19. Verification
found 510 published documents and 510 private drafts. Steps 1–2 below are
retained for a new environment or recovery; steps 3–5 are still needed for the
production cutover.

1. In the existing Supabase project's SQL Editor, run
   `add-marketing-site-cms.sql` from `codex/website-admin`. It creates only
   `site_cms_documents` and the `site-content` image bucket. It does not change
   the catalog's `site_settings` table.
2. Use the existing `C:\Projects\peptidecosta\.env.local` to seed content.
   Its Supabase secret works when loaded by Node. From this branch's checkout, run
   `node scripts/seed-site-cms.mjs` to preview the count, then
   `node --env-file="C:\Projects\peptidecosta\.env.local" scripts/seed-site-cms.mjs --write`
   after the SQL is applied. The importer creates draft and published
   copies without overwriting edits if rerun. Never commit the key.
3. Deploy `codex/website-admin` to the catalog project. Merge it into the
   catalog's deployment branch using the normal review path; do not merge
   `clone-website` into catalog `main` because its history and application are
   intentionally separate.
4. Connect the marketing Vercel project `peptidecostarica-website` to this
   repository's `clone-website` branch and deploy a preview. Set
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the same
   public project values used by the catalog. Keep `NEXT_PUBLIC_IMAGE_BASE`
   empty so mirrored assets load locally. The clone does not need a service key.
5. On the preview, check English and Spanish home/product pages, a changed
   heading and uploaded image published from the catalog admin, a live product
   price and stock change, and the outbound catalog link. Then assign the
   marketing domain to the preview deployment. The catalog domain stays on its
   current project.

The catalog owns product prices, stock, orders, checkout and payment providers.
The clone reads its public product feed every 60 seconds and published website
copy every 30 seconds. Unmatched or unavailable products do not show an old
WordPress price. Marketing content falls back to the cloned content if the CMS
is temporarily unavailable.
