import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { currentSiteAssets, externalLinks, navigation } from './config/site'
import { cupSchedule as cupCalendar, indycarSchedule as indyCalendar } from './config/schedules'
import { LeagueCountdown } from './components/league/LeagueCountdown'
import { ChampionshipLeaders } from './components/league/ChampionshipLeaders'
import { cupStandings, gtSchedule, gtStandings, indyStandings } from './services/dataSources'
import { AdminPage, IndycarAdminPage } from './pages/AdminPage'
import { GtAdminPage } from './pages/GtAdminPage'
import { CupAdminPage } from './pages/CupAdminPage'
import { GalleryPage } from './pages/GalleryPage'
import { GalleryAdminPage } from './pages/GalleryAdminPage'
import { DriverComparisonPage } from './pages/DriverComparisonPage'
import { HomeGallery } from './components/gallery/HomeGallery'
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

type AdminIdentity = {
  email: string
  name?: string
}

const publicHostname = 'www.grassrootsracing.org'
const adminHostname = 'grassrootsracing.org'
const adminSessionMarker = 'grr_admin_session'

type StoredAdminIdentity = AdminIdentity & {
  expiresAt: number
}

function readAdminSessionMarker(): AdminIdentity | null {
  if (typeof document === 'undefined') return null

  const encoded = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${adminSessionMarker}=`))
    ?.slice(adminSessionMarker.length + 1)

  if (!encoded) return null

  try {
    const stored = JSON.parse(decodeURIComponent(encoded)) as Partial<StoredAdminIdentity>
    if (typeof stored.email !== 'string' || typeof stored.expiresAt !== 'number') return null
    if (stored.expiresAt <= Date.now()) {
      clearAdminSessionMarker()
      return null
    }
    return { email: stored.email, name: stored.name }
  } catch {
    clearAdminSessionMarker()
    return null
  }
}

function writeAdminSessionMarker(identity: AdminIdentity, expiresAt: number) {
  const value = encodeURIComponent(JSON.stringify({ ...identity, expiresAt }))
  const domain = window.location.hostname.endsWith('grassrootsracing.org')
    ? '; Domain=.grassrootsracing.org; Secure'
    : ''
  document.cookie = `${adminSessionMarker}=${value}; Path=/; Expires=${new Date(expiresAt).toUTCString()}; SameSite=Lax${domain}`
}

function clearAdminSessionMarker() {
  const domain = window.location.hostname.endsWith('grassrootsracing.org')
    ? '; Domain=.grassrootsracing.org; Secure'
    : ''
  document.cookie = `${adminSessionMarker}=; Path=/; Max-Age=0; SameSite=Lax${domain}`
}

const isAdminPath = (pathname: string) =>
  pathname === '/admin' || pathname.startsWith('/admin/')

function canonicalProductionUrl(location: ReturnType<typeof useLocation>) {
  const { hostname } = window.location
  if (hostname !== publicHostname && hostname !== adminHostname) return null

  const targetHostname = isAdminPath(location.pathname) ? adminHostname : publicHostname
  if (hostname === targetHostname) return null

  return `https://${targetHostname}${location.pathname}${location.search}${location.hash}`
}

function NavigationBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const targetUrl = canonicalProductionUrl(location)

  useEffect(() => {
    if (targetUrl) window.location.replace(targetUrl)
  }, [targetUrl])

  useEffect(() => {
    if (!targetUrl) window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search, targetUrl])

  // Do not mount a public page on the Access-protected admin origin (or vice
  // versa). Mounting it briefly can start API calls against the wrong origin.
  if (targetUrl) {
    return (
      <main id="main-content" className="container">
        <p role="status">Opening page...</p>
      </main>
    )
  }

  return children
}

