# Implementation status

The directory is served by Cloudflare Workers at https://madagascar-ngo-directory.mada-tools.workers.dev/. The renamed address was verified on 2026-11-19. A custom domain and canonical URL are deferred to handoff.

- The 28 seed rows are reconciled and 26 are listed. NORA Madagascar and EDENa remain in the saved handoff archive pending stronger local programme sources.
- The first expansion adds CAP Malagasy, CEFFEL, Grandir à Antsirabe and OSCAPE in Vakinankaratra, bringing the directory to 30 profiles with operations documented in four regions. Filter choices cover all 24 regions. Vakinankaratra's research remains in progress, with sources and gaps recorded in [coverage.csv](coverage.csv).
- The correction page links to the repository's public issue form. Organisation contact details use published sources. Direct confirmations remain open.
- The 26-profile baseline passed eight automated tests and the mobile browser suite on Ubuntu 24.04. The browser suite covered 320–430 px screens, no-JavaScript browsing, constrained networking, and rendering a 500-record fixture.
