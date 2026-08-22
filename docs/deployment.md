# Cloudflare Pages deployment

1. In Cloudflare, create a Pages project and connect `Choadler/grr-web-beta`.
2. Use `pnpm build` (or `npm run build`) as the build command and `dist` as the output directory.
3. Use a current Node.js LTS runtime. No secrets are required for Stage 1.
4. Add only public endpoint variables from `.env.example` in Pages Settings > Environment variables. Put secrets in a Worker, never in `VITE_` variables.
5. Keep this feature branch for preview deployments and test its generated `*.pages.dev` URL before production promotion. Enable the Pages preview Access policy; repository middleware denies every `/admin*` request on non-canonical hostnames, including `pages.dev`.
6. Add `beta.grassrootsracing.org` as a Pages custom domain after the preview is approved. Do not alter the current production DNS during beta testing.
7. Test navigation, 320px mobile layout, keyboard menus, reduced motion, external merch/donation handoffs, console output, and asset loading.
8. When approved, add `grassrootsracing.org` to the Pages project and follow Cloudflare’s displayed DNS migration. Schedule the cutover and retain the prior Fourthwall configuration until rollback is no longer needed.
9. `_redirects` enables React Router fallback. Preserve every inventoried legacy `/pages/...` path as its equivalent route or explicit redirect before production cutover.
10. Merchandise links remain external to the existing Fourthwall storefront. Confirm whether the storefront will retain `grassrootsracing.org` or move to a dedicated shop hostname before DNS migration.

Cloudflare Pages does not automatically make GitHub Pages serve this build; they are separate deployment products.

## IndyCar D1 setup

The in-house IndyCar scoring functions require one Cloudflare D1 database.

1. In Cloudflare, open **Workers & Pages > D1 SQL Database** and create a database such as `grr-scoring`.
2. Open the `grr-web-beta` Pages project, then **Settings > Bindings > Add > D1 database binding**.
3. Set the variable name to exactly `INDYCAR_DB` and select the new database. Add the binding to both Preview and Production if both environments will be tested.
4. Apply `migrations/0001_indycar_scoring.sql` to that database. With Wrangler authenticated, the equivalent command is:

   ```powershell
   npx.cmd wrangler d1 execute grr-scoring --remote --file=migrations/0001_indycar_scoring.sql
   ```

5. Redeploy the Pages project so its Functions receive the binding.
6. Confirm the existing Cloudflare Access application protects `grassrootsracing.org/admin*`. This covers both `/admin/indycar` and `/admin/api/indycar`.
7. Sign in, create or edit the IndyCar season, configure its points, create scheduled events, and preview a real result JSON before publishing.
8. Leave the season in Draft while testing. Set it to Active only when its schedule and historical event results are ready; the public IndyCar pages then begin preferring D1 data automatically.

Do not place database IDs, tokens, Access service credentials, or other secrets in `VITE_` variables. D1 is available only through the server-side Pages Functions.

## GT League D1 setup

GT League scoring shares the existing `INDYCAR_DB` D1 binding so the project has one scoring database and no additional client credentials.

1. Apply `migrations/0003_gt_scoring.sql` to the same `grr-scoring` database:

   ```powershell
   npx.cmd wrangler d1 execute grr-scoring --remote --file=migrations/0003_gt_scoring.sql
   ```

2. Redeploy the Pages project after the migration and confirm Cloudflare Access still covers `/admin*`.
3. In `/admin/gt`, create the season, assign drivers to `GT3 AM`, `GT3 Pro`, or `GTP`, configure all three points tables, and add the schedule.
4. Leave the season in Draft until real race imports and public tables have been reviewed. Activating a populated season makes the public GT pages prefer D1 automatically.

Driver assignments are stored by iRacing Customer ID. The assigned class, team, and car are copied onto each published result, so later roster edits do not rewrite historical races.

## Community gallery storage

The gallery keeps moderation metadata in the existing `INDYCAR_DB` D1 database and stores image files in a private R2 bucket.

1. Apply the gallery migrations through `migrations/0013_gallery_submission_batches.sql` to the `grr-scoring` database.
2. In **Storage & databases > R2 Object Storage**, create a private bucket named `grr-gallery`.
3. In the `grr-web-beta` Pages project, open **Settings > Bindings**, add an **R2 bucket binding**, set the variable name to exactly `GALLERY_BUCKET`, and select `grr-gallery`.
4. Add the same binding to Preview if gallery uploads will be tested there, then redeploy.
5. Create a managed Turnstile widget for `www.grassrootsracing.org`. Set its public sitekey as `VITE_TURNSTILE_SITE_KEY` in both the build environment and local `.env.local` when needed.
6. Store the widget secret as the server-side Pages secret `TURNSTILE_SECRET`. Never use a `VITE_` name for it. Optionally set `TURNSTILE_HOSTNAMES` to a comma-separated hostname allowlist; production defaults to `www.grassrootsracing.org`.
7. Confirm Cloudflare Access still protects `/admin*`; gallery moderation is available at `/admin/gallery`.
8. Add a Cloudflare rate-limiting rule for `POST /api/gallery`. Turnstile rejects automated submissions, while the rate limit bounds requests that reach multipart parsing.

Do not expose the R2 bucket publicly. Approved files are served through `/api/gallery/photo/:id`, while pending and rejected files are available only through the Access-protected admin API. Public uploads accept JPEG, PNG, and WebP originals up to 50 MB and validate their file signatures. One Turnstile challenge authorizes one sequential batch of at most ten photos for 15 minutes; D1 rejects skipped or replayed batch positions.

## Race sponsorship inquiries

Apply `migrations/0020_sponsorship_inquiries.sql` to `grr-scoring`, then redeploy. The public form uses the existing Turnstile widget, stores inquiry details in the shared `INDYCAR_DB` database, and stores logos under a private `sponsorships/` prefix in `GALLERY_BUCKET`. Administrators review and update inquiries at `/admin/sponsorships`; the logo routes remain behind Cloudflare Access. Add a Cloudflare rate-limiting rule for `POST /api/sponsorship` alongside the gallery upload rule.
