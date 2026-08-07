# Cloudflare Pages deployment

1. In Cloudflare, create a Pages project and connect `Choadler/grr-web-beta`.
2. Use `pnpm build` (or `npm run build`) as the build command and `dist` as the output directory.
3. Use a current Node.js LTS runtime. No secrets are required for Stage 1.
4. Add only public endpoint variables from `.env.example` in Pages Settings > Environment variables. Put secrets in a Worker, never in `VITE_` variables.
5. Keep this feature branch for preview deployments and test its generated `*.pages.dev` URL before production promotion.
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
