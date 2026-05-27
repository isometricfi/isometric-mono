# Isometric Docs

Docusaurus site for Isometric product guides, trading mechanics, risk notes, and technical protocol docs.

- Production docs: <https://docs.isometric.fi>
- Source content: `apps/volumetric_docs/docs`

## Setup

Install dependencies from the repository root:

```bash
pnpm install
```

## Development

```bash
pnpm --filter volumetric_docs dev
```

Open <http://localhost:3333>.

## Build

```bash
pnpm --filter volumetric_docs build
```

Docusaurus writes static output to `apps/volumetric_docs/build`.

## Deployment

Production deploys run through `.github/workflows/deploy-docs.yml` and publish to Cloudflare Pages.

Manual deploy from `apps/volumetric_docs`:

```bash
pnpm cf:deploy
```

Manual deploys require `CLOUDFLARE_API_TOKEN`.
