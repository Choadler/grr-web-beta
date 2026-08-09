import { useRef, useState } from 'react'
import sportingCodeHtml from '../../content/cup-sporting-code.html?raw'

const sections = [
  '1. Introduction', '2. General Conduct', '3. Season / Race Rules', '4. Car Setups / Liveries',
  '5. License Points and Penalties', '6. Scoring System', '7. Filing a Protest',
  '8. Teams (Optional)', '9. League and Admin Authority', '10. Conclusion',
]

export function CupSportingCode() {
  const [query, setQuery] = useState('')
  const [hasMatches, setHasMatches] = useState(true)
  const [indexOpen, setIndexOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const filterSections = (value: string) => {
    const needle = value.trim().toLowerCase()
    let matches = 0
    contentRef.current?.querySelectorAll<HTMLElement>('section[id^="cup-section-"]').forEach((section) => {
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
      <nav className={`sporting-index${indexOpen ? ' is-open' : ''}`} aria-label="Sporting code sections">
        <button className="sporting-index__toggle" type="button" aria-expanded={indexOpen} onClick={() => setIndexOpen(!indexOpen)}>
          <strong>Sporting Code sections</strong><span aria-hidden="true">{indexOpen ? '−' : '+'}</span>
        </button>
        <strong className="sporting-index__desktop-title">Sporting Code</strong>
        <div className="sporting-index__body">
        <label className="sr-only" htmlFor="sporting-search">Search rules</label>
        <input id="sporting-search" type="search" value={query} onChange={(event) => handleSearch(event.target.value)} placeholder="Search rules..." />
        {sections.map((section, index) => <a href={`#cup-section-${index + 1}`} onClick={() => setIndexOpen(false)} key={section}>{section}</a>)}
        </div>
      </nav>
    </aside>
  </div>
}
