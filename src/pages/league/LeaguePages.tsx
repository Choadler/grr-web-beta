import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable, EmptyTableRow } from '../../components/league/DataTable'
import { CupSportingCode } from '../../components/league/CupSportingCode'
import { LiveDataTable, type LiveColumn } from '../../components/league/LiveDataTable'
import { RaceResultsExplorer } from '../../components/league/RaceResultsExplorer'
import { LeagueNav, type LeagueNavItem } from '../../components/league/LeagueNav'
import { PageMeta } from '../../components/league/PageMeta'
import { EmptyState } from '../../components/league/States'
import { externalLinks } from '../../config/site'
import { cupRaceEvents, cupSchedule, cupStandings, gtRaceEvents, gtSchedule, gtStandings, gtTeamStandings, indyRaceEvents, indySchedule, indyStandings } from '../../services/dataSources'
import type { DataLoader } from '../../types/league'
import type { TableRow } from '../../types/league'

const cupNav: LeagueNavItem[] = [
  { label: 'Cup Sporting Code', href: '/pages/cup-series-sporting-code' },
  { label: 'Cup Schedule', href: '/pages/cup-series-schedule' },
  { label: 'Cup Standings', href: '/pages/cupstandings' },
  { label: 'Cup Race Results', href: '/pages/cup-latest-race-results' },
  { label: 'Cup Broadcast', href: '/pages/broadcast' },
]
const gtNav: LeagueNavItem[] = [
  { label: 'GT Home', href: '/pages/gt-league' },
  { label: 'GT Rules', href: '/pages/gt-rules' },
  { label: 'GT Schedule', href: '/pages/gt-schedule' },
  { label: 'GT Standings', href: '/pages/gt-standings' },
  { label: 'GT Team Standings', href: '/pages/gt-league-team-standings' },
  { label: 'GT Race Results', href: '/pages/gt-race-results' },
]
const indyNav: LeagueNavItem[] = [
  { label: 'Sporting Code', href: '/pages/indycar-sporting-code' },
  { label: 'Standings', href: '/pages/indycar-standings' },
  { label: 'Schedule', href: '/pages/indycar-schedule' },
  { label: 'Race Results', href: '/pages/indycar-results' },
]

type LeagueKey = 'cup' | 'gt' | 'indycar'
const leagueConfig = {
  cup: { label: 'Cup Series', nav: cupNav, image: '/assets/home/cup-series.webp' },
  gt: { label: 'GT League', nav: gtNav, image: '/assets/home/gt-league.webp' },
  indycar: { label: 'IndyCar', nav: indyNav, image: '/assets/home/indycar.webp' },
} as const

function PageShell({
  league,
  title,
  eyebrow,
  children,
}: {
  league: LeagueKey
  title: string
  eyebrow?: string
  children: React.ReactNode
}) {
  const config = leagueConfig[league]
  return (
    <>
      <PageMeta title={title} description={title} />
      <LeagueNav label={config.label} items={config.nav} />
      <header
        className="page-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.88), rgba(0,0,0,.22)), url(${config.image})`,
        }}
      >
        <div className="container">
          <p className="eyebrow">{eyebrow ?? config.label}</p>
          <h1>{title}</h1>
        </div>
      </header>
      <div className="page-content container">{children}</div>
    </>
  )
}

function DiscordCallout() {
  return (
    <aside className="league-callout">
      <h2>Wanna race? Register in our Discord for free!</h2>
      <a className="button" href={externalLinks.discord} target="_blank" rel="noreferrer">
        GRR Discord<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </aside>
  )
}

function LinkGrid({ links }: { links: LeagueNavItem[] }) {
  return (
    <div className="league-link-grid">
      {links.map((item) => (
        <Link key={item.href} to={item.href}>
          {item.label}
          <span aria-hidden="true">→</span>
        </Link>
      ))}
    </div>
  )
}

export function CupLandingPage() {
  return (
    <PageShell league="cup" title="GRR Cup Series">
      <LinkGrid links={cupNav} />
      <DiscordCallout />
    </PageShell>
  )
}
export function GtLandingPage() {
  return (
    <PageShell league="gt" title="GRR GT League">
      <LinkGrid links={gtNav.slice(1)} />
      <DiscordCallout />
    </PageShell>
  )
}
export function IndyLandingPage() {
  return (
    <PageShell league="indycar" title="GRR IndyCar League">
      <LinkGrid links={indyNav} />
      <DiscordCallout />
    </PageShell>
  )
}

