import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable, EmptyTableRow } from '../../components/league/DataTable'
import { CupSportingCode } from '../../components/league/CupSportingCode'
import { GtSportingCode } from '../../components/league/GtSportingCode'
import { LiveDataTable, type LiveColumn } from '../../components/league/LiveDataTable'
import { RaceResultsExplorer } from '../../components/league/RaceResultsExplorer'
import { LeagueCountdown } from '../../components/league/LeagueCountdown'
import { LeaguePhotoRails } from '../../components/league/LeaguePhotoRails'
import { LeagueOverview } from '../../components/league/LeagueOverview'
import { LeagueNav, type LeagueNavItem } from '../../components/league/LeagueNav'
import { PageMeta } from '../../components/league/PageMeta'
import { EmptyState } from '../../components/league/States'
import { externalLinks } from '../../config/site'
import { cupSchedule as cupCalendar, indycarSchedule as indyCalendar } from '../../config/schedules'
import {
  cupRaceEvents,
  cupSchedule,
  cupStandings,
  gtRaceEvents,
  gtSchedule,
  gtStandings,
  gtTeamStandings,
  indyRaceEvents,
  indySchedule,
  indyStandings,
} from '../../services/dataSources'
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
  { label: 'IndyCar Sporting Code', href: '/pages/indycar-sporting-code' },
  { label: 'IndyCar Standings', href: '/pages/indycar-standings' },
  { label: 'IndyCar Schedule', href: '/pages/indycar-schedule' },
  { label: 'IndyCar Race Results', href: '/pages/indycar-results' },
]

type LeagueKey = 'cup' | 'gt' | 'indycar'
const leagueConfig = {
  cup: {
    label: 'Cup Series',
    nav: cupNav,
    image: '/assets/home/cup-series.webp',
    imagePosition: 'center 56%',
    schedule: cupCalendar,
  },
  gt: {
    label: 'GT League',
    nav: gtNav,
    image: '/assets/home/gt-league.webp',
    imagePosition: 'center 48%',
    loader: gtSchedule,
  },
  indycar: {
    label: 'IndyCar',
    nav: indyNav,
    image: '/assets/home/indycar.webp',
    imagePosition: 'center 57%',
    schedule: indyCalendar,
  },
} as const
const cupOverviewStandings = [{ loader: cupStandings }]
const gtOverviewStandings = [
  { label: 'GT3 AM', loader: gtStandings('am') },
  { label: 'GT3 Pro', loader: gtStandings('pro') },
  { label: 'GTP', loader: gtStandings('gtp') },
]
const indyOverviewStandings = [{ loader: indyStandings }]

