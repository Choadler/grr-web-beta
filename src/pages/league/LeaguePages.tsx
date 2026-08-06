import { Link } from 'react-router-dom'
import { DataTable, EmptyTableRow } from '../../components/league/DataTable'
import { LeagueNav, type LeagueNavItem } from '../../components/league/LeagueNav'
import { PageMeta } from '../../components/league/PageMeta'
import { EmptyState } from '../../components/league/States'
import { externalLinks } from '../../config/site'

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

const cupSections = [
  [
    '1. Introduction',
    'The GRR Cup Series is committed to fair, competitive, and enjoyable racing. Every participant must follow this sporting code. Violations may result in penalties.',
  ],
  [
    '2. General Conduct',
    'Drivers must race fairly, respectfully, and professionally. Reckless or needlessly aggressive driving will not be tolerated.',
  ],
  ['3. Season / Race Rules', 'The 2026 regular season is 26 weeks, followed by a 10-race Chase.'],
  [
    '4. Car Setups / Liveries',
    'Open setups are permitted within iRacing’s rules. All setups must be legal.',
  ],
  [
    '5. License Points and Penalties',
    'The league uses license points to track driver behavior during races.',
  ],
  [
    '6. Scoring System',
    'Race points combine finishing position, stage performance, and eligible bonuses.',
  ],
  [
    '7. Filing a Protest',
    'Protests are filed through the protest channel in the league’s Discord server.',
  ],
  ['8. Teams (Optional)', 'Each team may consist of up to four full-time drivers.'],
  ['9. League and Admin Authority', 'The race director and appointed stewards enforce the rules.'],
  ['10. Conclusion', 'Participation in the GRR Cup Series means accepting this sporting code.'],
] as const

export function CupSportingCodePage() {
  return (
    <PageShell
      league="cup"
      title="GRR Cup Sporting Code"
      eyebrow="Rules, procedures, scoring and penalties"
    >
      <div className="sporting-layout">
        <nav className="sporting-index" aria-label="Sporting code sections">
          {cupSections.map(([heading], index) => (
            <a href={`#cup-section-${index + 1}`} key={heading}>
              {heading}
            </a>
          ))}
        </nav>
        <article className="sporting-code">
          {cupSections.map(([heading, copy], index) => (
            <section id={`cup-section-${index + 1}`} key={heading}>
              <h2>{heading}</h2>
              <p>{copy}</p>
              {index === 4 && (
                <DataTable caption="Incident limits" columns={['Incident Count', 'Penalty']}>
                  <tr>
                    <td>17x</td>
                    <td>Drive-through and 2 LP</td>
                  </tr>
                  <tr>
                    <td>25x</td>
                    <td>Disqualification and 5 LP</td>
                  </tr>
                </DataTable>
              )}
              {index === 9 && (
                <p className="todo-note">
                  TODO(content): Complete line-by-line verification of the remaining current
                  sporting-code clauses before production migration.
                </p>
              )}
            </section>
          ))}
        </article>
      </div>
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
  columns: string[]
  filters?: string[]
  search?: boolean
  caption?: string
}
function DataPage({ league, title, eyebrow, columns, filters, search, caption }: DataPageProps) {
  return (
    <PageShell league={league} title={title} eyebrow={eyebrow}>
      <div className="data-toolbar">
        {search && (
          <label className="search-field">
            <span>Search driver</span>
            <input type="search" placeholder="Search driver…" />
          </label>
        )}
        {filters && (
          <fieldset className="filter-group">
            <legend>Filter results</legend>
            {filters.map((filter, index) => (
              <button
                className={index === 0 ? 'filter-button is-active' : 'filter-button'}
                type="button"
                key={filter}
              >
                {filter}
              </button>
            ))}
          </fieldset>
        )}
        <button className="button button--compact" type="button" disabled>
          Refresh
        </button>
      </div>
      <DataTable caption={caption ?? title} columns={columns}>
        <EmptyTableRow
          columns={columns.length}
          message="Live data connection is scheduled for Stage 3."
        />
      </DataTable>
      <p className="table-hint">Mobile: swipe left/right</p>
    </PageShell>
  )
}

export const CupStandingsPage = () => (
  <DataPage
    league="cup"
    title="GRR Cup Series Standings"
    eyebrow="GRR Cup Series 2026"
    search
    columns={[
      'Pos',
      'Driver',
      'Pts',
      '-Leader',
      '+/- Cutoff',
      'Starts',
      'W',
      'Stg W',
      'Poles',
      'T5',
      'T10',
      'Led',
      'Rating',
      'Link',
    ]}
  />
)
export const CupSchedulePage = () => (
  <DataPage
    league="cup"
    title="GRR Cup Series 2026 Calendar"
    eyebrow="Race schedule, winners, and pole sitters"
    columns={['Rd', 'Date', 'Track', 'Type', 'Winner', 'Pole']}
  />
)
export const CupResultsPage = () => (
  <DataPage
    league="cup"
    title="GRR Cup Series Race Results"
    eyebrow="GRR Cup Series 2026"
    filters={['Overall Race Finish', 'Stage 1', 'Stage 2']}
    columns={[
      'Pos',
      'Driver',
      'Start',
      'Int',
      'Laps',
      'Led',
      'Race Pts',
      'Stg Pts',
      'Bonus',
      'Pen',
      'Total',
      'Inc',
      'Status',
      'Passes',
      'Quality',
    ]}
  />
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
    filters={['Next Race', 'Completed']}
    columns={['Round', 'Date', 'Track', 'GT3 AM Winner', 'GT3 Pro Winner', 'GTP Winner']}
  />
)
export const GtStandingsPage = () => (
  <DataPage
    league="gt"
    title="GT League Standings"
    filters={['GT3 AM', 'GT3 Pro', 'GTP']}
    columns={['Rank', 'Driver', 'Car', 'Race Starts', 'Points', 'Wins', 'Podiums']}
  />
)
export const GtTeamStandingsPage = () => (
  <DataPage
    league="gt"
    title="GT League Team Standings"
    filters={['GT3 AM', 'GT3 Pro', 'GTP']}
    columns={['Rank', 'Driver', 'Car', 'Race Starts', 'Points', 'Wins', 'Podiums']}
  />
)
export const GtResultsPage = () => (
  <DataPage
    league="gt"
    title="GT League Race Results"
    filters={['GT3 AM', 'GT3 Pro', 'GTP']}
    columns={['Class Pos', 'Driver', 'Points']}
  />
)

export const IndyStandingsPage = () => (
  <DataPage
    league="indycar"
    title="GRR IndyCar Standings"
    eyebrow="Season 1"
    columns={[
      'Pos',
      'Driver',
      'Pts',
      '-Leader',
      'Starts',
      'W',
      'Poles',
      'T5',
      'T10',
      'Led',
      'Rating',
      'Link',
    ]}
  />
)
export const IndySchedulePage = () => (
  <DataPage
    league="indycar"
    title="GRR IndyCar Schedule"
    eyebrow="Race schedule, distances, winners, and pole sitters"
    columns={['Rd', 'Date', 'Track', 'Laps', 'Winner', 'Pole']}
  />
)
export const IndyResultsPage = () => (
  <DataPage
    league="indycar"
    title="GRR IndyCar Race Results"
    eyebrow="Season 1"
    columns={[
      'Pos',
      'Driver',
      'Start',
      'Int',
      'Laps',
      'Led',
      'Race Pts',
      'Bonus',
      'Pen',
      'Total',
      'Inc',
      'Status',
      'Passes',
      'Quality',
    ]}
  />
)
