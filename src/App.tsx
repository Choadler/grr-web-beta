import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { currentSiteAssets, externalLinks, navigation } from './config/site'
import { cupSchedule as cupCalendar, indycarSchedule as indyCalendar } from './config/schedules'
import { LeagueCountdown } from './components/league/LeagueCountdown'
import { ChampionshipLeaders } from './components/league/ChampionshipLeaders'
import { cupStandings, gtSchedule, gtStandings, indyStandings } from './services/dataSources'
import { AdminPage } from './pages/AdminPage'
import {
  CupBroadcastPage,
  CupLandingPage,
  CupResultsPage,
  CupSchedulePage,
  CupSportingCodePage,
  CupStandingsPage,
  GtLandingPage,
  GtResultsPage,
  GtRulesPage,
  GtSchedulePage,
  GtStandingsPage,
  GtTeamStandingsPage,
  IndyLandingPage,
  IndyResultsPage,
  IndySchedulePage,
  IndySportingCodePage,
  IndyStandingsPage,
} from './pages/league/LeaguePages'

const External = ({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) => (
  <a
    href={href}
    className={[className, href === externalLinks.discord ? 'discord-button' : '']
      .filter(Boolean)
      .join(' ')}
    target="_blank"
    rel="noreferrer"
  >
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
)
function Header() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [])
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="header-inner">
        <NavLink className="brand" to="/" aria-label="Grassroots Racing home">
          <img src="/assets/branding/grr-logo.webp" alt="Grassroots Racing" />
        </NavLink>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true">{open ? 'Ã—' : 'â˜°'}</span>
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
        <nav
          id="main-navigation"
          className={open ? 'main-nav is-open' : 'main-nav'}
          aria-label="Primary"
        >
          <ul>
            {navigation.map((g) => (
              <li className={g.items ? 'nav-group' : ''} key={g.label}>
                <NavLink
                  className={g.href === externalLinks.discord ? 'discord-button' : undefined}
                  to={g.href}
                  onClick={() => setOpen(false)}
                >
                  {g.label}
                  {g.items && <span aria-hidden="true"> â–¾</span>}
                </NavLink>
                {g.items && (
                  <ul className="dropdown">
                    {g.items.map((i) => (
                      <li key={i.href}>
                        <NavLink to={i.href} onClick={() => setOpen(false)}>
                          {i.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <img src="/assets/branding/grr-logo.webp" alt="" />
        <div>
          <strong>Grassroots Racing</strong>
          <p>Free-to-Enter iRacing Leagues by Sim Racers, For Sim Racers</p>
        </div>
        <nav aria-label="Footer">
          <External href={externalLinks.discord}>Discord</External>
          <External href={externalLinks.twitch}>Twitch</External>
          <External href={externalLinks.merchandise}>Merch</External>
          <Link to="/admin">Admin</Link>
        </nav>
      </div>
      <p className="copyright">Â© {new Date().getFullYear()} Grassroots Racing</p>
    </footer>
  )
}
function League({
  title,
  href,
  image,
  alt,
  leaders,
  countdown,
}: {
  title: string
  href: string
  image: string
  alt: string
  leaders: React.ReactNode
  countdown: React.ReactNode
}) {
  return (
    <article className="league-panel">
      <img src={image} alt={alt} loading="lazy" />
      <div className="league-panel__content">
        <h2>{title}</h2>
        {leaders}
        {countdown}
        <Link className="button" to={href}>
          Click Here
        </Link>
      </div>
    </article>
  )
}
function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="home-title">
        <video autoPlay muted loop playsInline preload="metadata">
          <source src={currentSiteAssets.heroVideo} type="video/mp4" />
        </video>
        <div className="hero-overlay">
          <div className="container">
            <p className="welcome">Welcome to Grassroots Racing</p>
            <h1 id="home-title">Free-to-Enter iRacing Leagues by Sim Racers, For Sim Racers</h1>
            <div className="hero-actions">
              <External className="button" href={externalLinks.discord}>
                Join our Discord!
              </External>
              <External className="button button--outline" href={externalLinks.twitch}>
                Visit our twitch
              </External>
            </div>
          </div>
        </div>
      </section>
      <section className="league-grid" aria-label="Grassroots Racing leagues">
        <League
          title="GRR Cup Series - Monday Nights"
          href="/pages/grr-cup-series"
          image="/assets/home/cup-series.webp"
          alt="GRR Cup Series racing"
          leaders={<ChampionshipLeaders sources={[{ loader: cupStandings }]} />}
          countdown={<LeagueCountdown schedule={cupCalendar} />}
        />
        <League
          title="GRR GT League - Tuesday Nights"
          href="/pages/gt-league"
          image="/assets/home/gt-league.webp"
          alt="GRR GT League racing"
          leaders={
            <ChampionshipLeaders
              sources={[
                { label: 'GT3 AM', loader: gtStandings('am') },
                { label: 'GT3 Pro', loader: gtStandings('pro') },
                { label: 'GTP', loader: gtStandings('gtp') },
              ]}
            />
          }
          countdown={<LeagueCountdown loader={gtSchedule} />}
        />
        <League
          title="GRR IndyCar League - Sunday Nights"
          href="/pages/indycar"
          image="/assets/home/indycar.webp"
          alt="GRR IndyCar League racing"
          leaders={<ChampionshipLeaders sources={[{ loader: indyStandings }]} />}
          countdown={<LeagueCountdown schedule={indyCalendar} />}
        />
      </section>
      <section className="home-race-section section">
        <div className="container home-race-callout">
          <div>
            <p className="eyebrow">Join Grassroots Racing</p>
            <h2>Wanna race? Register in our Discord for free!</h2>
          </div>
          <External className="button discord-button" href={externalLinks.discord}>
            GRR Discord
          </External>
        </div>
      </section>
      <section className="donation-section section">
        <div className="container donation-callout">
          <div>
            <p className="eyebrow">Support the leagues</p>
            <h2>Support GRR!</h2>
            <p>
              GRR is committed to being free for all to enjoy! Donations help fund our leagues
              broadcast, hosting, and other expenses.
            </p>
            <p>
              Donations are OPTIONAL and not required in any way to enjoy GRR Leagues. All proceeds
              from donations go directly to supporting GRR Leagues.
            </p>
          </div>
          <External className="button button--light" href={externalLinks.donate}>
            Donate
          </External>
        </div>
      </section>
      <section className="section merch-section">
        <div className="container section-heading">
          <p className="eyebrow">Fourthwall storefront</p>
          <h2>Merch</h2>
          <External className="button" href={externalLinks.merchandise}>
            View all
          </External>
        </div>
      </section>
      {/* TODO(content): Restore additional copy only after it is verified on the live site. */}
    </>
  )
}
function Missing() {
  return (
    <section className="not-found container">
      <p className="eyebrow">404</p>
      <h1>Page not found.</h1>
      <p>The page you requested is not available.</p>
      <Link className="button" to="/">
        Go Back Home
      </Link>
    </section>
  )
}
export function App() {
  return (
    <>
      <Header />
      <main id="main-content">
        <Routes>
          <Route index element={<Home />} />
          <Route path="pages/grr-cup-series" element={<CupLandingPage />} />
          <Route path="pages/cup-series-sporting-code" element={<CupSportingCodePage />} />
          <Route path="pages/cupstandings" element={<CupStandingsPage />} />
          <Route path="pages/cup-series-schedule" element={<CupSchedulePage />} />
          <Route path="pages/cup-latest-race-results" element={<CupResultsPage />} />
          <Route path="pages/broadcast" element={<CupBroadcastPage />} />
          <Route path="pages/gt-league" element={<GtLandingPage />} />
          <Route path="pages/gt-rules" element={<GtRulesPage />} />
          <Route path="pages/gt-schedule" element={<GtSchedulePage />} />
          <Route path="pages/gt-standings" element={<GtStandingsPage />} />
          <Route path="pages/gt-league-team-standings" element={<GtTeamStandingsPage />} />
          <Route path="pages/gt-team-standings" element={<GtTeamStandingsPage />} />
          <Route path="pages/gt-race-results" element={<GtResultsPage />} />
          <Route path="pages/indycar" element={<IndyLandingPage />} />
          <Route path="pages/indycar-sporting-code" element={<IndySportingCodePage />} />
          <Route path="pages/indycar-standings" element={<IndyStandingsPage />} />
          <Route path="pages/indycar-schedule" element={<IndySchedulePage />} />
          <Route path="pages/indycar-results" element={<IndyResultsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Missing />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

