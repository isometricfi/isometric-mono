# Isometric legacy docs

Docusaurus site for Isometric product guides, trading mechanics, risk notes, and technical protocol docs.

- Target domain after the approved move: <https://legacy-docs.isometric.fi>
- Current docs for the new app: <https://docs.isometric.fi>
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

The legacy domain move is prepared but is not live. Do not deploy this change until the domain
switch is approved. Keep these changes on the `demo-mode` source line; publishing legacy `main`
can also publish the retired app configuration.

Domain resources are owned by `isometric-base/infra/cloudflare/prod/docs.tf`. Do not apply this
repo's outdated production Terraform. Follow the [domain move procedure](https://github.com/isometricfi/isometric-base/blob/main/infra/cloudflare/prod/README.md#docs-domain-move)
after that preparation change is merged. It covers state reconciliation, Pages access, the
domain switch, and rollback.

The unchanged `.github/workflows/deploy-docs.yml` publishes to Cloudflare Pages on docs changes
to `main` or a manual dispatch. A merge into `demo-mode` does not run that workflow. The later
approved deployment must publish the reviewed `demo-mode` build to the production branch of
the existing `volumetric-docs` Pages project.

Manual deploy from `apps/volumetric_docs`:

```bash
pnpm cf:deploy
```

Manual deploys require `CLOUDFLARE_API_TOKEN`.
