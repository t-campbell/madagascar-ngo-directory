# Deploy through GitHub and Cloudflare Pages

The source repository is https://github.com/t-campbell/madagascar-ngo-directory on branch main. The local build is ready. The Pages project, custom domain, public submission address and deployed commit are pending.

## Configuration

1. Use the dedicated public GitHub repository above. All tracked fields are public. The original workbook, raw registry, SOW and held draft records are retained in the saved handoff archive. Share maintainer access through GitHub and keep credentials out of source and archives.
2. Set `site.config.json` → `maintainer_email` to the public inbox. A public GitHub issues URL is optional. Keep `public_issue_url` null for a private repository. Run validation, tests and build from the proposed production commit.
3. In the intended Cloudflare account, open **Workers & Pages → Create application → Pages → Connect to Git**. Authorise the selected repository and leave other repositories outside the integration if possible. Connect the repo using these settings. [Cloudflare Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)

| Setting | Value |
| --- | --- |
| Production branch | `main`, unless the selected repository uses a different convention |
| Root directory | Repository root for a dedicated repository |
| Framework preset | None |
| Build image | Current default |
| Node | `24.22.1` from `.node-version` or `NODE_VERSION` |
| Build command | `npm run build` |
| Build output directory | `dist` |

The standard Pages build installs dependencies before running the command. If automatic installation is disabled in the selected project, use `npm ci && npm run build` as its build command. The repository has a lockfile and the build validates the data before writing output. Pages Free supports this project’s build and asset sizes. [Build image](https://developers.cloudflare.com/pages/configuration/build-image/) · [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/) · [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

4. On the assigned `pages.dev` URL, verify that the home page, profile refresh, empty region, missing profile, exports, evidence links and maintainer email work. Preview deployments are accessible to anyone with the URL unless the account restricts them. Only records marked `listed` go into any build.
5. In **Workers & Pages → selected project → Custom domains**, associate the agreed hostname first, then apply the DNS record Cloudflare requests. Keep unrelated records intact. Confirm TLS and both home and profile URLs at the new hostname. [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
6. Set `site.config.json` → `site_url` to the final HTTPS origin without a trailing slash, rebuild and verify canonical URLs, robots.txt and the sitemap. Keep the preview origin null until the launch URL is chosen. Review the [24-region catalogue source](https://cnlegis.gov.mg/uploads/L2023-012-VF.pdf) for any later administrative changes before launch.
7. Protect the production branch with PR checks where the repository plan allows. Preview a contact edit on a branch and verify production changes only after merging. Record the tested commit and URLs below.

## Recovery

For a bad production deployment, use **Deployments → the action menu on a known-good production deployment → Rollback to this deployment**. Then revert or repair the offending Git commit and merge through the normal review workflow so the next build does not reintroduce the problem. Verify recovery at both hostnames. Test rollback once there are two successful production builds. [Cloudflare rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)

| Deployment record | Value |
| --- | --- |
| GitHub repository / production branch | https://github.com/t-campbell/madagascar-ngo-directory / `main` |
| Cloudflare account and Pages project | Pending |
| Pages hostname | Pending |
| Custom HTTPS origin | Pending |
| Published commit and date | Pending |
| Last verified rollback | Pending |
| Domain renewal owner and successor maintainer | Pending |
