# Grassroots Racing website rebuild

Stage 1 of the production-ready GRR website rebuild. The React/Vite application preserves the current public identity, homepage flow, league navigation, external community links, Fourthwall storefront handoff, and verified homepage copy.

## Local development

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

Copy `.env.example` to `.env.local` only when public endpoint overrides are required. Never expose secrets in `VITE_` variables.

## Deployment

Cloudflare Pages build command: `pnpm build`. Output directory: `dist`. See `docs/deployment.md`.

## Scope

- Stage 1: repository tooling, visual system, accessible responsive header/footer, homepage, real GRR copy, and existing external links.
- Later stages: league detail pages, tables/sporting codes, live-data adapters, export controls, and final URL migration.
