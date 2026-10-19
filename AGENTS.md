# Clone website branch

This branch contains the marketing website for `peptidescostarica.net`.
The `main` branch of this repository contains the separate live catalog
application for `catalog.peptidescostarica.net`.

- Keep the marketing site and catalog as separate deployments. Do not bring
  catalog admin, cart, checkout, payment, cron, or environment files here.
- Read `README.md` and the relevant guide under `node_modules/next/dist/docs/`
  before changing Next.js code. This installed Next.js version differs from
  older conventions.
- Preserve the marketing site's existing URL paths, trailing slashes, and
  Spanish `/es/` routes. Keep shop actions linked to the catalog.
- Treat changes on `main` and `clone-website` as independent. Do not merge
  either branch into the other unless the owner explicitly requests it.
- Before committing in this repository, use Git author
  `GeminiSupa <pgemini6780@gmail.com>` and retain the
  `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
