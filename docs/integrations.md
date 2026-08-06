# Integrations

## Fourthwall

The public site is presently served through Fourthwall. Stage 1 keeps merchandise and donation destinations in `src/config/site.ts` and optional public overrides in `.env.example`. No cart, checkout, payments, currency controls, memberships, or account UI are reproduced.

The live merch destination is `https://grassrootsracing.org/collections/all`. The owner-provided donation copy is implemented, but `https://grassrootsracing.org/pages/donate` returned no confirmed navigation entry during inventory; confirm the safe Fourthwall donation URL before release.

## Live league data

Cup and IndyCar pages expose SimRacerHub driver-stat links and custom standings/schedule/results loaders. GT pages expose custom class-filtered loaders. Exact request endpoints were not reliably exposed by the rendered DOM inventory.

- TODO(endpoint): confirm Cup standings, schedule and result endpoints and response schemas.
- TODO(endpoint): confirm GT standings, team standings, schedule and result endpoints and response schemas.
- TODO(endpoint): confirm IndyCar standings, schedule and result endpoints and response schemas.
- TODO(adapter): preserve existing API field names behind typed adapters before Stage 3 UI wiring.

Public endpoint placeholders live in `.env.example`. Never put a private token or credential in a `VITE_` variable. Secret-dependent calls must run through a server-side Cloudflare Worker with timeouts, validation, safe parsing, and CORS restricted to the production/preview origins.

## Other embeds

- GT rules Google document: `https://docs.google.com/document/d/e/2PACX-1vRGNnl3uRlz6qmiQ1Z4p3icskAJDxtofIxed5PiQY9emnxq5x1hObSL_pKxYwWFM2VGZiNS-fo-NCC6/pub?embedded=true`.
- Discord invite: `https://discord.gg/grassrootsracing`.
- Discord widget is present on the current homepage but its malformed query string should be corrected or removed during Stage 2.
- Twitch: `https://www.twitch.tv/grassrootsracing`.
- SimRacerHub driver stats use `https://www.simracerhub.com/scoring/driver_stats.php?driver_id=...`.
