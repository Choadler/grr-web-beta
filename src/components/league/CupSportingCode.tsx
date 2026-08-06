import { useEffect, useRef, useState } from 'react'
import sportingCodeHtml from '../../content/cup-sporting-code.html?raw'

const sections = [
  '1. Introduction', '2. General Conduct', '3. Season / Race Rules', '4. Car Setups / Liveries',
  '5. License Points and Penalties', '6. Scoring System', '7. Filing a Protest',
  '8. Teams (Optional)', '9. League and Admin Authority', '10. Conclusion',
]

export function CupSportingCode() {
  const [query, setQuery] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const emptyRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const needle = query.trim().toLowerCase()
    let matches = 0
    contentRef.current?.querySelectorAll<HTMLElement>(':scope > section').forEach((section) => {
      const matched = !needle || Boolean(section.textContent?.toLowerCase().includes(needle))
      section.hidden = !matched
      if (matched) matches += 1
    })
    if (emptyRef.current) emptyRef.current.hidden = matches > 0
  }, [query])

  return <div className="sporting-layout sporting-layout--full">
    <article ref={contentRef} className="sporting-code sporting-code--complete" dangerouslySetInnerHTML={{ __html: sportingCodeHtml }} />
    <p ref={emptyRef} className="sporting-no-results" hidden>No rules matched your search.</p>
    <aside className="sporting-sidebar">
      <nav className="sporting-index" aria-label="Sporting code sections">
        <strong>Sporting Code</strong>
        <label className="sr-only" htmlFor="sporting-search">Search rules</label>
        <input id="sporting-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rules…" />
        {sections.map((section, index) => <a href={`#cup-section-${index + 1}`} key={section}>{section}</a>)}
      </nav>
    </aside>
  </div>
}
