import type {
  SportingCodeAdminState,
  SportingCodeDocument,
  SportingCodeLeague,
  SportingCodeSection,
} from '../types/sportingCode'
import { adminFetch } from './adminSession'

const localKey = (league: SportingCodeLeague) => `grr-${league}-sporting-code-admin-v1`

export function parseSportingCodeHtml(
  league: SportingCodeLeague,
  html: string,
): SportingCodeDocument {
  const parsed = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  const sections = [...parsed.querySelectorAll(`section[id^="${league}-section-"]`)].map(
    (element): SportingCodeSection => {
      const heading = element.querySelector(':scope > h2')
      const title = heading?.textContent?.replace(/^\d+\.\s*/, '').trim() || 'Untitled section'
      heading?.remove()
      return { id: element.id, title, bodyHtml: element.innerHTML }
    },
  )
  return { league, sections }
}

export function sportingCodeHtml(document: SportingCodeDocument) {
  return document.sections
    .map(
      (section, index) =>
        `<section id="${section.id}"><h2>${index + 1}. ${escapeHtml(section.title)}</h2>${section.bodyHtml}</section>`,
    )
    .join('')
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })

const allowedTags = new Set(['P', 'H3', 'H4', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'DIV', 'STRONG', 'EM', 'BR'])

export function validateSportingCodeDocument(document: SportingCodeDocument) {
  if (!document.sections.length) return 'Add at least one section.'
  if (document.sections.length > 30) return 'A sporting code can contain at most 30 sections.'
  const ids = new Set<string>()
  for (const section of document.sections) {
    if (!section.title.trim()) return 'Every section needs a title.'
    if (ids.has(section.id)) return 'Every section must have a unique ID.'
    ids.add(section.id)
    const parsed = new DOMParser().parseFromString(`<main>${section.bodyHtml}</main>`, 'text/html')
    for (const element of parsed.querySelectorAll('main *')) {
      if (!allowedTags.has(element.tagName)) return `<${element.tagName.toLowerCase()}> is not supported.`
      for (const attribute of [...element.attributes]) {
        if (attribute.name !== 'id') return `The ${attribute.name} attribute is not supported.`
      }
    }
  }
  return ''
}

export async function loadPublishedSportingCode(league: SportingCodeLeague) {
  const response = await fetch(`/api/sporting-code?league=${league}`, {
    headers: { Accept: 'application/json' },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Could not load the published sporting code.')
  return (await response.json()) as SportingCodeDocument
}

function readLocal(league: SportingCodeLeague): SportingCodeAdminState {
  try {
    return JSON.parse(localStorage.getItem(localKey(league)) ?? '') as SportingCodeAdminState
  } catch {
    return { draft: null, published: null, revisions: [] }
  }
}

export async function loadSportingCodeAdmin(league: SportingCodeLeague) {
  if (import.meta.env.DEV) return readLocal(league)
  const response = await adminFetch(`/admin/api/sporting-code?league=${league}`)
  if (!response.ok) throw new Error('Could not load sporting-code administration.')
  return (await response.json()) as SportingCodeAdminState
}

export async function mutateSportingCode(
  league: SportingCodeLeague,
  action: 'saveDraft' | 'publish' | 'restoreRevision',
  document?: SportingCodeDocument,
  revisionId?: number,
) {
  if (import.meta.env.DEV) {
    const state = readLocal(league)
    if (action === 'saveDraft' && document) state.draft = { ...document, updatedAt: new Date().toISOString() }
    if (action === 'publish' && document) {
      const published = { ...document, updatedAt: new Date().toISOString() }
      state.draft = published
      state.published = published
      state.revisions.unshift({
        ...published,
        id: Date.now(),
        publishedAt: published.updatedAt!,
        publishedBy: 'Local preview',
      })
    }
    if (action === 'restoreRevision') {
      const revision = state.revisions.find((item) => item.id === revisionId)
      if (revision) state.draft = { league, sections: revision.sections, updatedAt: new Date().toISOString() }
    }
    localStorage.setItem(localKey(league), JSON.stringify(state))
    return state
  }
  const response = await adminFetch(`/admin/api/sporting-code?league=${league}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, document, revisionId }),
  })
  const payload = (await response.json()) as SportingCodeAdminState & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Could not update the sporting code.')
  return payload
}
