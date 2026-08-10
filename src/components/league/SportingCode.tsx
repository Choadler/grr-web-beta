import { useEffect, useMemo, useRef, useState } from 'react'
import type { SportingCodeDocument, SportingCodeLeague } from '../../types/sportingCode'
import { loadPublishedSportingCode, parseSportingCodeHtml, sportingCodeHtml } from '../../services/sportingCode'

export function SportingCode({ league, defaultHtml }: { league: SportingCodeLeague; defaultHtml: string }) {
  const fallback = useMemo(() => parseSportingCodeHtml(league, defaultHtml), [defaultHtml, league])
  const [document, setDocument] = useState<SportingCodeDocument>(fallback)
  const [query, setQuery] = useState('')
  const [hasMatches, setHasMatches] = useState(true)
  const [indexOpen, setIndexOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    loadPublishedSportingCode(league).then((value) => {
      if (active && value) setDocument(value)
    }).catch(() => undefined)
    return () => { active = false }
  }, [league])

  const search = (value: string) => {
    setQuery(value)
    const needle = value.trim().toLowerCase()
    let matches = 0
    contentRef.current?.querySelectorAll<HTMLElement>(`section[id^="${league}-section-"]`).forEach((section) => {
      const matched = !needle || Boolean(section.textContent?.toLowerCase().includes(needle))
      section.hidden = !matched
      if (matched) matches += 1
    })
    setHasMatches(!needle || matches > 0)
  }

  return <div className="sporting-layout sporting-layout--full">
    <article ref={contentRef} className="sporting-code sporting-code--complete" dangerouslySetInnerHTML={{ __html: sportingCodeHtml(document) }} />
    {query.trim() && !hasMatches && <p className="sporting-no-results">No rules matched your search.</p>}
    <aside className="sporting-sidebar">
      <nav className={`sporting-index${indexOpen ? ' is-open' : ''}`} aria-label="Sporting code sections">
        <button className="sporting-index__toggle" type="button" aria-expanded={indexOpen} onClick={() => setIndexOpen(!indexOpen)}>
          <strong>Sporting Code sections</strong><span aria-hidden="true">{indexOpen ? '−' : '+'}</span>
        </button>
        <strong className="sporting-index__desktop-title">Sporting Code</strong>
        <div className="sporting-index__body">
          <label className="sr-only" htmlFor={`${league}-sporting-search`}>Search rules</label>
          <input id={`${league}-sporting-search`} type="search" value={query} onChange={(event) => search(event.target.value)} placeholder="Search rules..." />
          {document.sections.map((section, index) => <a href={`#${section.id}`} onClick={() => setIndexOpen(false)} key={section.id}>{index + 1}. {section.title}</a>)}
        </div>
      </nav>
    </aside>
  </div>
}
