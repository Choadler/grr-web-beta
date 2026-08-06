import { useEffect, useRef, useState } from 'react'
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
      <nav className="sporting-index" aria-label="GT sporting code sections">
        <strong>Sporting Code</strong>
        <label className="sr-only" htmlFor="gt-sporting-search">Search rules</label>
        <input id="gt-sporting-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rules…" />
        {sections.map((section, index) => <a href={`#gt-section-${index + 1}`} key={section}>{section}</a>)}
      </nav>
    </aside>
  </div>
}