export function CupSportingCodePage() {
  return (
    <PageShell
      league="cup"
      title="GRR Cup Sporting Code"
      eyebrow="Rules, procedures, scoring and penalties"
    >
      <CupSportingCode />
    </PageShell>
  )
}

export function GtRulesPage() {
  return (
    <PageShell league="gt" title="GT League Sporting Code">
      <div className="document-frame">
        <iframe
          src="https://docs.google.com/document/d/e/2PACX-1vRGNnl3uRlz6qmiQ1Z4p3icskAJDxtofIxed5PiQY9emnxq5x1hObSL_pKxYwWFM2VGZiNS-fo-NCC6/pub?embedded=true"
          title="GT League Sporting Code"
          loading="lazy"
        />
      </div>
    </PageShell>
  )
}

export function IndySportingCodePage() {
  return (
    <PageShell league="indycar" title="GRR IndyCar Sporting Code">
      <EmptyState
        title="Sporting code migration in progress"
        message="TODO(content): Migrate the publicly visible IndyCar sporting code after completing line-by-line verification. No replacement rules have been invented."
      />
    </PageShell>
  )
}

type DataPageProps = {
  league: LeagueKey
  title: string
  eyebrow?: string
  columns: LiveColumn[]
  filters?: string[]
  search?: boolean
  caption?: string
  loader?: DataLoader
  loaders?: DataLoader[]
  rowClassName?: (row: TableRow) => string
  note?: string
}
function DataPage({ league, title, eyebrow, columns, filters, search, caption, loader, loaders, rowClassName, note }: DataPageProps) {
  const [activeFilter, setActiveFilter] = useState(0)
  const activeLoader = loaders?.[activeFilter] ?? loader
  return (
    <PageShell league={league} title={title} eyebrow={eyebrow}>
      {filters && <div className="data-toolbar">
          <fieldset className="filter-group">
            <legend>Filter results</legend>
            {filters.map((filter, index) => (
              <button
                className={index === activeFilter ? 'filter-button is-active' : 'filter-button'}
                type="button"
                key={filter}
                onClick={() => setActiveFilter(index)}
                aria-pressed={index === activeFilter}
              >
                {filter}
              </button>
            ))}
          </fieldset>
      </div>}
      {note && <p className="standings-legend">{note}</p>}
      {activeLoader ? <LiveDataTable key={activeFilter} title={caption ?? title} columns={columns} loader={activeLoader} search={search} rowClassName={rowClassName} /> : <DataTable caption={caption ?? title} columns={columns.map((column) => column.label)}>
        <EmptyTableRow
          columns={columns.length}
          message="TODO(integration): Confirm the current public data endpoint before connecting this table."
        />
      </DataTable>}
    </PageShell>
  )
}

export const CupStandingsPage = () => (
  <DataPage
    league="cup"
    title="GRR Cup Series Standings"
    eyebrow="GRR Cup Series 2026"
    search
    loader={cupStandings}
    note="Chase field: positions 1–16 are currently in. The green line marks the cutoff."
    rowClassName={(row) => Number(row.rank) === 17 ? 'standings-row--cutline' : Number(row.rank) <= 16 ? 'standings-row--chase' : ''}
    columns={[{ key: 'rank', label: 'Pos' }, { key: 'driver', label: 'Driver' }, { key: 'points', label: 'Pts' }, { key: 'cutoff', label: '+/- Cutoff', cellClassName: (value) => Number(value) >= 100 ? 'cutoff-value cutoff-value--safe' : Number(value) <= -100 ? 'cutoff-value cutoff-value--danger' : 'cutoff-value cutoff-value--close' }, { key: 'chase', label: 'Chase' }, { key: 'starts', label: 'Starts' }, { key: 'wins', label: 'W' }, { key: 'stageWins', label: 'Stg W' }, { key: 'poles', label: 'Poles' }, { key: 'top5', label: 'T5' }, { key: 'top10', label: 'T10' }, { key: 'lapsLed', label: 'Led' }, { key: 'link', label: 'Link', link: true }]}
  />
)
export const CupSchedulePage = () => (
  <DataPage
    league="cup"
    title="GRR Cup Series 2026 Calendar"
    eyebrow="Race schedule, winners, and pole sitters"
    loader={cupSchedule}
    columns={[{ key: 'round', label: 'Rd' }, { key: 'date', label: 'Date' }, { key: 'track', label: 'Track' }, { key: 'type', label: 'Type' }, { key: 'winner', label: 'Winner' }, { key: 'pole', label: 'Pole' }]}
  />
)
export const CupResultsPage = () => <PageShell league="cup" title="GRR Cup Series Race Results" eyebrow="GRR Cup Series 2026"><RaceResultsExplorer title="GRR Cup Series Race Results" loader={cupRaceEvents} /></PageShell>
export function CupBroadcastPage() {
  return (
    <PageShell league="cup" title="GRR Cup Broadcast">
      <div className="media-placeholder">
        <h2>Grassroots Racing on Twitch</h2>
        <p>Broadcast remains connected to the existing GRR Twitch channel.</p>
        <a className="button" href={externalLinks.twitch} target="_blank" rel="noreferrer">
          Visit our twitch<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </PageShell>
  )
}

