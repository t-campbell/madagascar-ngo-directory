# Implementation status

As of 2026-11-19, the static app and seed migration run locally. The public source repository is https://github.com/t-campbell/madagascar-ngo-directory. Cloudflare Pages setup, the live domain and contribution inbox are pending.

- All 28 seed rows are reconciled. 26 profiles are listed, including three coordination records and three with historical-only work. The default search shows 20 organisations. NORA Madagascar and EDENa remain in the saved handoff archive pending stronger local programme sources. Review used the supplied source registry. Contact routes have no direct confirmations.
- Filters offer all 24 regions. Listed work occurs in Analanjirofo, Ambatosoa and Atsinanana. The national coverage research pass remains open.
- Node 24.22.1. Eight automated tests passed. The build produced 68 routes in the sitemap plus the 404 page.
- Browser spot checks passed in Chrome for Ran’Eau name normalisation, Soakoja region/sector filtering, back/forward, CSV download, the local call link, direct profile refresh and opening the evidence section.
- Automated Chromium launch failed in this workspace because its browser process could not open a required local socket. The included CI browser suite covers keyboard interaction, 320–430 px screens, no-JavaScript browsing, constrained networking and the browser benchmark. These checks remain to be run in an environment that can launch Chromium. The deployment preview and rollback also require a Pages project.
- Gzipped home shell with CSS and imported JS measured 12,639 bytes. The live search data payload for the local build measured 6,742 bytes gzip. A synthetic 500-record index measured 103,568 bytes gzip. Its slowest Node filter and HTML render across 20 runs was about 30 ms, excluding browser DOM updates and paint.
