# Madagascar NGO directory

A small static directory for volunteers in Madagascar. Search by organisation name and filter by where an organisation works and what it does there. Profiles carry the underlying sources, contact scope and verification dates. Initial data comes from the Analanjirofo registry and adjacent regions.

## Run locally

Use Node 24.22.1, pinned in `.node-version`. The separately saved handoff archive includes a built `dist/` directory. A fresh GitHub checkout needs `npm ci` and `npm run build` first. Open [the local preview](http://127.0.0.1:4173/) after starting it. Set `PORT` to use another port.

To regenerate or edit the site:

```sh
npm ci
npm run validate
npm test
npm run build
npm run preview
```

Run `npm run review-due` to list published entries with overdue web reviews or aging direct confirmations. Run `npx playwright install chromium` and `npm run test:browser` to exercise the rebuilt output. Where Chromium is already installed, set `CHROMIUM_PATH` to its executable. The browser test starts and stops its own local server.

## Project files

- `data/organisations/` has one JSON file per organisation. Operations define work locations and sectors. Offices and contact routes have their own scope.
- `data/regions.json` and `data/sectors.json` define the filter choices.
- `src/` contains browser modules, shared rendering and styles. `scripts/build.mjs` generates static pages, the public search index, and the full CSV.
- `inputs/organisation-example.json` is the schema example. The saved handoff archive retains the original workbook, raw extraction, SOW and draft records. The [import report](docs/IMPORT_REPORT.md) reconciles all 28 source rows.
- `site.config.json` sets the public HTTPS origin and contribution channel.
- `docs/` contains the [import report](docs/IMPORT_REPORT.md), [coverage tracker](docs/coverage.csv), [maintainer guide](docs/MAINTAINER_GUIDE.md), [deployment instructions](docs/DEPLOYMENT.md) and [verification notes](docs/STATUS.md).

GitHub and Cloudflare Pages are the intended deployment route. Keep generated `dist/` and installed `node_modules/` out of Git. The source repository is public. Treat tracked records and notes as public material. Original research inputs and the two held draft records are retained in the saved handoff archive.
