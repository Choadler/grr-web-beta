import { useCallback, useEffect, useMemo, useState } from 'react'
import cupHtml from '../../content/cup-sporting-code.html?raw'
import gtHtml from '../../content/gt-sporting-code.html?raw'
import {
  loadSportingCodeAdmin,
  mutateSportingCode,
  parseSportingCodeHtml,
  sportingCodeHtml,
  validateSportingCodeDocument,
} from '../../services/sportingCode'
import type { SportingCodeDocument, SportingCodeLeague } from '../../types/sportingCode'

export function SportingCodeAdmin({ league }: { league: SportingCodeLeague }) {
  const leagueName = league === 'cup' ? 'Cup Series' : 'GT League'
  const defaultDocument = useMemo(
    () => parseSportingCodeHtml(league, league === 'cup' ? cupHtml : gtHtml),
    [league],
  )
  const [document, setDocument] = useState<SportingCodeDocument>(defaultDocument)
  const [published, setPublished] = useState<SportingCodeDocument | null>(null)
  const [revisions, setRevisions] = useState<Awaited<ReturnType<typeof loadSportingCodeAdmin>>['revisions']>([])
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const applyState = useCallback((state: Awaited<ReturnType<typeof loadSportingCodeAdmin>>) => {
    setDocument(state.draft ?? state.published ?? defaultDocument)
    setPublished(state.published)
    setRevisions(state.revisions)
  }, [defaultDocument])

  useEffect(() => {
    let active = true
    loadSportingCodeAdmin(league).then((state) => {
      if (active) applyState(state)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load the editor.')
    })
    return () => { active = false }
  }, [applyState, league])

  const run = async (action: 'saveDraft' | 'publish' | 'restoreRevision', revisionId?: number) => {
    const validation = validateSportingCodeDocument(document)
    if (action !== 'restoreRevision' && validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const state = await mutateSportingCode(league, action, document, revisionId)
      applyState(state)
      setNotice(action === 'publish' ? 'Sporting code published.' : action === 'saveDraft' ? 'Draft saved.' : 'Revision restored to the draft.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the sporting code.')
    } finally {
      setBusy(false)
    }
  }

  const updateSection = (index: number, field: 'title' | 'bodyHtml', value: string) => {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, itemIndex) => itemIndex === index ? { ...section, [field]: value } : section),
    }))
  }
  const move = (index: number, offset: number) => {
    setDocument((current) => {
      const sections = [...current.sections]
      const destination = index + offset
      if (destination < 0 || destination >= sections.length) return current
      ;[sections[index], sections[destination]] = [sections[destination], sections[index]]
      return { ...current, sections }
    })
  }
  const add = () => setDocument((current) => ({
    ...current,
    sections: [...current.sections, {
      id: `${league}-section-${Date.now()}`,
      title: 'New section',
      bodyHtml: '<p>Add the section text here.</p>',
    }],
  }))

  return <section className="sporting-admin" aria-label={`${leagueName} sporting code editor`}>
    <div className="admin-card__heading">
      <div><p className="eyebrow">Published rules</p><h2>{leagueName} Sporting Code</h2></div>
      <a className="button button--secondary" href={league === 'cup' ? '/pages/cup-series-sporting-code' : '/pages/gt-rules'} target="_blank" rel="noreferrer">View public page</a>
    </div>
    <p>Edit each top-level section below. Section numbers update automatically when sections are reordered.</p>
    {notice && <p className="admin-notice admin-notice--success">{notice}</p>}
    {error && <p className="admin-notice admin-notice--error">{error}</p>}
    <div className="sporting-admin__toolbar">
      <button className="button button--secondary" type="button" onClick={() => setPreview(!preview)}>{preview ? 'Close preview' : 'Preview draft'}</button>
      <button className="button button--secondary" type="button" onClick={add}>Add section</button>
      <button className="button button--secondary" type="button" onClick={() => setDocument(published ?? defaultDocument)}>Reset draft</button>
      <button className="button button--secondary" disabled={busy} type="button" onClick={() => run('saveDraft')}>Save draft</button>
      <button className="button" disabled={busy} type="button" onClick={() => run('publish')}>Publish</button>
    </div>
    {preview && <div className="sporting-admin__preview sporting-code" dangerouslySetInnerHTML={{ __html: sportingCodeHtml(document) }} />}
    <div className="sporting-admin__sections">
      {document.sections.map((section, index) => <details className="sporting-admin__section" key={section.id} open={index === 0}>
        <summary><strong>{index + 1}. {section.title}</strong><span>Edit</span></summary>
        <label>Section title<input value={section.title} onChange={(event) => updateSection(index, 'title', event.target.value)} /></label>
        <label>Section content<textarea rows={14} value={section.bodyHtml} onChange={(event) => updateSection(index, 'bodyHtml', event.target.value)} /></label>
        <small>Supported markup: paragraphs, headings, lists, tables, divs, strong/emphasis, and line breaks.</small>
        <div className="sporting-admin__section-actions">
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Move up</button>
          <button type="button" disabled={index === document.sections.length - 1} onClick={() => move(index, 1)}>Move down</button>
          <button type="button" disabled={document.sections.length === 1} onClick={() => setDocument((current) => ({ ...current, sections: current.sections.filter((_, itemIndex) => itemIndex !== index) }))}>Delete section</button>
        </div>
      </details>)}
    </div>
    {revisions.length > 0 && <div className="sporting-admin__history"><h3>Published history</h3>{revisions.map((revision) => <div key={revision.id}><span>{new Date(revision.publishedAt).toLocaleString()} · {revision.publishedBy}</span><button type="button" disabled={busy} onClick={() => run('restoreRevision', revision.id)}>Restore to draft</button></div>)}</div>}
  </section>
}
