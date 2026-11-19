# Maintain the directory

Use the contribution templates for new organisations, contact corrections and ended programmes. The maintainer reviews the evidence, edits a branch, checks the preview and merges the approved change. Browse and downloads are public. People can submit a correction without having write access to the records.

## Add or correct a record

1. Search existing IDs and names first. Keep a stable profile ID. Add alternate names as aliases. Add a branch or a programme under the parent organisation unless the evidence identifies a distinct organisation.
2. Copy the structure in `inputs/organisation-example.json`. For a new record use `publication_status: "draft"` while researching. Make each operation's region and sector specific to the work the source describes. List an office under offices even if it is in a different region. Use `nationwide` only with explicit evidence, a source whose supports array includes `"nationwide operation"` and empty region IDs. For unknown work geography use `unknown` and empty region IDs.
3. Separate ended, active, uncertain and planned operations. If a source gives only a year or month, use a null exact date and record its precision in the notes. Give both contact and activity checks a web review date and leave direct confirmation null until a professional contact or other direct check verifies it. Flag inconsistent numbers and roles. Preserve the scope of referrals and publish only public professional methods. Treat notes in listed JSON files as public text.
4. Add source references to the operation, office, contact and method as applicable. Each new listed organisation needs public contact information or a usable address, plus sourced local activity. Review published fields, set the record to `listed` and update `docs/coverage.csv` where appropriate. A record that must be removed from public output can be marked `withdrawn`. The build excludes it from pages, index, CSV and sitemap.
5. Run `npm run validate`, `npm test`, `npm run build` and `npm run test:browser`. Open the Cloudflare branch preview, review relevant filters and confirm changed contact links and the exported row. Merge once checks and review pass.

## Review and succession

Run `npm run review-due` when reviewing corrections. Aim for quarterly review of reports and an annual regional pass. Direct confirmations older than 180 days and web reviews older than 365 days remain visible with their dates. Prioritise stale numbers and uncertain activity. Update review dates only when the underlying evidence is checked.

For national research, complete a source pass in every region for agriculture, education and health. Record dates, sources and gaps in `coverage.csv`. Count organisations once per region, and count national organisations separately across the collection. Require at least two supported NGO or nonprofit listings in each region for the national milestone. A completed search with no suitable source should remain visible as a gap.

Before handover, give the successor access to the GitHub repository, Cloudflare account/project, public contribution inbox and domain renewal account through the providers' access controls. Record primary and backup maintainers, billing and renewal ownership, production settings and the last tested rollback in the deployment notes. Verify that the successor can edit a record and inspect a preview before relying on the transfer.
