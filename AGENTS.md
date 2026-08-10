# Grassroots Racing Repository Instructions

These instructions apply to the entire repository.

## Working principles

- Inspect the relevant existing implementation, adjacent components, types, services, configuration, migrations, and documentation before modifying anything.
- Treat the current repository implementation as the source of truth when documentation, examples, comments, or historical migration notes conflict with working code. Investigate the discrepancy rather than silently following stale documentation.
- Preserve existing functionality unless the user explicitly asks to change it.
- Make the smallest targeted change that fully addresses the request. Do not perform unrelated refactors, cleanup, redesigns, dependency churn, or architecture changes unless explicitly requested.
- Do not modify files outside the requested scope merely to make them stylistically uniform.
- Reuse existing components, services, adapters, utilities, types, CSS classes, and interaction patterns before creating new abstractions.
- Preserve the existing GRR design language: dark olive and charcoal surfaces, bright green accents, uppercase motorsports presentation, dense data tables, squared controls, restrained borders, and racing-focused imagery.
- Preserve mobile and responsive behavior. Check narrow layouts, horizontal table scrolling, navigation, touch controls, and reduced-motion behavior when relevant.
- Never invent league rules, scoring rules, schedules, results, statistics, driver information, claims, promotional copy, sponsor information, or event details. Use only authoritative content already in the repository or content explicitly supplied by the user.
- Treat scoring, standings, race-result, class-assignment, interval, penalty, and import logic as high-risk data logic. Trace the full data flow and verify assumptions before changing it.
- Verify external and imported data mappings against representative real payload shapes before changing parsers or adapters. Validate iRacing field meanings, timing units, interval units, session types, identifiers, and sentinel values rather than inferring them from names. Preserve compatibility aliases unless their removal is explicitly requested and supported by evidence.
- When debugging an existing bug, determine and explain the root cause before applying a fix. Do not mask symptoms with hardcoded values or one-off special cases unless the underlying data or business rule genuinely requires one.
- Test the affected functionality after changes. At minimum, run the most relevant available checks (`pnpm typecheck`, `pnpm lint`, and/or `pnpm build`) and perform focused behavioral verification appropriate to the change. State clearly if a check could not be run.
- Before declaring a task complete, inspect the final diff and confirm that only intended files and behavior changed. Revert incidental edits introduced during investigation, formatting, generated output, or tooling.
- Do not expose credentials or private tokens in source, documentation examples, `VITE_` variables, or browser code.

## Application architecture

- The public website is a React and TypeScript single-page application built with Vite.
- `src/main.tsx` mounts the application with `BrowserRouter`; `src/App.tsx` owns the global shell and route table.
- Legacy Fourthwall-compatible `/pages/...` paths are intentionally preserved. `public/_redirects` provides the SPA fallback. Do not casually rename or remove routes.
- `src/pages/league/LeaguePages.tsx` composes the Cup, GT, and IndyCar public pages from shared league components.
- Shared interactive behavior lives under `src/components/league/`, including live tables, results exploration, countdowns, league navigation, overview panels, state handling, and gallery rails.
- Data-access and normalization logic belongs under `src/services/`; page components should not directly duplicate endpoint parsing.
- Shared destinations, schedules, and integration endpoints are centralized under `src/config/`.
- League table contracts live in `src/types/league.ts`; gallery contracts live in `src/types/gallery.ts`; admin domain contracts have their own type modules.
- Cup and GT sporting-code source content is stored under `src/content/` and rendered by dedicated searchable components. Treat this content as authoritative; do not improvise missing clauses.
- Styling is intentionally centralized in `src/styles/global.css`. Extend existing class naming and responsive patterns instead of introducing an unrelated design system.
- Several mobile behaviors are deliberate rather than incidental: responsive navigation, horizontally scrollable tables, touch-friendly controls, gallery rail sizing, admin session controls, and reduced-motion handling. Verify these when changing their surrounding markup or CSS.

## Data sources and client behavior

- Cup public data remains externally sourced:
  - SimRacerHub season data is configured in `src/config/integrations.ts`.
  - Recent results come from the configured GRR Cloudflare Worker endpoint.
  - The published static Cup calendar in `src/config/schedules.ts` supplements external race records and is used by schedules and countdowns.