function useAdminIdentity() {
  const [identity, setIdentity] = useState<AdminIdentity | null>(() => readAdminSessionMarker())

  useEffect(() => {
    // The Access identity endpoint is available on the protected admin host.
    // Public pages live on www, so they use the short-lived shared marker that
    // was written after Access verified the session on the admin host.
    if (window.location.hostname === publicHostname) {
      return
    }

    const controller = new AbortController()
    fetch('/cdn-cgi/access/get-identity', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = (await response.json()) as Record<string, unknown>
        if (typeof payload.email !== 'string') return null

        const expirationSeconds = Number(payload.exp)
        const expiresAt = Number.isFinite(expirationSeconds)
          ? expirationSeconds * 1000
          : Date.now() + 24 * 60 * 60 * 1000

        return {
          identity: {
            email: payload.email,
            name: typeof payload.name === 'string' ? payload.name : undefined,
          },
          expiresAt,
        }
      })
      .then((admin) => {
        if (controller.signal.aborted) return
        if (!admin) {
          clearAdminSessionMarker()
          setIdentity(null)
          return
        }
        writeAdminSessionMarker(admin.identity, admin.expiresAt)
        setIdentity(admin.identity)
      })
      .catch(() => {
        if (!controller.signal.aborted && window.location.hostname === adminHostname) {
          clearAdminSessionMarker()
          setIdentity(null)
        }
      })
    return () => controller.abort()
  }, [])

  return identity
}

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
function AdminSessionControls({ identity, className = '' }: { identity: AdminIdentity | null; className?: string }) {
  if (!identity) return null
  return (
    <div className={`admin-session ${className}`.trim()} aria-label="Administrator session">
      <span className="admin-session__identity" title={identity.email}>
        <small>Signed in</small>
        <strong>Admin</strong>
      </span>
      <Link className="admin-session__dashboard" to="/admin">
        Dashboard
      </Link>
      <a
        className="admin-session__signout"
        href={`https://${adminHostname}/cdn-cgi/access/logout`}
        onClick={clearAdminSessionMarker}
      >
        Sign out
      </a>
    </div>
  )
}

function Header({ identity }: { identity: AdminIdentity | null }) {
  const [open, setOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const closeMenu = () => {
    setOpen(false)
    setExpandedGroup(null)
  }
  const closeDesktopMenu = (event: React.MouseEvent<HTMLAnchorElement>) => {
    closeMenu()
    if (event.detail > 0) event.currentTarget.blur()
  }

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', open)
    return () => document.body.classList.remove('mobile-nav-open')
  }, [open])
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="header-inner">
        <NavLink className="brand" to="/" aria-label="Grassroots Racing home">
          <img src="/assets/branding/grr-logo.webp" alt="Grassroots Racing" />
        </NavLink>
        <nav
          id="main-navigation"
          className={open ? 'main-nav is-open' : 'main-nav'}
          aria-label="Primary"
        >
          <div className="mobile-nav-heading">
            <strong>Navigation</strong>
            <button type="button" onClick={closeMenu} aria-label="Close menu">Close</button>
          </div>
          <ul className="desktop-nav-list">
            {navigation.map((g) => (
              <li className={g.items ? 'nav-group' : ''} key={g.label}>
                <NavLink
                  className={g.href === externalLinks.discord ? 'discord-button' : undefined}
                  to={g.href}
                  onClick={closeDesktopMenu}
                >
                  {g.label}
                  {g.items && <span aria-hidden="true"> &#9662;</span>}
                </NavLink>
                {g.items && (
                  <ul className="dropdown">
                    {g.items.map((i) => (
                      <li key={i.href}>
                        <NavLink to={i.href} onClick={closeDesktopMenu}>
                          {i.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <ul className="mobile-nav-list">
            {navigation.map((group) => {
              const expanded = expandedGroup === group.label
              return (
                <li className={group.items ? 'mobile-nav-group' : ''} key={`mobile-${group.label}`}>
                  <div className="mobile-nav-row">
                    <NavLink
                      className={group.href === externalLinks.discord ? 'discord-button' : undefined}
                      to={group.href}
                      onClick={closeMenu}
                    >
                      {group.label}
                    </NavLink>
                    {group.items && (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.label} links`}
                        onClick={() => setExpandedGroup(expanded ? null : group.label)}
                      >
                        <span aria-hidden="true">{expanded ? `\u2212` : '+'}</span>
                      </button>
                    )}
                  </div>
                  {group.items && expanded && (
                    <ul className="mobile-nav-submenu">
                      {group.items.map((item) => (
                        <li key={`mobile-${item.href}`}>
                          <NavLink to={item.href} onClick={closeMenu}>
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          <AdminSessionControls identity={identity} className="admin-session--mobile" />
        </nav>
        <AdminSessionControls identity={identity} className="admin-session--desktop" />
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true">{open ? 'Close' : 'Menu'}</span>
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
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
      <p className="copyright">&copy; {new Date().getFullYear()} Grassroots Racing</p>
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
      <HomeGallery />
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
function SiteApp() {
  const adminIdentity = useAdminIdentity()
  return (
    <>
      <Header identity={adminIdentity} />
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
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="driver-comparison" element={<DriverComparisonPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/indycar/:tool?" element={<IndycarAdminPage />} />
          <Route path="admin/cup/:tool?" element={<CupAdminPage />} />
          <Route path="admin/gt/:tool?" element={<GtAdminPage />} />
          <Route path="admin/gallery" element={<GalleryAdminPage />} />
          <Route path="*" element={<Missing />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export function App() {
  return (
    <NavigationBoundary>
      <SiteApp />
    </NavigationBoundary>
  )
}
