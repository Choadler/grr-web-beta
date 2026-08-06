# Current site inventory

Inventory captured from the public site on 2026-08-06 before implementation. The live site is hosted by Fourthwall and combines its storefront shell with custom GRR page sections and scripts.

## Global shell and navigation

- Header: GRR logo; desktop dropdown navigation; mobile menu; search/cart and Fourthwall account/store controls in the hosted shell.
- Primary groups: Home; GT League; Cup Series; IndyCar; Discord; Merch.
- GT: `/pages/gt-league`, `/pages/gt-rules`, `/pages/gt-schedule`, `/pages/gt-standings`, `/pages/gt-league-team-standings`, `/pages/gt-race-results`.
- Cup: `/pages/grr-cup-series`, `/pages/cup-series-sporting-code`, `/pages/cupstandings`, `/pages/cup-series-schedule`, `/pages/cup-latest-race-results`, `/pages/broadcast`.
- IndyCar: `/pages/indycar`, `/pages/indycar-sporting-code`, `/pages/indycar-standings`, `/pages/indycar-schedule`, `/pages/indycar-results`.
- External: Discord (`discord.gg/grassrootsracing`), Twitch (`twitch.tv/grassrootsracing`), Fourthwall merch (`/collections/all`).
- Footer: contact support, terms, privacy, returns/FAQ, copyright, Fourthwall attribution.
- Mobile: hamburger navigation; stacked homepage league panels; tables explicitly instruct users to swipe horizontally.

## Homepage

- Logo header above a full-width, looping racing video.
- Verified text/actions: “Welcome to Grassroots Racing”; “Free-to-Enter iRacing Leagues by Sim Racers, For Sim Racers”; “Join our Discord!”; “Visit our twitch”.
- League sections, in order: “GRR Cup Series - Monday Nights”, “GRR GT League - Tuesday Nights”, “GRR IndyCar League - Sunday Nights”; each uses GRR racing media and a “Click Here” action.
- Fourthwall merchandise grid follows the leagues. Product inventory, pricing, cart, checkout, currency, and account UI are platform functionality and are not part of the rebuild.
- Donation wording requested by the owner is preserved in Stage 1; the current destination still needs confirmation (see integrations).

## GT League

- Landing: league subnavigation and free Discord registration callout.
- Rules: “GT LEAGUE SPORTING CODE” in an embedded published Google Document.
- Schedule: live table with Round, Date, Track, GT3 AM Winner, GT3 Pro Winner, GTP Winner; next/completed states.
- Standings: GT3 AM/GT3 PRO/GTP class filters; standings and latest-result tables; screenshot control; podium and fastest-lap legend.
- Team standings: canonical live URL is `/pages/gt-league-team-standings`; class filters, refresh and screenshot controls. `/pages/gt-team-standings` currently returns 404.
- Results: class filters, race selector, results table, fastest-lap/podium legend.

## Cup Series

- Landing: Sporting Code, Cup Schedule, Standings, Race Results, Broadcast, and Discord registration.
- Sporting Code: ten numbered sections covering introduction, conduct, season/race rules, setups/liveries, license points and penalties, scoring, protests, teams, league authority, and conclusion. Contains penalty/scoring tables and an in-page section index.
- Standings: driver search, refresh, sortable standings table, cutoff/chase treatment, last four race results, SimRacerHub driver-stat links.
- Schedule: 2026 calendar table with round/date/track/type/winner/pole plus refresh and completion status.
- Race results: race selector, Latest Race and Refresh controls, Overall/Stage 1/Stage 2 filters, detailed results table.
- Broadcast: embedded/linked GRR broadcast media (Stage 2 inventory refinement required).

## IndyCar

- Landing plus Sporting Code, Standings, Schedule, and Race Results subnavigation.
- Standings: screenshot/refresh, sortable driver table, SimRacerHub stats links.
- Schedule: round/date/track/laps/winner/pole and refresh status.
- Results: race selector, latest/refresh actions, detailed results table and podium/fastest-lap treatment.

## Custom vs platform functionality

- GRR-owned/custom: brand, colors, league copy/media, league navigation, sporting codes, schedules, standings/results presentations, Discord/Twitch destinations.
- Fourthwall: storefront catalog, pricing, recommendations, cart/checkout, membership feed/perks, localization/currency, account/admin overlays, policies and support shell.
- Embedded tools: published Google Doc for GT rules; Discord widget; video media; SimRacerHub driver-stat links.
- Custom data scripts: schedule/standings/results pages visibly load live data and expose refresh, search/filter, sorting, and screenshot behavior. Endpoint confirmation is recorded in `integrations.md`.

## Visual identity

- Core observed body background: RGB `40 52 35` (`#283423`), with black/charcoal, white, gray, and bright green accents.
- Condensed, uppercase motorsports presentation; dense data tables; squared controls; full-bleed racing imagery/video; restrained borders.
- Stage 1 retains this hierarchy and avoids gradients as decoration, glass cards, fake claims, fake stats, and invented copy.
