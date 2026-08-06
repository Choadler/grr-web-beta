import { useEffect, useState } from 'react'
import type { DataLoader } from '../../types/league'

type LeaderSource = { label?: string; loader: DataLoader }
type Leader = { label?: string; name: string }

export function ChampionshipLeaders({ sources }: { sources: LeaderSource[] }) {
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all(sources.map(async ({ label, loader }) => {
      const result = await loader(controller.signal)
      const leader = result.rows.find((row) => Number(row.rank) === 1) ?? result.rows[0]
      return { label, name: String(leader?.driver ?? '') }
    })).then((result) => {
      setLeaders(result.filter((leader) => leader.name))
      setStatus('ready')
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('error')
    })
    return () => controller.abort()
  }, [sources])

  return <div className="championship-leaders">
    <span>{sources.length > 1 ? 'Current Championship Leaders' : 'Current Championship Leader'}</span>
    {status === 'loading' && <strong>Loading standings…</strong>}
    {status === 'error' && <strong>Standings unavailable</strong>}
    {status === 'ready' && leaders.map((leader) => <strong key={leader.label ?? leader.name}>
      {leader.label && <small>{leader.label}</small>}{leader.name}
    </strong>)}
    {status === 'ready' && !leaders.length && <strong>Standings unavailable</strong>}
  </div>
}