export const GtSchedulePage = () => (
  <DataPage
    league="gt"
    title="GT League Schedule"
    loader={gtSchedule}
    columns={[{ key: 'round', label: 'Round' }, { key: 'date', label: 'Date' }, { key: 'track', label: 'Track' }, { key: 'am', label: 'GT3 AM Winner' }, { key: 'pro', label: 'GT3 Pro Winner' }, { key: 'gtp', label: 'GTP Winner' }]}
  />
)
export const GtStandingsPage = () => (
  <DataPage
    league="gt"
    title="GT League Standings"
    filters={['GT3 AM', 'GT3 Pro', 'GTP']}
    loaders={[gtStandings('am'), gtStandings('pro'), gtStandings('gtp')]}
    search
    columns={[{ key: 'rank', label: 'Rank' }, { key: 'driver', label: 'Driver' }, { key: 'car', label: 'Car' }, { key: 'starts', label: 'Race Starts' }, { key: 'points', label: 'Points' }, { key: 'wins', label: 'Wins' }, { key: 'podiums', label: 'Podiums' }]}
  />
)
export const GtTeamStandingsPage = () => (
  <DataPage
    league="gt"
    title="GT League Team Standings"
    filters={['GT3 AM', 'GT3 Pro', 'GTP']}
    loaders={[gtTeamStandings('am'), gtTeamStandings('pro'), gtTeamStandings('gtp')]}
    search
    columns={[{ key: 'rank', label: 'Rank' }, { key: 'driver', label: 'Team' }, { key: 'car', label: 'Car' }, { key: 'starts', label: 'Race Starts' }, { key: 'points', label: 'Points' }, { key: 'wins', label: 'Wins' }, { key: 'podiums', label: 'Podiums' }]}
  />
)
const gtResultColumns: LiveColumn[] = [{ key: 'position', label: 'Class Pos' }, { key: 'driver', label: 'Driver' }, { key: 'points', label: 'Points' }]
export const GtResultsPage = () => <PageShell league="gt" title="GT League Race Results"><RaceResultsExplorer title="GT League Race Results" loader={gtRaceEvents} columns={gtResultColumns} secondaryColumns={gtResultColumns} /></PageShell>

export const IndyStandingsPage = () => (
  <DataPage
    league="indycar"
    title="GRR IndyCar Standings"
    eyebrow="Season 1"
    loader={indyStandings}
    search
    columns={[{ key: 'rank', label: 'Pos' }, { key: 'driver', label: 'Driver' }, { key: 'points', label: 'Pts' }, { key: 'starts', label: 'Starts' }, { key: 'wins', label: 'W' }, { key: 'poles', label: 'Poles' }, { key: 'top5', label: 'T5' }, { key: 'top10', label: 'T10' }, { key: 'lapsLed', label: 'Led' }, { key: 'rating', label: 'Rating' }, { key: 'link', label: 'Link', link: true }]}
  />
)
export const IndySchedulePage = () => (
  <DataPage
    league="indycar"
    title="GRR IndyCar Schedule"
    eyebrow="Race schedule, distances, winners, and pole sitters"
    loader={indySchedule}
    columns={[{ key: 'round', label: 'Rd' }, { key: 'date', label: 'Date' }, { key: 'track', label: 'Track' }, { key: 'laps', label: 'Laps' }, { key: 'winner', label: 'Winner' }, { key: 'pole', label: 'Pole' }]}
  />
)
export const IndyResultsPage = () => <PageShell league="indycar" title="GRR IndyCar Race Results" eyebrow="Season 1"><RaceResultsExplorer title="GRR IndyCar Race Results" loader={indyRaceEvents} /></PageShell>
