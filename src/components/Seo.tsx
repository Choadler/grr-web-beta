import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import routes from '../../seo-routes.json'

const publicOrigin = 'https://www.grassrootsracing.org'
const defaultImage = '/assets/branding/grr-logo.webp'

type SeoRoute = (typeof routes)[number]

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.append(element)
  }
  Object.entries(attributes).forEach(([name, value]) => element!.setAttribute(name, value))
}

function breadcrumbSchema(route: SeoRoute) {
  if (route.path === '/') return null
  const league = route.path.includes('/gt-')
    ? { name: 'GT League', path: '/pages/gt-league' }
    : route.path.includes('/indycar')
      ? { name: 'IndyCar', path: '/pages/indycar' }
      : route.path.includes('/cup') || route.path === '/pages/grr-cup-series' || route.path === '/pages/broadcast'
        ? { name: 'Cup Series', path: '/pages/grr-cup-series' }
        : null
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${publicOrigin}/` }]
  if (league && league.path !== route.path) items.push({ '@type': 'ListItem', position: 2, name: league.name, item: `${publicOrigin}${league.path}` })
  items.push({ '@type': 'ListItem', position: items.length + 1, name: route.heading, item: `${publicOrigin}${route.path}` })
  return { '@type': 'BreadcrumbList', itemListElement: items }
}

export function Seo() {
  const location = useLocation()
  useEffect(() => {
    const admin = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
    const route = routes.find((item) => item.path === location.pathname)
    const missing = !admin && !route
    const title = admin ? 'Grassroots Racing Administration' : route?.title ?? 'Page Not Found | Grassroots Racing'
    const description = route?.description ?? 'The requested Grassroots Racing page is not available.'
    const input = new URLSearchParams(location.search)
    const canonicalParams = new URLSearchParams()
    if (input.get('season')) canonicalParams.set('season', input.get('season')!)
    if (route?.path === '/pages/gt-stats' && input.get('view') === 'records') canonicalParams.set('view', 'records')
    const canonicalSuffix = canonicalParams.size ? `?${canonicalParams}` : ''
    const canonical = route ? `${publicOrigin}${route.path}${canonicalSuffix}` : `${publicOrigin}${location.pathname}`
    const image = `${publicOrigin}${route?.image ?? defaultImage}`

    document.title = title
    upsertMeta('meta[name="description"]', { name: 'description', content: description })
    upsertMeta('meta[name="robots"]', { name: 'robots', content: admin || missing ? 'noindex, nofollow' : 'index, follow' })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
    const canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonicalLink) canonicalLink.href = canonical

    document.querySelectorAll('script[data-grr-seo]').forEach((element) => element.remove())
    if (!route) return
    const graph: Record<string, unknown>[] = [
      { '@type': 'Organization', '@id': `${publicOrigin}/#organization`, name: 'Grassroots Racing', url: `${publicOrigin}/`, logo: `${publicOrigin}${defaultImage}` },
      { '@type': 'WebSite', '@id': `${publicOrigin}/#website`, url: `${publicOrigin}/`, name: 'Grassroots Racing', publisher: { '@id': `${publicOrigin}/#organization` } },
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description, isPartOf: { '@id': `${publicOrigin}/#website` } },
    ]
    const breadcrumbs = breadcrumbSchema(route)
    if (breadcrumbs) graph.push(breadcrumbs)
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.grrSeo = 'true'
    script.text = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    document.head.append(script)
  }, [location.pathname, location.search])
  return null
}
