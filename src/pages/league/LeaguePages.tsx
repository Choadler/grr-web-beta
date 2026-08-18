import { useEffect, useMemo, useState } from 'react'
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
  cupCareer,
  cupHistoricalStats,
  cupHistory,
  cupSchedule,
  cupStandings,
  gtRaceEvents,
  gtHistoricalRecords,
  gtHistoricalStats,
  gtCareer,
  gtHistory,
  gtSchedule,
  gtStandings,
  gtTeamStandings,
  indyRaceEvents,
  indySchedule,
  indyStandings,
} from '../../services/dataSources'
import type { DataLoader } from '../../types/league'
import type { TableRow } from '../../types/league'
import type { GtCareerProfile } from '../../services/dataSources'
import { shareGtCareerImage } from '../../utils/gtCareerExport'

const cupNav: LeagueNavItem[] = [
  { label: 'Cup Sporting Code', href: '/pages/cup-series-sporting-code' },
  { label: 'Cup Schedule', href: '/pages/cup-series-schedule' },
  { label: 'Cup Standings', href: '/pages/cupstandings' },
  { label: 'Cup Race Results', href: '/pages/cup-latest-race-results' },
  { label: 'Cup Stats', href: '/pages/cup-stats' },
  { label: 'Cup Archive', href: '/pages/cup-archive' },
  { label: 'Cup Broadcast', href: '/pages/broadcast' },
]
const gtNav: LeagueNavItem[] = [
  { label: 'GT Home', href: '/pages/gt-league' },
  { label: 'GT Rules', href: '/pages/gt-rules' },
  { label: 'GT Schedule', href: '/pages/gt-schedule' },
  { label: 'GT Standings', href: '/pages/gt-standings' },
  { label: 'GT Race Results', href: '/pages/gt-race-results' },
  { label: 'GT Stats', href: '/pages/gt-stats' },
  { label: 'GT Archive', href: '/pages/gt-archive' },
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
const indyOverviewStandings = [{ loader: indyStandings }]

type GtSeasonSummary = {
  id: string
  name: string
  status: string
  champions?: { classKey: string; classLabel: string; driver: string }[]
}

type CupSeasonSummary = { id: string; name: string; status: string; champion?: string; races?: number; drivers?: number }
function useCupSeasons() {
  const [seasons, setSeasons] = useState<CupSeasonSummary[]>([])
  useEffect(() => { const controller = new AbortController(); fetch('/api/cup?list=seasons', { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((payload: { seasons?: CupSeasonSummary[] }) => setSeasons(payload.seasons ?? [])).catch(() => undefined); return () => controller.abort() }, [])
  return seasons
}

function useGtSeasons() {
  const [seasons, setSeasons] = useState<GtSeasonSummary[]>([])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/gt?list=seasons', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Season list unavailable')))
      .then((payload: { seasons?: GtSeasonSummary[] }) => setSeasons(payload.seasons ?? []))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  return seasons
}

