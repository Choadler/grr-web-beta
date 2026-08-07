# Integrations

## Fourthwall

The public site is presently served through Fourthwall. Stage 1 keeps merchandise and donation destinations in `src/config/site.ts` and optional public overrides in `.env.example`. No cart, checkout, payments, currency controls, memberships, or account UI are reproduced.

The live merch destination is `https://grassrootsracing.org/collections/all`. The owner-provided donation copy is implemented, but `https://grassrootsracing.org/pages/donate` returned no confirmed navigation entry during inventory; confirm the safe Fourthwall donation URL before release.

## Live league data

Cup and IndyCar pages expose SimRacerHub driver-stat links and custom standings/schedule/results loaders. GT pages expose custom class-filtered loaders. Stage 2 recovered the public request endpoints from those current page loaders. They are centralized in `src/config/integrations.ts`; Stage 3 accesses them through the typed adapters in `src/services/` rather than directly from page components.

- Cup standings/schedule/results: SimRacerHub season `28581` via `get_standings.php`.
- Cup recent results: `red-star-b0d9.cknoedler1013.workers.dev`, series `12921`.
- GT driver standings: `aged-breeze-c1bb.cknoedler1013.workers.dev`, class paths `/gt/am`, `/gt/pro`, `/gt/gtp`.
- GT team standings: `holy-bird-8afa.cknoedler1013.workers.dev`, using the same class paths.
- GT schedule/results: `grr-gt-racebyrace.cknoedler1013.workers.dev/api/race-breakdown`.
- IndyCar discovery/standings/results: SimRacerHub series `14491`.
- The client enforces a 12-second request timeout, a 12 MB response-size limit sized for the existing SimRacerHub season payload, safe JSON parsing, and aborts obsolete requests.
- The shared tables provide loading, empty, error, retry, search, sorting, CSV export, and PNG export behavior.
- Cup and IndyCar schedules use the existing published static calendars and enrich completed events with winner/pole data from each SimRacerHub driver's `races` records.
- Detailed results discover completed `RACE` sessions from those same records. Cup stage tabs discover intervening `SEGMENT` sessions exactly as the current embed does.
- Race selectors default to the latest completed event while retaining every completed event reported by SimRacerHub.
- TODO(cors): confirm each endpoint permits the Cloudflare preview and production origins; proxy only where required.

## In-house IndyCar scoring

The first in-house scoring module is implemented for IndyCar. It stores seasons, point schedules, scheduled events, original uploaded result JSON, normalized driver results, and calculated event points in Cloudflare D1.

- Protected management UI: `/admin/indycar`.
- Protected Pages Function: `/admin/api/indycar`.
- Public read-only Pages Function: `/api/indycar`.
- D1 binding name: `INDYCAR_DB`.
- Schema migration: `migrations/0001_indycar_scoring.sql`.
- The browser never receives a D1 credential or administrator secret. The `/admin*` Cloudflare Access application must continue to protect the management page and its API.
- Public IndyCar pages prefer a populated active in-house season. Until one exists, or if the public in-house endpoint fails, they continue using the existing SimRacerHub integration.
- New successful in-house data is returned immediately on the next request; the public endpoint uses only a short browser/CDN cache window.

The result importer accepts iRacing result JSON and recognizes common `session_results`, `sessionResults`, and `sessions` shapes. It retains the complete original JSON for auditing. Because iRacing export structures can vary, validate the first real IndyCar file in the preview table before publishing it. A file must be assigned to a scheduled event; publishing replaces a prior import for that event rather than creating duplicate scoring.

Current SimRacerHub history is not automatically copied into D1. To preserve the existing season exactly, upload the source result JSON for each completed event (or implement a one-time documented migration from an authoritative export) before switching the in-house season to active.

The current GT results page also references an administrative refresh endpoint. It is deliberately excluded from public client configuration and must never be invoked by the browser application.

Public endpoint placeholders live in `.env.example`. Never put a private token or credential in a `VITE_` variable. Secret-dependent calls must run through a server-side Cloudflare Worker with timeouts, validation, safe parsing, and CORS restricted to the production/preview origins.

## Other embeds

- GT rules Google document: `https://docs.google.com/document/d/e/2PACX-1vRGNnl3uRlz6qmiQ1Z4p3icskAJDxtofIxed5PiQY9emnxq5x1hObSL_pKxYwWFM2VGZiNS-fo-NCC6/pub?embedded=true`.
- Discord invite: `https://discord.gg/grassrootsracing`.
- Discord widget is present on the current homepage but its malformed query string should be corrected or removed during Stage 2.
- Twitch: `https://www.twitch.tv/grassrootsracing`.
- SimRacerHub driver stats use `https://www.simracerhub.com/scoring/driver_stats.php?driver_id=...`.
