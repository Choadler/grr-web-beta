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
