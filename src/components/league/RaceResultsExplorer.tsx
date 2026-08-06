import { useEffect, useMemo, useState } from 'react'
import type { RaceEvent, RaceEventsLoader } from '../../types/league'
import { ErrorState, LoadingState } from './States'
import { LiveDataTable, type LiveColumn } from './LiveDataTable'

const raceColumns: LiveColumn[] = [
  { key: 'position', label: 'Pos' }, { key: 'driver', label: 'Driver' }, { key: 'start', label: 'Start' },
  { key: 'interval', label: 'Int' }, { key: 'laps', label: 'Laps' }, { key: 'led', label: 'Led' },
  { key: 'racePoints', label: 'Race Pts' }, { key: 'stagePoints', label: 'Stg Pts' },
  { key: 'bonus', label: 'Bonus' }, { key: 'penalty', label: 'Pen' }, { key: 'total', label: 'Total' },
  { key: 'incidents', label: 'Inc' }, { key: 'status', label: 'Status' }, { key: 'passes', label: 'Passes' },
  { key: 'quality', label: 'Quality' },
]
const stageColumns: LiveColumn[] = [{ key: 'position', label: 'Pos' }, { key: 'driver', label: 'Driver' }]

export function RaceResultsExplorer({ title, loader }: { title: string; loader: RaceEventsLoader }) {
  const [events, setEvents] = useState<RaceEvent[]>([])
  const [eventIndex, setEventIndex] = useState(0)
  const [sessionIndex, setSessionIndex] = useState(0)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    loader(controller.signal).then((result) => { setEvents(result.events); setEventIndex(Math.max(0, result.events.length - 1)); setError('') }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The data source returned an error.')
    })
    return () => controller.abort()
  }, [loader, retry])

  const event = events[eventIndex]
  const session = event?.sessions[sessionIndex] ?? event?.sessions[0]
  const tableLoader = useMemo(() => async () => ({ rows: session?.rows ?? [], label: event?.label }), [event?.label, session?.rows])
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
  if (!event || !session) return <LoadingState label={`Loading ${title}â€¦`} />

  return <>
    <div className="results-selector">
      <label><span>Select race</span><select value={eventIndex} onChange={(change) => { setEventIndex(Number(change.target.value)); setSessionIndex(0) }}>{events.map((item, index) => <option value={index} key={item.id}>{item.label}</option>)}</select></label>
      <button className="button button--compact" type="button" onClick={() => { setEventIndex(events.length - 1); setSessionIndex(0) }}>Latest Race</button>
    </div>
    {event.sessions.length > 1 && <div className="result-tabs" role="group" aria-label="Race session"><button className={sessionIndex === 0 ? 'filter-button is-active' : 'filter-button'} type="button" onClick={() => setSessionIndex(0)}>Overall Race Finish</button>{event.sessions.slice(1).map((item, index) => <button className={sessionIndex === index + 1 ? 'filter-button is-active' : 'filter-button'} type="button" key={item.id} onClick={() => setSessionIndex(index + 1)}>{item.label}</button>)}</div>}
    <LiveDataTable key={session.id} title={`${title} â€” ${event.label} â€” ${session.label}`} columns={sessionIndex ? stageColumns : raceColumns} loader={tableLoader} search />
  </>
}
