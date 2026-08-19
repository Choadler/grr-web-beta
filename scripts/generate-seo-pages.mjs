import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import routes from '../seo-routes.json' with { type: 'json' }

const origin = 'https://www.grassrootsracing.org'
const dist = new URL('../dist/', import.meta.url)
const template = await readFile(new URL('index.html', dist), 'utf8')

const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const escapeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c')

function breadcrumbs(route) {
  if (route.path === '/') return null
  const league = route.path.includes('/gt-')
    ? { name: 'GT League', path: '/pages/gt-league' }
    : route.path.includes('/indycar')
      ? { name: 'IndyCar', path: '/pages/indycar' }
      : route.path.includes('/cup') || route.path === '/pages/grr-cup-series' || route.path === '/pages/broadcast'
        ? { name: 'Cup Series', path: '/pages/grr-cup-series' }
        : null
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` }]
  if (league && league.path !== route.path) items.push({ '@type': 'ListItem', position: 2, name: league.name, item: `${origin}${league.path}` })
  items.push({ '@type': 'ListItem', position: items.length + 1, name: route.heading, item: `${origin}${route.path}` })
  return { '@type': 'BreadcrumbList', itemListElement: items }
}

function render(route) {
  const canonical = `${origin}${route.path}`
  const image = `${origin}${route.image}`
  const graph = [
    { '@type': 'Organization', '@id': `${origin}/#organization`, name: 'Grassroots Racing', url: `${origin}/`, logo: `${origin}/assets/branding/grr-logo.webp` },
    { '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`, name: 'Grassroots Racing', publisher: { '@id': `${origin}/#organization` } },
    { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: route.title, description: route.description, isPartOf: { '@id': `${origin}/#website` } },
  ]
  const crumb = breadcrumbs(route)
  if (crumb) graph.push(crumb)
  return template
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(route.title)}" />`)
    .replace(/<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${image}" />`)
    .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${image}" />`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}" />`)
    .replace('</head>', `    <script type="application/ld+json" data-grr-seo>${escapeJson({ '@context': 'https://schema.org', '@graph': graph })}</script>\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><main id="main-content" class="seo-fallback"><h1>${escapeHtml(route.heading)}</h1><p>${escapeHtml(route.description)}</p></main></div>`)
}

for (const route of routes) {
  const output = route.path === '/'
    ? fileURLToPath(new URL('index.html', dist))
    : path.join(fileURLToPath(dist), `${route.path.slice(1)}.html`)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, render(route))
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${origin}${route.path}</loc></url>`).join('\n')}\n</urlset>\n`
await writeFile(new URL('sitemap.xml', dist), sitemap)
