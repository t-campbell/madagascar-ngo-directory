# Deploy the Madagascar NGO directory

The directory runs as the `madagascar-ngo-directory` Worker with static assets. The [current site](https://madagascar-ngo-directory.mada-tools.workers.dev/) is on the `mada-tools` account subdomain. Source changes go through the [GitHub repository](https://github.com/t-campbell/madagascar-ngo-directory) on `main`.

## Build and deploy

Run the checks with Node 24.22.1 from `.node-version`.

```sh
npm ci
npm run validate
npm test
npm run build
```

The build writes `dist/`. The committed `wrangler.jsonc` specifies the Worker name, asset directory and 404 behavior. To deploy through GitHub, connect the existing Worker under **Settings → Builds** and select this repository.

| Workers Builds setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable if needed | `NODE_VERSION=24.22.1` |

If the Worker already has a Git connection, check the existing commands before changing them. For a terminal deployment, run `npx wrangler deploy` after building and signing in to the Cloudflare account that owns the Worker. The original research workbook and draft records are retained in the handoff archive. Use the generated `dist/` for a direct asset upload. [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) · [Static assets](https://developers.cloudflare.com/workers/static-assets/get-started/)

After deployment, check the homepage, a direct profile URL, a missing profile returning HTTP 404, the full CSV, and the correction link. GitHub's `Directory checks` workflow includes a mobile browser test.

## Custom domain at handoff

1. In the Cloudflare dashboard, open **Workers & Pages → madagascar-ngo-directory → Settings → Domains & Routes → Add → Custom Domain**. Choose an unused hostname in a Cloudflare zone controlled by the new maintainer. Cloudflare creates the DNS record and issues the certificate. [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
2. Verify HTTPS and a direct profile URL at the chosen hostname. Set `site_url` in `site.config.json` to that HTTPS origin without a trailing slash, then redeploy. That publishes canonical URLs and enables indexing. Keep the public issue link current if the repository moves.
3. Record the primary and backup maintainers, who owns domain renewal, and the first verified release at the custom hostname. Give the successor access to both GitHub and the Cloudflare account. If the account subdomain changes at any point, check other Workers and replace shared links.

## Recovery

Open **Workers & Pages → madagascar-ngo-directory → Deployments**. Open the menu for a known-good version and select **Rollback**. Then repair or revert the Git commit so the next deployment includes the correction. Verify the homepage and an affected profile at the public address. [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
