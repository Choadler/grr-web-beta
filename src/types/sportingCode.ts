export type SportingCodeLeague = 'cup' | 'gt'

export type SportingCodeSection = {
  id: string
  title: string
  bodyHtml: string
}

export type SportingCodeDocument = {
  league: SportingCodeLeague
  sections: SportingCodeSection[]
  updatedAt?: string
}

export type SportingCodeRevision = SportingCodeDocument & {
  id: number
  publishedAt: string
  publishedBy: string
}

export type SportingCodeAdminState = {
  draft: SportingCodeDocument | null
  published: SportingCodeDocument | null
  revisions: SportingCodeRevision[]
}