- IndyCar public schedule, standings, and results come exclusively from the in-house `/api/indycar` Pages Function. Do not add an external or SimRacerHub fallback unless explicitly requested.
- GT public schedule, driver standings, team standings, and results come exclusively from `/api/gt`. Do not restore retired Google Sheets or Worker fallbacks unless explicitly requested.
- `src/services/dataSources.ts` connects page loaders to the source-specific services and adapters.
- `src/services/adapters.ts` normalizes external SimRacerHub and legacy-shaped payloads into shared table and race-event contracts. Mapping changes must be checked against actual payload fields and all consumers.
- `src/services/http.ts` provides request timeouts, response-size limits, request deduplication, safe JSON parsing, abort handling, and browser Cache Storage last-known-good behavior. Preserve these resilience properties.
- Local development intentionally uses browser `localStorage` for IndyCar and GT admin data and in-memory gallery records. Production uses Pages Functions and Cloudflare bindings.
- Production scoring/mutation logic lives in Pages Functions, while local-development behavior is also implemented in `src/services/indycarAdmin.ts` and `src/services/gtAdmin.ts`. A scoring, result-editing, publishing, assignment, or public-payload change may require coordinated updates to both paths; do not fix only one without checking the other.

## Scoring and import conventions

- IndyCar and GT administration accept iRacing result JSON through normalizers in `src/services/indycarImport.ts` and `src/services/gtImport.ts`.
- Importers support multiple known iRacing payload shapes. Preserve the original uploaded JSON for auditability and validate normalized previews before publishing.
- Do not change finish intervals, lap times, fastest-lap comparisons, or displayed gaps without tracing their units from the source payload through normalization, D1 storage, public API formatting, and table/export presentation. Similar-looking values are not necessarily stored in the same units.
- Publishing a result replaces the prior import and calculated results for that scheduled event; it must not create duplicate scoring.
- IndyCar scoring includes position points, pole/laps-led/most-laps-led bonuses, penalties, and corrected finish intervals.
- GT scoring is multiclass (`gt3-am`, `gt3-pro`, and `gtp`) and supports standard and endurance race-format point configurations.
- GT driver assignments are keyed by season and iRacing customer ID. Published results retain historical class, team, and car values even if roster defaults change later.
- GT team membership and class changes have downstream scoring and standings implications. Trace database mutations, rescore behavior, public API aggregation, and UI display together.
- Public APIs derive standings and result presentations from normalized D1 rows. Changes to database columns or scoring semantics generally require coordinated updates to migrations, admin Functions, public Functions, client types/services, and UI columns.
- Before modifying scoring or standings, trace at least: importer -> normalized preview -> admin mutation payload -> production Function calculation -> D1 columns -> public Function aggregation/formatting -> `dataSources.ts` -> rendered tables and exports. Also check the local-development implementation for equivalent behavior.

## Cloudflare architecture

- The project deploys to Cloudflare Pages with `pnpm build`; the output directory is `dist`.
- `wrangler.toml` is the deployment binding definition and uses the project name `grr-web-beta`.
- Server routes are Cloudflare Pages Functions under `functions/`.
- `functions/_middleware.js` enforces the production hostname split:
  - Public pages use `www.grassrootsracing.org`.
  - `/admin` and `/admin/*` use the bare `grassrootsracing.org` hostname.
- `src/App.tsx` mirrors that canonical-host behavior client-side so the application does not briefly mount against the wrong origin.
- Cloudflare Access is the security boundary for the bare-domain `/admin*` routes. Admin Functions rely on that upstream protection; do not assume the React UI itself provides authorization.
- The browser reads the Access identity endpoint only on the admin origin and maintains a short-lived cross-subdomain marker for header/session presentation. That marker is not an authorization mechanism.
- Admin fetches use `src/services/adminSession.ts` to avoid reloading single-use Cloudflare Access callback URLs.
- The Vite configuration deliberately rewrites generated module script tags and related runtime references for compatibility with Cloudflare script processing. Do not remove or simplify this transform without verifying deployed behavior.
- Cache-revision constants/comments and unusual asset-loading workarounds in `vite.config.ts`, `src/main.tsx`, and `src/styles/global.css` reflect prior production caching or Cloudflare compatibility issues. Determine why they exist and verify real deployed behavior before simplifying, renaming, or removing them.
- `_headers` keeps HTML, admin pages, and static assets revalidation-friendly. Public data Functions set their own cache policies.

## D1 database

- The D1 binding is named `INDYCAR_DB`, but it is the shared relational database for IndyCar scoring, GT scoring, and gallery metadata.
- SQL migrations live in `migrations/` and are ordered, forward-only schema history. Never rewrite an already-deployed migration; add a new numbered migration.
- IndyCar tables cover seasons, point configurations, events, raw imports, and normalized/scored results.
- GT tables cover seasons, race-format point configurations, events, driver assignments, teams, raw imports, and normalized/scored multiclass results.
- Gallery metadata is stored in `gallery_photos`, including moderation status, attribution, league, showcase visibility, and original/optimized object keys.
- Maintain binding compatibility across both default and production Wrangler environments.
- A schema change is incomplete until all relevant production Functions, local-development state handling, TypeScript types, public payloads, UI consumers, migration/deployment instructions, and cleanup paths have been checked.

