import { useEffect, useMemo, useState } from 'react'
import type { RaceEvent, RaceEventsLoader } from '../../types/league'
import { ErrorState, LoadingState } from './States'
import { LiveDataTable, type LiveColumn } from './LiveDataTable'
import type { PngExportOptions } from '../../utils/tableExport'
import {
  certificateWinners,
  downloadRaceWinnerCertificates,
  type CertificateLeague,
} from '../../utils/raceWinnerCertificate'

const raceColumns: LiveColumn[] = [
  { key: 'position', label: 'Pos' },
  { key: 'driver', label: 'Driver' },
  { key: 'start', label: 'Start' },
  { key: 'interval', label: 'Int' },
  { key: 'laps', label: 'Laps' },
  { key: 'led', label: 'Led' },
  { key: 'racePoints', label: 'Race Pts' },
  { key: 'stagePoints', label: 'Stg Pts' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'penalty', label: 'Pen' },
  { key: 'total', label: 'Total' },
  { key: 'incidents', label: 'Inc' },
  { key: 'status', label: 'Status' },
  { key: 'passes', label: 'Passes' },
  { key: 'quality', label: 'Quality' },
]
const stageColumns: LiveColumn[] = [
  { key: 'position', label: 'Pos' },
  { key: 'driver', label: 'Driver' },
  { key: 'stagePoints', label: 'Stage Pts' },
]

const podiumClass = (row: Record<string, string | number>) =>
  Number(row.podiumPosition ?? row.position) === 1
    ? 'results-row--gold'
    : Number(row.podiumPosition ?? row.position) === 2
      ? 'results-row--silver'
      : Number(row.podiumPosition ?? row.position) === 3
        ? 'results-row--bronze'
        : ''

export function RaceResultsExplorer({
  title,
  loader,
  columns,
  secondaryColumns,
  overallColumns,
  overallPngOptions,
  league,
}: {
  title: string
  loader: RaceEventsLoader
  columns?: LiveColumn[]
  secondaryColumns?: LiveColumn[]
  overallColumns?: LiveColumn[]
  overallPngOptions?: PngExportOptions
  league: CertificateLeague
}) {
  const [events, setEvents] = useState<RaceEvent[]>([])
  const [eventIndex, setEventIndex] = useState(0)
  const [sessionIndex, setSessionIndex] = useState(0)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [season, setSeason] = useState('')
  const [certificateStatus, setCertificateStatus] = useState('')
  const [showCertificateClassPicker, setShowCertificateClassPicker] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    loader(controller.signal)
      .then((result) => {
        setEvents(result.events)
        setSeason(result.season ?? '')
        const requestedEvent = new URLSearchParams(window.location.search).get('event')
        const requestedIndex = requestedEvent
          ? result.events.findIndex((event) =>
              event.sourceEventId === requestedEvent || String(event.id) === requestedEvent,
            )
          : -1
        setEventIndex(
          requestedIndex >= 0
            ? requestedIndex
            : (result.defaultEventIndex ?? Math.max(0, result.events.length - 1)),
        )
        setError('')
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'The data source returned an error.')
      })
    return () => controller.abort()
  }, [loader, retry])

  const event = events[eventIndex]
  const session = event?.sessions[sessionIndex] ?? event?.sessions[0]
  const tableLoader = useMemo(
    () => async () => ({ rows: session?.rows ?? [], label: event?.label }),
    [event?.label, session?.rows],
  )
  const winners = event && session ? certificateWinners(league, event, session) : []
  const requiresCertificateClass = league === 'gt' && session?.label === 'Overall' && winners.length > 1
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
  if (!event || !session) return <LoadingState label={`Loading ${title}…`} />

  const downloadCertificate = (className?: string) => {
    setShowCertificateClassPicker(false)
    setCertificateStatus('Preparing certificate PDF...')
    downloadRaceWinnerCertificates({ league, season, event, session, className })
      .then(() => setCertificateStatus('Winner certificate PDF downloaded.'))
      .catch((reason: unknown) =>
        setCertificateStatus(
          reason instanceof Error ? reason.message : 'The certificate could not be created.',
        ),
      )
  }

  return (
    <>
      <div className="results-controls">
        <label>
          <span>Select race</span>
          <select
            value={eventIndex}
            onChange={(change) => {
              setEventIndex(Number(change.target.value))
              setSessionIndex(0)
              setShowCertificateClassPicker(false)
            }}
          >
            {events.map((item, index) => (
              <option value={index} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button--compact"
          type="button"
          onClick={() => {
            setEventIndex(events.length - 1)
            setSessionIndex(0)
            setShowCertificateClassPicker(false)
          }}
        >
          Latest Race
        </button>
        {winners.length > 0 && (
          <button
            className="button button--compact button--secondary"
            type="button"
            onClick={() => {
              if (requiresCertificateClass) {
                setCertificateStatus('')
                setShowCertificateClassPicker(true)
                return
              }
              downloadCertificate()
            }}
          >
            Download Winner Cert{winners.length > 1 ? 's' : ''} PDF
          </button>
        )}
      </div>
      {showCertificateClassPicker && (
        <div className="certificate-class-prompt" role="dialog" aria-modal="true" aria-labelledby="certificate-class-title">
          <div className="certificate-class-prompt__panel">
            <p className="eyebrow">Race winner certificate</p>
            <h2 id="certificate-class-title">Select a class</h2>
            <p>Choose which class winner certificate you want to download.</p>
            <div className="certificate-class-prompt__actions">
              {winners.map((winner) => (
                <button
                  className="button button--compact"
                  type="button"
                  key={winner.className}
                  onClick={() => downloadCertificate(winner.className)}
                >
                  {winner.className}
                </button>
              ))}
              <button
                className="button button--compact button--secondary"
                type="button"
                onClick={() => setShowCertificateClassPicker(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {certificateStatus && <p className="data-note" role="status">{certificateStatus}</p>}
      <p className="results-legend">
        <span className="fastest-lap-dot" aria-hidden="true" /> Fastest lap
      </p>
      <LiveDataTable
        key={`${event.id}-${session.label}-${session.id}`}
        title={`${title} — ${event.label} — ${session.label}`}
        columns={
          session.label === 'Overall' && overallColumns
            ? overallColumns
            : sessionIndex
              ? (secondaryColumns ?? stageColumns)
              : (columns ?? raceColumns)
        }
        loader={tableLoader}
        toolbarActions={
          event.sessions.length > 1 ? (
            <div className="result-tabs" role="group" aria-label="Race session">
              {event.sessions.map((item, index) => (
                <button
                  className={sessionIndex === index ? 'filter-button is-active' : 'filter-button'}
                  type="button"
                  key={`${event.id}-${item.label}-${item.id}`}
                  onClick={() => {
                    setSessionIndex(index)
                    setShowCertificateClassPicker(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : undefined
        }
        search
        rowClassName={podiumClass}
        pngOptions={session.label === 'Overall' ? overallPngOptions : undefined}
      />
    </>
  )
}
