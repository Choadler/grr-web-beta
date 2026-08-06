import { useEffect } from 'react'

export function PageMeta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = `${title} | Grassroots Racing`
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (meta) meta.content = description
    if (canonical) canonical.href = `https://grassrootsracing.org${location.pathname}`
  }, [title, description])
  return null
}
