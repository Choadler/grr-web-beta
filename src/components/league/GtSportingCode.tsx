import { useRef, useState } from 'react'
import sportingCodeHtml from '../../content/gt-sporting-code.html?raw'

const sections = [
  '1. League Philosophy',
  '2. General Rules and Formats',
  '3. GT3/GTP League Specific Rules',
  '4. Reserved',
  '5. Officials (In Session)',
  '6. Protests and Protestable Infractions',
  '7. Determination of Fault',
  '8. Penalties',
  '9. Appeals',
  '10. Points Systems',
]

export function GtSportingCode() {
  const [query, setQuery] = useState('')
  const [hasMatches, setHasMatches] = useState(true)
  const [indexOpen, setIndexOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const filterSections = (value: string) => {
    const needle = value.trim().toLowerCase()
    let matches = 0
    contentRef.current?.querySelectorAll<HTMLElement>('section[id^="gt-section-"]').forEach((section) => {
      const matched = !needle || Boolean(section.textContent?.toLowerCase().includes(needle))
      section.hidden = !matched
      if (matched) matches += 1
    })
    setHasMatches(!needle || matches > 0)
  }

  const handleSearch = (value: string) => {
    setQuery(value)
    filterSections(value)
  }

  return <div className="sporting-layout sporting-layout--full">
    <article ref={contentRef} className="sporting-code sporting-code--complete" dangerouslySetInnerHTML={{ __html: sportingCodeHtml }} />
    {query.trim() && !hasMatches && <p className="sporting-no-results">No rules matched your search.</p>}
    <aside className="sporting-sidebar">
      <nav className={`sporting-index${indexOpen ? ' is-open' : ''}`} aria-label="GT sporting code sections">
        <button className="sporting-index__toggle" type="button" aria-expanded={indexOpen} onClick={() => setIndexOpen(!indexOpen)}>
          <strong>Sporting Code sections</strong><span aria-hidden="true">{indexOpen ? '−' : '+'}</span>
        </button>
        <strong className="sporting-index__desktop-title">Sporting Code</strong>
        <div className="sporting-index__body">
        <label className="sr-only" htmlFor="gt-sporting-search">Search rules</label>
        <input id="gt-sporting-search" type="search" value={query} onChange={(event) => handleSearch(event.target.value)} placeholder="Search rules..." />
        {sections.map((section, index) => <a href={`#gt-section-${index + 1}`} onClick={() => setIndexOpen(false)} key={section}>{section}</a>)}
        </div>
      </nav>
    </aside>
  </div>
}