## R2 gallery storage

- `GALLERY_BUCKET` is a private R2 bucket containing original gallery uploads plus optional display and thumbnail variants.
- Gallery metadata is stored in D1; image bytes are stored in R2. Keep the database and object lifecycle coordinated, including cleanup on failed uploads and administrative deletion.
- Public gallery endpoints return only approved records and serve approved files through `/api/gallery/...`; the bucket must not be exposed directly.
- Admin gallery endpoints under `/admin/api/gallery/...` can access pending and rejected images and must remain Access-protected.
- The browser prepares optimized display and thumbnail variants while preserving the original upload. Server validation checks type, size, and file signatures.
- Original, optimized-display, and thumbnail object keys can all belong to one gallery row. Upload rollback, moderation, serving fallbacks, backfills, and deletion must account for every variant without orphaning R2 objects or leaving broken D1 references.
- League photo rails and the homepage gallery request only approved showcase-enabled photos. Gallery failures should degrade to an empty gallery rather than breaking public league pages.
- Discord gallery notifications use server-side webhook bindings (`DISCORD_GALLERY_WEBHOOK_URL` and `DISCORD_GALLERY_PUBLIC_WEBHOOK_URL`) and background execution. Never move these secrets or webhook calls into public client configuration.

## API boundaries

- Public read-only data APIs:
  - `GET /api/indycar`
  - `GET /api/gt`
  - `GET /api/gallery` and approved gallery image routes
- Public gallery submission:
  - `POST /api/gallery`
- Access-protected administration APIs:
  - `/admin/api/indycar`
  - `/admin/api/gt`
  - `/admin/api/gallery`
- Public scoring APIs use short CDN/browser caching; administrative and gallery metadata responses are generally `no-store`; gallery image routes have longer object caching.
- Keep secrets and D1/R2 access server-side. Browser code should call the Pages Functions rather than Cloudflare management APIs.

## Deployment and dependency conventions

- The repository contains both `pnpm-lock.yaml` and `package-lock.json`. Avoid changing either unless dependency installation or dependency changes are part of the task; keep them consistent when dependencies do change.
- Runtime dependencies are intentionally limited to React, React DOM, React Router, Vite, and TypeScript-related tooling.
- There is currently no committed automated test suite or GitHub Actions workflow. Use type checking, linting, production builds, and focused manual verification proportionate to the change.
- Public `VITE_` variables may contain only non-secret browser configuration. D1 IDs, API tokens, Access credentials, and webhook URLs must remain server-side.
- Do not change production DNS, Cloudflare Access policy, D1 data, R2 objects, deployed bindings, or deployment state unless the user explicitly authorizes that external change.

## Known documentation and configuration caveats

- Some documentation records migration-stage assumptions and may lag the implementation. Confirm behavior in current source before using documentation as a specification.
- The gallery upload limit documented in `docs/deployment.md` may not match the current browser and Function limits. Use the implementation as the source of truth and update documentation when a task explicitly addresses the discrepancy.
- `.env.example` contains endpoint placeholders that are not necessarily consumed by current source. Trace every `import.meta.env` reference before adding, removing, or relying on a variable.
- Current GT scoring is organized around standard and endurance race-format configurations in the latest schema and implementation. Do not infer current behavior solely from older text describing per-class point configurations.
- The donation destination is not confirmed as authoritative. Do not change or promote it without user-provided confirmation.
- Repository source alone cannot prove which migrations, bindings, secrets, Access policies, or data are currently deployed. Inspect authorized Cloudflare state before making claims or production changes that depend on it.

## High-risk change checklist

- Be especially cautious with scoring, standings, results, imports, database schemas, hostname routing, Cloudflare configuration, Access/session behavior, caching compatibility code, and gallery storage.
- For parser changes, obtain or inspect representative real input and verify field mappings and units.
- For scoring changes, compare production Function behavior with local-development behavior and verify recalculation of existing published data where applicable.
- For API contract changes, check every producer and consumer, including tables, countdowns, league overviews, results explorers, championship leaders, CSV/PNG export, and cached last-known-good payloads.
- For hostname or admin changes, preserve the coordinated behavior between `functions/_middleware.js`, `src/App.tsx`, Cloudflare Access, the identity endpoint, and `src/services/adminSession.ts`.
- For gallery changes, verify D1/R2 consistency, approval visibility, showcase filtering, league filtering, image fallbacks, webhook behavior, and failure isolation on public pages.
- For unusual-looking compatibility code, inspect history and deployed assumptions before changing it; working code is not a cleanup target merely because it is unconventional.
