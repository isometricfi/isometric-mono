# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

From the monorepo root:

```bash
pnpm install
```

## Local development

```bash
pnpm --filter volumetric_docs dev
```

Most changes are reflected live without restarting the server.

## Build

```bash
pnpm --filter volumetric_docs build
```

Static output is written to `apps/volumetric_docs/build`.

## Deployment

Production deploys run via GitHub Actions (`.github/workflows/deploy-docs.yml`) to [Cloudflare Pages](https://developers.cloudflare.com/pages/) using [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

From `apps/volumetric_docs` after a build:

```bash
pnpm cf:deploy
```

Or deploy the `build` directory directly (requires `CLOUDFLARE_API_TOKEN` in the environment):

```bash
pnpm exec wrangler pages deploy build --project-name=volumetric-docs
```

`wrangler.toml` follows [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) (`name`, `compatibility_date`, `pages_build_output_dir`, and `$schema` for editor validation).

## Alternative: GitHub Pages

If you use Docusaurus’s built-in GitHub Pages flow instead of Cloudflare:

```bash
USE_SSH=true pnpm --filter volumetric_docs deploy
```

Or:

```bash
GIT_USER=<Your GitHub username> pnpm --filter volumetric_docs deploy
```
