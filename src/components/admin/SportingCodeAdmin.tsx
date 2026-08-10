import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

type RichTextCommand =
  | 'bold'
  | 'italic'
  | 'insertOrderedList'
  | 'insertUnorderedList'
  | 'redo'
  | 'undo'

function normalizeEditorHtml(html: string) {
  return html
    .replace(/<\/?b(?:\s[^>]*)?>/gi, (tag) => (tag.startsWith('</') ? '</strong>' : '<strong>'))
    .replace(/<\/?i(?:\s[^>]*)?>/gi, (tag) => (tag.startsWith('</') ? '</em>' : '<em>'))
}

function RichTextEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState('')

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html
  }, [html])

  const sync = () => {
    if (!editorRef.current) return
    const normalized = normalizeEditorHtml(editorRef.current.innerHTML)
    if (normalized !== editorRef.current.innerHTML) editorRef.current.innerHTML = normalized
    onChange(normalized)
  }
  const command = (name: RichTextCommand, value?: string) => {
    editorRef.current?.focus()
    window.document.execCommand(name, false, value)
    sync()
  }
  const block = (tag: 'p' | 'h3' | 'h4') => {
    editorRef.current?.focus()
    window.document.execCommand('formatBlock', false, tag)
    sync()
  }
  const insertTable = () => {
    editorRef.current?.focus()
    window.document.execCommand(
      'insertHTML',
      false,
      '<table><thead><tr><th>Heading</th><th>Heading</th></tr></thead><tbody><tr><td>Value</td><td>Value</td></tr></tbody></table><p><br></p>',
    )
    sync()
  }
  const updateTable = (action: 'column' | 'row') => {
    const selection = window.getSelection()
    const anchor = selection?.anchorNode
    const element = anchor instanceof Element ? anchor : anchor?.parentElement
    const table = element?.closest('table')
    if (!table || !editorRef.current?.contains(table)) {
      setHint('Click inside a table first, then choose Add row or Add column.')
      return
    }
    if (action === 'row') {
      const columnCount = Math.max(1, table.rows[0]?.cells.length ?? 2)
      const body = table.tBodies[0] ?? table.createTBody()
      const row = body.insertRow()
      Array.from({ length: columnCount }, () => row.insertCell().textContent = 'Value')
    } else {
      for (const row of table.rows) {
        const cell = row.parentElement?.tagName === 'THEAD'
          ? window.document.createElement('th')
          : window.document.createElement('td')
        cell.textContent = row.parentElement?.tagName === 'THEAD' ? 'Heading' : 'Value'
        row.append(cell)
      }
    }
    setHint('')
    sync()
  }
  const keepSelection = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()

  return <div className="sporting-rich-editor">
    <div className="sporting-rich-editor__toolbar" role="toolbar" aria-label="Text formatting">
      <button type="button" title="Undo" aria-label="Undo" onMouseDown={keepSelection} onClick={() => command('undo')}>↶</button>
      <button type="button" title="Redo" aria-label="Redo" onMouseDown={keepSelection} onClick={() => command('redo')}>↷</button>
      <span aria-hidden="true" />
      <button type="button" onMouseDown={keepSelection} onClick={() => block('p')}>Paragraph</button>
      <button type="button" onMouseDown={keepSelection} onClick={() => block('h3')}>Subheading</button>
      <button type="button" onMouseDown={keepSelection} onClick={() => block('h4')}>Small heading</button>
      <span aria-hidden="true" />
      <button className="sporting-rich-editor__bold" type="button" title="Bold" aria-label="Bold" onMouseDown={keepSelection} onClick={() => command('bold')}>B</button>
      <button className="sporting-rich-editor__italic" type="button" title="Italic" aria-label="Italic" onMouseDown={keepSelection} onClick={() => command('italic')}>I</button>
      <button type="button" title="Bulleted list" onMouseDown={keepSelection} onClick={() => command('insertUnorderedList')}>• List</button>
      <button type="button" title="Numbered list" onMouseDown={keepSelection} onClick={() => command('insertOrderedList')}>1. List</button>
      <button type="button" title="Insert a two-column table" onMouseDown={keepSelection} onClick={insertTable}>Table</button>
      <button type="button" title="Add a row to the selected table" onMouseDown={keepSelection} onClick={() => updateTable('row')}>+ Row</button>
      <button type="button" title="Add a column to the selected table" onMouseDown={keepSelection} onClick={() => updateTable('column')}>+ Column</button>
    </div>
    <div
      ref={editorRef}
      className="sporting-rich-editor__content sporting-code"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Section content"
      aria-multiline="true"
      onInput={sync}
      onBlur={sync}
    />
    <small>{hint || 'Select text before applying bold, italic, a heading, or a list. Changes appear exactly as they will on the public page.'}</small>
  </div>
}

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
      <button className="button button--secondary" type="button" onClick={() => {
        if (window.confirm('Discard unsaved edits and reset this draft?')) setDocument(published ?? defaultDocument)
      }}>Reset draft</button>
      <button className="button button--secondary" disabled={busy} type="button" onClick={() => run('saveDraft')}>Save draft</button>
      <button className="button" disabled={busy} type="button" onClick={() => {
        if (window.confirm('Publish this draft to the public sporting-code page now?')) run('publish')
      }}>Publish</button>
    </div>
    {preview && <div className="sporting-admin__preview sporting-code" dangerouslySetInnerHTML={{ __html: sportingCodeHtml(document) }} />}
    <div className="sporting-admin__sections">
      {document.sections.map((section, index) => <details className="sporting-admin__section" key={section.id} open={index === 0}>
        <summary><strong>{index + 1}. {section.title}</strong><span>Edit</span></summary>
        <label>Section title<input value={section.title} onChange={(event) => updateSection(index, 'title', event.target.value)} /></label>
        <strong className="sporting-admin__field-label">Section content</strong>
        <RichTextEditor html={section.bodyHtml} onChange={(value) => updateSection(index, 'bodyHtml', value)} />
        <div className="sporting-admin__section-actions">
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Move up</button>
          <button type="button" disabled={index === document.sections.length - 1} onClick={() => move(index, 1)}>Move down</button>
          <button type="button" disabled={document.sections.length === 1} onClick={() => {
            if (window.confirm(`Delete “${section.title}” from this draft?`)) setDocument((current) => ({ ...current, sections: current.sections.filter((_, itemIndex) => itemIndex !== index) }))
          }}>Delete section</button>
        </div>
      </details>)}
    </div>
    {revisions.length > 0 && <div className="sporting-admin__history"><h3>Published history</h3>{revisions.map((revision) => <div key={revision.id}><span>{new Date(revision.publishedAt).toLocaleString()} · {revision.publishedBy}</span><button type="button" disabled={busy} onClick={() => run('restoreRevision', revision.id)}>Restore to draft</button></div>)}</div>}
  </section>
}