function useGtSeasonClasses() {
  const fallback = [
    { key: 'gt3-am' as const, label: 'GT3 AM' },
    { key: 'gt3-pro' as const, label: 'GT3 Pro' },
    { key: 'gtp' as const, label: 'GTP' },
  ]
  const [classes, setClasses] = useState(fallback)
  useEffect(() => {
    const controller = new AbortController()
    const season = new URLSearchParams(window.location.search).get('season')
    fetch(`/api/gt?list=classes${season ? `&season=${encodeURIComponent(season)}` : ''}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Class list unavailable')))
      .then((payload: { classes?: typeof fallback }) => { if (payload.classes?.length) setClasses(payload.classes) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  return classes
}

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

function GtArchiveSection() {
  const seasons = useGtSeasons().filter((season) => season.status !== 'active')
  if (!seasons.length) return <EmptyState title="No archived GT seasons are available yet." />
  return <section className="gt-archive" aria-labelledby="gt-archive-title">
    <div className="section-heading"><p className="eyebrow">Season history</p><h2 id="gt-archive-title">Past GT Seasons</h2></div>
    <div className="gt-archive-grid">
      {seasons.map((season: GtSeasonSummary) => <article className="gt-archive-card" key={season.id}>
        <div className="gt-archive-card__heading"><span>Archived season</span><h3>{season.name}</h3></div>
        <div className="gt-archive-champions" aria-label={`${season.name} champions`}>
          {season.champions?.map((champion) => <div key={champion.classKey}>
            <span>{champion.classLabel} Champion</span><strong>{champion.driver}</strong>
          </div>)}
        </div>
        <div className="gt-archive-links">
          <Link to={`/pages/gt-standings?season=${encodeURIComponent(season.id)}`}>Standings <span aria-hidden="true">→</span></Link>
          <Link to={`/pages/gt-schedule?season=${encodeURIComponent(season.id)}`}>Schedule <span aria-hidden="true">→</span></Link>
          <Link to={`/pages/gt-race-results?season=${encodeURIComponent(season.id)}`}>Race Results <span aria-hidden="true">→</span></Link>
        </div>
      </article>)}
    </div>
  </section>
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
  const classes = useGtSeasonClasses()
  const standings = classes.map((item) => ({ label: item.label, loader: gtStandings(item.key) }))
  return (
    <PageShell league="gt" title="GRR GT League">
      <LinkGrid links={gtNav.slice(1)} />
      <LeagueOverview
        standings={standings}
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
  rowLink?: (row: TableRow) => string | undefined
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
  rowLink,
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
          rowLink={rowLink}
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

export const CupStandingsPage = () => {
  const historical = new URLSearchParams(window.location.search).has('season')
  return <DataPage
    league="cup"
    title="GRR Cup Series Standings"
    eyebrow="GRR Cup Series 2026"
    search
    loader={cupStandings}
    note={historical ? undefined : 'Positions 1–16 are currently in the Chase. The green line marks the cutoff.'}
    rowClassName={(row) =>
      historical ? '' : Number(row.rank) === 17
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
}
export const CupSchedulePage = () => (
  <DataPage
    league="cup"
    title="GRR Cup Series 2026 Calendar"
    eyebrow="Race schedule, winners, and pole sitters"
    loader={cupSchedule}
    rowLink={(row) => typeof row.resultsUrl === 'string' ? row.resultsUrl : undefined}
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
      league="cup"
      title="GRR Cup Series Race Results"
      loader={cupRaceEvents}
      columns={cupResultColumns}
    />
  </PageShell>
)

function CupCareerSearch() {
  const [drivers, setDrivers] = useState<Record<string, string | number | null>[]>([])
  const initialDriver = new URLSearchParams(window.location.search).get('driver') ?? ''
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(initialDriver)
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof cupCareer>> | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(initialDriver ? 'loading' : 'ready')
  useEffect(() => { const controller = new AbortController(); cupHistory(controller.signal).then((payload) => setDrivers(payload.stats)).catch(() => undefined); return () => controller.abort() }, [])
  useEffect(() => { if (!selected) return; const controller = new AbortController(); cupCareer(selected, controller.signal).then((value) => { setProfile(value); setStatus('ready') }).catch(() => { if (!controller.signal.aborted) setStatus('error') }); return () => controller.abort() }, [selected])
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return []
    return drivers.filter((driver) => String(driver.driver).toLocaleLowerCase().includes(needle)).slice(0, 8)
  }, [drivers, query])
  const selectDriver = (driverKey: string) => {
    setStatus('loading')
    setProfile(null)
    setSelected(driverKey)
    setQuery('')
    const url = new URL(window.location.href)
    url.searchParams.set('driver', driverKey)
    window.history.replaceState({}, '', url)
  }
  const metric = (key: string) => String(profile?.[key] ?? '—')
  return <section className="gt-career-search" aria-labelledby="cup-career-title"><div className="gt-career-search__heading"><p className="eyebrow">Driver lookup</p><h2 id="cup-career-title">GRR Cup Career Summary</h2><p>Search every driver with an imported Cup start.</p></div>
    <div className="gt-driver-lookup">
      <label><span>Search drivers</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a driver name..." autoComplete="off" /></label>
      {matches.length > 0 && <div className="gt-driver-matches">{matches.map((driver) => <button type="button" key={String(driver.driverKey)} onClick={() => selectDriver(String(driver.driverKey))}><strong>{driver.driver}</strong><span>{driver.starts} starts · {driver.wins} wins</span></button>)}</div>}
    </div>
    {status === 'loading' && <p className="data-note">Loading career summary...</p>}
    {status === 'error' && <EmptyState title="That driver’s career summary is unavailable." />}
    {profile && status === 'ready' && <article className="gt-career-profile"><header className="gt-career-profile__header"><div><p className="eyebrow">Cup Series career</p><h3>{profile.driver}</h3><p>{profile.seasonsEntered} seasons</p></div><strong>{profile.championships}<span>Championship{profile.championships === 1 ? '' : 's'}</span></strong></header>
      <div className="gt-career-metrics">{[['starts','Starts'],['wins','Wins'],['poles','Poles'],['top5','Top 5s'],['top10','Top 10s'],['lapsLed','Laps Led'],['averageFinish','Avg Finish'],['bestFinish','Best Finish']].map(([key,label])=><div key={key}><strong>{metric(key)}</strong><span>{label}</span></div>)}</div>
      <div className="gt-career-details"><section><h4>Season History</h4>{profile.seasons.map((season)=><div className="gt-career-row" key={String(season.seasonId)}><strong>{season.season}</strong><span>P{season.championshipPosition ?? '—'} · {season.starts} starts · {season.wins} wins · {season.points} pts</span></div>)}</section></div>
    </article>}
  </section>
}

export const CupStatsPage = () => <PageShell league="cup" title="Cup Series Stats" eyebrow="All-time driver statistics and lookup" compact><CupCareerSearch /><LiveDataTable title="Cup Series Career Statistics" loader={cupHistoricalStats} search tableClassName="data-table--gt-history" columns={[
  { key:'driver',label:'Driver' },{ key:'seasons',label:'Seasons' },{ key:'starts',label:'Starts' },{ key:'wins',label:'Wins' },{ key:'poles',label:'Poles' },{ key:'top5',label:'Top 5' },{ key:'top10',label:'Top 10' },{ key:'lapsLed',label:'Laps Led' },{ key:'averageFinish',label:'Avg Finish' },
]} /></PageShell>

export const CupArchivePage = () => {
  const seasons = useCupSeasons().filter((season) => season.status !== 'active')
  return <PageShell league="cup" title="Cup Series Archive" eyebrow="Historical seasons, standings, schedules, and race results" compact><p className="gt-archive-intro">Explore imported GRR Cup seasons and permanent competition records.</p><section className="gt-archive"><div className="gt-archive-grid">{seasons.map((season)=><article className="gt-archive-card" key={season.id}><div className="gt-archive-card__heading"><span>{season.status} season</span><h3>{season.name}</h3></div><div className="gt-archive-champions"><div><span>Champion</span><strong>{season.champion ?? 'Not determined'}</strong></div><div><span>Record</span><strong>{season.races ?? 0} races · {season.drivers ?? 0} drivers</strong></div></div><div className="gt-archive-links"><Link to={`/pages/cupstandings?season=${season.id}`}>Standings <span>→</span></Link><Link to={`/pages/cup-series-schedule?season=${season.id}`}>Schedule <span>→</span></Link><Link to={`/pages/cup-latest-race-results?season=${season.id}`}>Race Results <span>→</span></Link></div></article>)}</div></section></PageShell>
}
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

export const GtSchedulePage = () => {
  const classes = useGtSeasonClasses()
  const winnerKey = { 'gt3-am': 'am', 'gt3-pro': 'pro', gtp: 'gtp' } as const
  return <DataPage
    league="gt"
    title="GT League Schedule"
    loader={gtSchedule}
    rowLink={(row) => typeof row.resultsUrl === 'string' ? row.resultsUrl : undefined}
    rowClassName={(row) =>
      row.state === 'next' ? 'schedule-row--next' : row.state === 'done' ? 'schedule-row--done' : ''
    }
    columns={[
      { key: 'round', label: 'Round' },
      { key: 'date', label: 'Date' },
      { key: 'track', label: 'Track' },
      ...classes.map((item) => ({ key: winnerKey[item.key], label: `${item.label} Winner` })),
    ]}
  />
}
const gtDriverStandingsColumns: LiveColumn[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'driver', label: 'Driver' },
  { key: 'car', label: 'Car' },
  { key: 'starts', label: 'Race Starts' },
  { key: 'points', label: 'Points' },
  { key: 'behindLeader', label: 'Behind Leader' },
  { key: 'wins', label: 'Wins' },
  { key: 'podiums', label: 'Podiums' },
]
const gtTeamStandingsColumns: LiveColumn[] = gtDriverStandingsColumns.map((column) =>
  column.key === 'driver' ? { ...column, label: 'Team' } : column,
)

export const GtStandingsPage = () => {
  const classes = useGtSeasonClasses()
  const [mode, setMode] = useState<'driver' | 'team'>('driver')
  const [activeClass, setActiveClass] = useState(0)
  const selectedClass = classes[activeClass] ?? classes[0]
  const isTeam = mode === 'team'
  const title = `GT League ${selectedClass?.label ?? ''} ${isTeam ? 'Team' : 'Driver'} Standings`

  return <PageShell league="gt" title="GT League Standings" compact>
    <div className="data-toolbar standings-view-controls">
      <fieldset className="filter-group standings-mode-switch">
        <legend>Standings type</legend>
        {(['driver', 'team'] as const).map((item) => <button
          className={item === mode ? 'filter-button is-active' : 'filter-button'}
          type="button"
          key={item}
          onClick={() => setMode(item)}
          aria-pressed={item === mode}
        >
          {item}
        </button>)}
      </fieldset>
      <fieldset className="filter-group">
        <legend>GT class</legend>
        {classes.map((item, index) => <button
          className={index === activeClass ? 'filter-button is-active' : 'filter-button'}
          type="button"
          key={item.key}
          onClick={() => setActiveClass(index)}
          aria-pressed={index === activeClass}
        >
          {item.label}
        </button>)}
      </fieldset>
    </div>
    {selectedClass && <LiveDataTable
      key={`${mode}-${selectedClass.key}`}
      title={title}
      columns={isTeam ? gtTeamStandingsColumns : gtDriverStandingsColumns}
      loader={isTeam ? gtTeamStandings(selectedClass.key) : gtStandings(selectedClass.key)}
      search
      tableClassName="data-table--gt-standings"
    />}
  </PageShell>
}
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
      league="gt"
      title="GT League Race Results"
      loader={gtRaceEvents}
      columns={gtResultColumns}
      secondaryColumns={gtResultColumns}
      overallColumns={gtOverallResultColumns}
      overallPngOptions={{ preset: 'gt-overall-discord' }}
    />
  </PageShell>
)

function GtCareerSearch() {
  const initialDriver = new URLSearchParams(window.location.search).get('driver') ?? ''
  const [drivers, setDrivers] = useState<Record<string, string | number>[]>([])
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState(initialDriver)
  const [profile, setProfile] = useState<GtCareerProfile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(initialDriver ? 'loading' : 'ready')
  const [shareStatus, setShareStatus] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    gtHistory(controller.signal).then((payload) => setDrivers(payload.stats)).catch(() => undefined)
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!selectedKey) return
    const controller = new AbortController()
    gtCareer(selectedKey, controller.signal)
      .then((value) => { setProfile(value); setStatus('ready') })
      .catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [selectedKey])
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return drivers.filter((driver) => String(driver.driver).toLowerCase().includes(needle)).slice(0, 8)
  }, [drivers, query])
  const selectDriver = (driverKey: string) => {
    setStatus('loading')
    setProfile(null)
    setSelectedKey(driverKey)
    setQuery('')
    setShareStatus('')
    const url = new URL(window.location.href)
    url.searchParams.set('driver', driverKey)
    window.history.replaceState({}, '', url)
  }
  return <section className="gt-career-search" aria-labelledby="gt-career-title">
    <div className="gt-career-search__heading"><p className="eyebrow">Driver lookup</p><h2 id="gt-career-title">GRR GT League Career Summary</h2><p>Search any driver with a recorded GT League start.</p></div>
    <div className="gt-driver-lookup">
      <label><span>Search drivers</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a driver name..." /></label>
      {matches.length > 0 && <div className="gt-driver-matches">{matches.map((driver) => <button type="button" key={driver.driverKey} onClick={() => selectDriver(String(driver.driverKey))}><strong>{driver.driver}</strong><span>{driver.starts} starts · {driver.wins} wins</span></button>)}</div>}
    </div>
    {status === 'loading' && <p className="data-note">Loading career summary...</p>}
    {status === 'error' && <EmptyState title="That driver’s career summary is unavailable." />}
    {profile && status === 'ready' && <article className="gt-career-profile">
      <header className="gt-career-profile__header"><div><p className="eyebrow">GT League career</p><h3>{profile.driver}</h3><p>{profile.seasonsEntered} seasons · {profile.classes.map((item) => item.classLabel).join(' · ')}</p></div><strong>{profile.championships}<span>Championship{profile.championships === 1 ? '' : 's'}</span></strong></header>
      <div className="gt-career-metrics">{[
        ['Starts', profile.starts], ['Wins', profile.wins], ['Podiums', profile.podiums], ['Poles', profile.poles], ['Fastest Laps', profile.fastestLaps], ['Avg Finish', profile.averageFinish], ['Laps', profile.laps.toLocaleString()], ['Points', profile.points.toLocaleString()],
      ].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      {(profile.cars.length > 0 || profile.teams.length > 0) && <div className="gt-career-affiliations">
        {profile.cars.length > 0 && <p><span>Cars</span>{profile.cars.join(' · ')}</p>}
        {profile.teams.length > 0 && <p><span>Teams</span>{profile.teams.join(' · ')}</p>}
      </div>}
      <div className="gt-career-details">
        <section><h4>By Class</h4>{profile.classes.map((item) => <div className="gt-career-row" key={item.classKey}><strong>{item.classLabel}</strong><span>{item.starts} starts · {item.wins} wins · {item.podiums} podiums</span></div>)}</section>
        <section><h4>Championship History</h4>{profile.seasons.map((item) => <div className="gt-career-row" key={item.key}><strong>{item.season} · {item.classLabel}</strong><span>P{item.championshipPosition} · {item.wins} wins · {item.points} pts</span></div>)}</section>
        <section><h4>Top Circuits</h4>{profile.tracks.map((item) => <div className="gt-career-row" key={item.track}><strong>{item.track}</strong><span>{item.starts} starts · {item.wins} wins · {item.podiums} podiums</span></div>)}</section>
      </div>
      <div className="gt-career-actions"><button className="button" type="button" onClick={async () => { const result = await shareGtCareerImage(profile); setShareStatus(result === 'copied' ? 'Career image copied for Discord.' : 'Career image downloaded.') }}>Copy Discord Image</button><button className="button button--secondary" type="button" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => setShareStatus('Career profile link copied.')).catch(() => setShareStatus('Could not copy the profile link.'))}>Copy Profile Link</button><span role="status">{shareStatus}</span></div>
    </article>}
  </section>
}

export const GtStatsPage = () => {
  const [view, setView] = useState<'stats' | 'records'>(() =>
    new URLSearchParams(window.location.search).get('view') === 'records' ? 'records' : 'stats',
  )
  const selectView = (nextView: 'stats' | 'records') => {
    setView(nextView)
    const url = new URL(window.location.href)
    if (nextView === 'records') url.searchParams.set('view', 'records')
    else url.searchParams.delete('view')
    window.history.replaceState({}, '', url)
  }
  return <PageShell league="gt" title="GT League Stats" eyebrow="Career statistics and class records" compact>
    <GtCareerSearch />
    <section className="gt-stats-browser" aria-labelledby="gt-stats-view-title">
      <div className="gt-stats-browser__header">
        <div><p className="eyebrow">GT League history</p><h2 id="gt-stats-view-title">{view === 'stats' ? 'GT Career Statistics' : 'GT Class Records'}</h2></div>
        <div className="filter-group" role="group" aria-label="GT statistics view">
          <button className={view === 'stats' ? 'filter-button is-active' : 'filter-button'} aria-pressed={view === 'stats'} type="button" onClick={() => selectView('stats')}>Driver Stats</button>
          <button className={view === 'records' ? 'filter-button is-active' : 'filter-button'} aria-pressed={view === 'records'} type="button" onClick={() => selectView('records')}>League Records</button>
        </div>
      </div>
      {view === 'stats' ? <LiveDataTable title="GT League Career Statistics" loader={gtHistoricalStats} search tableClassName="data-table--gt-history" columns={[
        { key: 'rank', label: 'Rank' }, { key: 'driver', label: 'Driver' }, { key: 'classes', label: 'Classes' }, { key: 'seasons', label: 'Seasons' }, { key: 'starts', label: 'Starts' }, { key: 'wins', label: 'Wins' }, { key: 'podiums', label: 'Podiums' }, { key: 'poles', label: 'Poles' }, { key: 'fastestLaps', label: 'Fastest Laps' }, { key: 'points', label: 'Points' },
      ]} /> : <LiveDataTable title="GT League Records" loader={gtHistoricalRecords} tableClassName="data-table--gt-history" columns={[
        { key: 'class', label: 'Class' }, { key: 'record', label: 'Record' }, { key: 'driver', label: 'Driver' }, { key: 'total', label: 'Total' },
      ]} />}
    </section>
  </PageShell>
}
export const GtArchivePage = () => <PageShell league="gt" title="GT League Archive" eyebrow="Historical seasons, standings, schedules, and race results" compact>
  <p className="gt-archive-intro">Explore every completed GT League season and its permanent competition records.</p>
  <GtArchiveSection />
</PageShell>

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
    rowLink={(row) => typeof row.resultsUrl === 'string' ? row.resultsUrl : undefined}
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
      league="indycar"
      title="GRR IndyCar Race Results"
      loader={indyRaceEvents}
      columns={indyResultColumns}
    />
  </PageShell>
)
