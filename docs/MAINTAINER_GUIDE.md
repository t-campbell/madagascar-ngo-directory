# Maintain the directory

People can use the public contribution form for confirmations, new organisations, corrections and ended programmes. No account is required. The form adds suggestions to a private review queue and leaves publication to the maintainer. A public GitHub issue is also available.

## Review submissions

1. In Cloudflare, open [Durable Objects](https://dash.cloudflare.com/?to=/:account/workers/durable-objects), select the directory Worker's `SubmissionQueue` namespace and open **Data Studio**.
2. Enter the object name `directory-submissions`. Open `suggestions` in the table browser or run the query below. The table appears when the first suggestion is received.
3. Verify the organisation, activity and contact evidence before editing a profile. Treat URLs and messages as unverified until you check them. If you need more information on a GitHub issue, respond there.
4. Once handled, set `reviewed_at` to the current date and time for that row. Cloudflare Data Studio requires Editor access to the Worker. [Cloudflare Data Studio guide](https://developers.cloudflare.com/durable-objects/observability/data-studio/)

```sql
SELECT id, submitted_at, kind, organisation, locality, details, source
FROM suggestions
WHERE reviewed_at IS NULL
ORDER BY id;
```

For example, to close suggestion 42 after reviewing it:

```sql
UPDATE suggestions SET reviewed_at = CURRENT_TIMESTAMP WHERE id = 42;
```

## Add or correct a record

1. Search existing IDs and names first. Keep a stable profile ID. Add alternate names as aliases. Add a branch or a programme under the parent organisation unless the evidence identifies a distinct organisation.
2. Copy the structure in `inputs/organisation-example.json`. For a new record use `publication_status: "draft"` while researching. Make each operation's region and sector specific to the work the source describes. List an office under offices even if it is in a different region. Use `nationwide` only with explicit evidence, a source whose supports array includes `"nationwide operation"` and empty region IDs. For unknown work geography use `unknown` and empty region IDs.
3. Separate ended, active, uncertain and planned operations. If a source gives only a year or month, use a null exact date and record its precision in the notes. Give both contact and activity checks a web review date and leave direct confirmation null until a professional contact or other direct check verifies it. Flag inconsistent numbers and roles. Preserve the scope of referrals and publish only public professional methods. Treat notes in listed JSON files as public text.
4. Add source references to the operation, office, contact and method as applicable. Each new listed organisation needs public contact information or a usable address, plus sourced local activity. Review published fields, set the record to `listed` and update `docs/coverage.csv` where appropriate. A record that must be removed from public output can be marked `withdrawn`. The build excludes it from pages, index, CSV and sitemap.
5. Run `npm run validate`, `npm test`, `npm run build` and `npm run test:browser`. Open the Cloudflare branch preview, review relevant filters and confirm changed contact links and the exported row. Merge once checks and review pass.

## Review and succession

Run `npm run review-due` when reviewing corrections. Aim for quarterly review of reports and an annual regional pass. Direct confirmations older than 180 days and web reviews older than 365 days remain visible with their dates. Prioritise stale numbers and uncertain activity. Update review dates only when the underlying evidence is checked.

For national research, complete a source pass in every region for agriculture, education and health. Record dates, sources and gaps in `coverage.csv`. Count organisations once per region, and count national organisations separately across the collection. Require at least two supported NGO or nonprofit listings in each region for the national milestone. A completed search with no suitable source should remain visible as a gap.

For volunteer checks, begin with the listings in the volunteer's region. Ask for the programme name, commune, whether the work is still active, the best public contact route, and the date and method of confirmation. A volunteer can choose **Confirm a listing** on the contribution form. Update the programme and contact confirmation dates separately, according to what the volunteer actually checked.

Before handover, give the successor access to the GitHub repository, Cloudflare account/project, public correction queue and domain renewal account through the providers' access controls. Record primary and backup maintainers, billing and renewal ownership, production settings and the last tested rollback in the deployment notes. Verify that the successor can edit a record and inspect a preview before relying on the transfer.