function PageShell({
  league,
  title,
  eyebrow,
  compact = false,
  children,
}: {
  league: LeagueKey
  title: string
  eyebrow?: string
  compact?: boolean
  children: React.ReactNode
}) {
  const config = leagueConfig[league]
  return (
    <>
      <PageMeta title={title} description={title} />
      <LeagueNav label={config.label} items={config.nav} />
      <aside className="league-race-banner">
        <LeagueCountdown
          leagueLabel={config.label}
          variant="banner"
          schedule={'schedule' in config ? config.schedule : undefined}
          loader={'loader' in config ? config.loader : undefined}
        />
      </aside>
      <header
        className={`page-hero page-hero--${league}${compact ? ' page-hero--compact' : ''}`}
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(3, 8, 3, 0.9), rgba(8, 16, 8, 0.7) 52%, rgba(8, 16, 8, 0.5)), url(${config.image})`,
          backgroundPosition: config.imagePosition,
        }}
      >
        <div className="container">
          <p className="eyebrow">{eyebrow ?? config.label}</p>
          <h1>{title}</h1>
        </div>
      </header>
      <LeaguePhotoRails league={league} />
      <div
        className={
          compact ? 'page-content page-content--compact container' : 'page-content container'
        }
      >
        {children}
      </div>
    </>
  )
}

function DiscordCallout() {
  return (
    <aside className="league-callout">
      <h2>Wanna race? Register in our Discord for free!</h2>
      <a
        className="button discord-button"
        href={externalLinks.discord}
        target="_blank"
        rel="noreferrer"
      >
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
      <LeagueOverview
        standings={cupOverviewStandings}
        results={cupRaceEvents}
        standingsHref="/pages/cupstandings"
        resultsHref="/pages/cup-latest-race-results"
      />
      <DiscordCallout />
    </PageShell>
  )
}
export function GtLandingPage() {
  return (
    <PageShell league="gt" title="GRR GT League">
      <LinkGrid links={gtNav.slice(1)} />
      <LeagueOverview
        standings={gtOverviewStandings}
        results={gtRaceEvents}
        standingsHref="/pages/gt-standings"
        resultsHref="/pages/gt-race-results"
        multiClass
      />
      <DiscordCallout />
    </PageShell>
  )
}
export function IndyLandingPage() {
  return (
    <PageShell league="indycar" title="GRR IndyCar League">
      <LinkGrid links={indyNav} />
      <LeagueOverview
        standings={indyOverviewStandings}
        results={indyRaceEvents}
        standingsHref="/pages/indycar-standings"
        resultsHref="/pages/indycar-results"
      />
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
    <PageShell league="gt" title="GT League Sporting Code" eyebrow="GT3/GTP competition handbook">
      <GtSportingCode />
    </PageShell>
  )
}

export function IndySportingCodePage() {
  return (
    <PageShell league="indycar" title="GRR IndyCar Sporting Code">
      <EmptyState title="IndyCar Sporting Code Coming Soon!" />
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
  tableClassName?: string
}
function DataPage({
  league,
  title,
  eyebrow,
  columns,
  filters,
  search,
  caption,
  loader,
  loaders,
  rowClassName,
  note,
  tableClassName,
}: DataPageProps) {
  const [activeFilter, setActiveFilter] = useState(0)
  const activeLoader = loaders?.[activeFilter] ?? loader
  return (
    <PageShell league={league} title={title} eyebrow={eyebrow} compact>
      {filters && (
        <div className="data-toolbar">
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
        </div>
      )}
      {note && <p className="standings-legend">{note}</p>}
      {activeLoader ? (
        <LiveDataTable
          key={activeFilter}
          title={caption ?? title}
          columns={columns}
          loader={activeLoader}
          search={search}
          rowClassName={rowClassName}
          tableClassName={tableClassName}
        />
      ) : (
        <DataTable
          caption={caption ?? title}
          columns={columns.map((column) => column.label)}
          className={tableClassName}
        >
          <EmptyTableRow
            columns={columns.length}
            message="TODO(integration): Confirm the current public data endpoint before connecting this table."
          />
        </DataTable>
      )}
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
    note="Positions 1–16 are currently in the Chase. The green line marks the cutoff."
    rowClassName={(row) =>
      Number(row.rank) === 17
        ? 'standings-row--cutline'
        : Number(row.rank) <= 16
          ? 'standings-row--chase'
          : ''
    }
    columns={[
      { key: 'rank', label: 'Pos' },
      { key: 'driver', label: 'Driver' },
      { key: 'points', label: 'Pts' },
      {
        key: 'cutoff',
        label: '+/- Cutoff',
        cellClassName: (value) =>
          Number(value) >= 100
            ? 'cutoff-value cutoff-value--safe'
            : Number(value) <= -100
              ? 'cutoff-value cutoff-value--danger'
              : 'cutoff-value cutoff-value--close',
      },
      { key: 'starts', label: 'Starts' },
      { key: 'wins', label: 'W' },
      { key: 'stageWins', label: 'Stg W' },
      { key: 'poles', label: 'Poles' },
      { key: 'top5', label: 'T5' },
      { key: 'top10', label: 'T10' },
      { key: 'lapsLed', label: 'Led' },
      { key: 'link', label: 'Link', link: true },
    ]}
  />
)
export const CupSchedulePage = () => (
  <DataPage
    league="cup"
    title="GRR Cup Series 2026 Calendar"
    eyebrow="Race schedule, winners, and pole sitters"
    loader={cupSchedule}
    columns={[
      { key: 'round', label: 'Rd' },
      { key: 'date', label: 'Date' },
      { key: 'track', label: 'Track' },
      { key: 'type', label: 'Type' },
      { key: 'winner', label: 'Winner' },
      { key: 'pole', label: 'Pole' },
    ]}
  />
)
const cupResultColumns: LiveColumn[] = [
  { key: 'position', label: 'Pos' },
  { key: 'driver', label: 'Driver' },
  { key: 'start', label: 'Start' },
  { key: 'interval', label: 'Int' },
  { key: 'laps', label: 'Laps' },
  { key: 'led', label: 'Led' },
  { key: 'racePoints', label: 'Race Pts' },
  { key: 'stagePoints', label: 'Stg Pts' },
  { key: 'total', label: 'Total Points' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'penalty', label: 'Pen' },
  { key: 'incidents', label: 'Inc' },
  { key: 'status', label: 'Status' },
]
export const CupResultsPage = () => (
  <PageShell league="cup" title="GRR Cup Series Race Results" eyebrow="GRR Cup Series 2026" compact>
    <RaceResultsExplorer
      title="GRR Cup Series Race Results"
      loader={cupRaceEvents}
      columns={cupResultColumns}
    />
  </PageShell>
)
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
    rowClassName={(row) =>
      row.state === 'next' ? 'schedule-row--next' : row.state === 'done' ? 'schedule-row--done' : ''
    }
    columns={[
      { key: 'round', label: 'Round' },
      { key: 'date', label: 'Date' },
      { key: 'track', label: 'Track' },
      { key: 'am', label: 'GT3 AM Winner' },
      { key: 'pro', label: 'GT3 Pro Winner' },
      { key: 'gtp', label: 'GTP Winner' },
    ]}
  />
)
export const GtStandingsPage = () => (
  <DataPage
    league="gt"
    title="GT League Standings"
    filters={['GT3 AM', 'GT3 Pro', 'GTP']}
    loaders={[gtStandings('am'), gtStandings('pro'), gtStandings('gtp')]}
    search
    tableClassName="data-table--gt-standings"
    columns={[
      { key: 'rank', label: 'Rank' },
      { key: 'driver', label: 'Driver' },
      { key: 'car', label: 'Car' },
      { key: 'starts', label: 'Race Starts' },
      { key: 'points', label: 'Points' },
      { key: 'behindLeader', label: 'Behind Leader' },
      { key: 'wins', label: 'Wins' },
      { key: 'podiums', label: 'Podiums' },
    ]}
  />
)
export const GtTeamStandingsPage = () => (
  <DataPage
    league="gt"
    title="GT League Team Standings"
    filters={['GT3 AM', 'GT3 Pro', 'GTP']}
    loaders={[gtTeamStandings('am'), gtTeamStandings('pro'), gtTeamStandings('gtp')]}
    search
    tableClassName="data-table--gt-standings"
    columns={[
      { key: 'rank', label: 'Rank' },
      { key: 'driver', label: 'Team' },
      { key: 'car', label: 'Car' },
      { key: 'starts', label: 'Race Starts' },
      { key: 'points', label: 'Points' },
      { key: 'behindLeader', label: 'Behind Leader' },
      { key: 'wins', label: 'Wins' },
      { key: 'podiums', label: 'Podiums' },
    ]}
  />
)
const gtResultColumns: LiveColumn[] = [
  { key: 'position', label: 'Class Pos' },
  { key: 'driver', label: 'Driver' },
  { key: 'car', label: 'Car' },
  { key: 'start', label: 'Start' },
  { key: 'interval', label: 'Int' },
  { key: 'laps', label: 'Laps' },
  { key: 'racePoints', label: 'Race Pts' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'penalty', label: 'Pen' },
  { key: 'total', label: 'Total' },
  { key: 'incidents', label: 'Inc' },
  { key: 'status', label: 'Status' },
]
const gtOverallResultColumns: LiveColumn[] = [
  { key: 'position', label: 'Overall Pos' },
  { key: 'driver', label: 'Driver' },
  { key: 'class', label: 'Class' },
  { key: 'car', label: 'Car' },
  { key: 'start', label: 'Start' },
  { key: 'interval', label: 'Int' },
  { key: 'laps', label: 'Laps' },
  { key: 'racePoints', label: 'Race Pts' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'penalty', label: 'Pen' },
  { key: 'total', label: 'Total' },
  { key: 'incidents', label: 'Inc' },
  { key: 'status', label: 'Status' },
]
export const GtResultsPage = () => (
  <PageShell league="gt" title="GT League Race Results" compact>
    <RaceResultsExplorer
      title="GT League Race Results"
      loader={gtRaceEvents}
      columns={gtResultColumns}
      secondaryColumns={gtResultColumns}
      overallColumns={gtOverallResultColumns}
    />
  </PageShell>
)

export const IndyStandingsPage = () => (
  <DataPage
    league="indycar"
    title="GRR IndyCar Standings"
    eyebrow="Season 1"
    loader={indyStandings}
    search
    columns={[
      { key: 'rank', label: 'Pos' },
      { key: 'driver', label: 'Driver' },
      { key: 'points', label: 'Pts' },
      { key: 'starts', label: 'Starts' },
      { key: 'wins', label: 'W' },
      { key: 'poles', label: 'Poles' },
      { key: 'top5', label: 'T5' },
      { key: 'top10', label: 'T10' },
      { key: 'lapsLed', label: 'Led' },
    ]}
  />
)
export const IndySchedulePage = () => (
  <DataPage
    league="indycar"
    title="GRR IndyCar Schedule"
    eyebrow="Race schedule, distances, winners, and pole sitters"
    loader={indySchedule}
    columns={[
      { key: 'round', label: 'Rd' },
      { key: 'date', label: 'Date' },
      { key: 'track', label: 'Track' },
      { key: 'laps', label: 'Laps' },
      { key: 'winner', label: 'Winner' },
      { key: 'pole', label: 'Pole' },
    ]}
  />
)
const indyResultColumns: LiveColumn[] = [
  { key: 'position', label: 'Pos' },
  { key: 'driver', label: 'Driver' },
  { key: 'start', label: 'Start' },
  { key: 'interval', label: 'Int' },
  { key: 'laps', label: 'Laps' },
  { key: 'led', label: 'Led' },
  { key: 'racePoints', label: 'Race Pts' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'penalty', label: 'Pen' },
  { key: 'total', label: 'Total' },
  { key: 'incidents', label: 'Inc' },
  { key: 'status', label: 'Status' },
]
export const IndyResultsPage = () => (
  <PageShell league="indycar" title="GRR IndyCar Race Results" eyebrow="Season 1" compact>
    <RaceResultsExplorer
      title="GRR IndyCar Race Results"
      loader={indyRaceEvents}
      columns={indyResultColumns}
    />
  </PageShell>
)
