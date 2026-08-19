import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { calendarFilename, googleCalendarUrl, icsCalendar, loadCombinedSchedule, sortSchedule, type CombinedScheduleEvent, type ScheduleSeries } from '../services/combinedSchedule'

type View = 'all' | 'upcoming' | 'completed'

const seriesLabels: Record<'all' | ScheduleSeries, string> = { all: 'All series', cup: 'Cup Series', gt: 'GT League', indycar: 'IndyCar' }
const niceDate = (event: CombinedScheduleEvent) => event.date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${event.date}T12:00:00Z`)) : 'Date TBD'

function CalendarActions({ event }: { event: CombinedScheduleEvent }) {
  if (!event.date || event.state !== 'upcoming') return null
  const origin = window.location.origin
  const google = googleCalendarUrl(event, origin)
  const download = () => {
    const content = icsCalendar(event, origin)
    if (!content) return
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = calendarFilename(event); anchor.click(); URL.revokeObjectURL(url)
  }
  return <div className="schedule-card__calendar" aria-label={`Calendar options for ${event.name}`}>
    {google && <a href={google} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>}
    <button type="button" onClick={download}>Download Calendar Event</button>
  </div>
}

function EventCard({ event }: { event: CombinedScheduleEvent }) {
  const body = <>
    <div className="schedule-card__date"><strong>{niceDate(event)}</strong>{event.time && event.timezone ? <span>{event.time} {event.timezone}</span> : <span>{event.date ? 'All-day calendar date' : 'Time TBD'}</span>}</div>
    <div className="schedule-card__main"><div className="schedule-card__badges"><span className={`series-badge series-badge--${event.series}`}>{event.seriesLabel}</span><span className={`event-status event-status--${event.state}`}>{event.statusLabel}</span></div><h3>{event.name}</h3><p>{event.season}{event.round ? ` · Round ${event.round}` : ''}{event.track && event.track !== event.name ? ` · ${event.track}` : ''}</p>{event.state === 'completed' && <div className="schedule-card__winner"><span>{event.winners.length > 1 ? 'Winners' : 'Winner'}</span><strong>{event.winners.length ? event.winners.join(' · ') : event.resultsUrl ? 'Results available' : 'Winner unavailable'}</strong></div>}</div>
  </>
  return <article className={`schedule-card schedule-card--${event.state}`}>
    {event.resultsUrl ? <Link className="schedule-card__result-link" to={event.resultsUrl} aria-label={`View results for ${event.name}, ${event.seriesLabel}, ${event.season}`}>{body}<span className="schedule-card__view">View results →</span></Link> : <div className="schedule-card__content">{body}</div>}
    <CalendarActions event={event} />
  </article>
}

export function SchedulePage() {
  const [params, setParams] = useSearchParams()
  const [events, setEvents] = useState<CombinedScheduleEvent[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [partial, setPartial] = useState<string[]>([])
  const series = (['all', 'cup', 'gt', 'indycar'].includes(params.get('series') ?? '') ? params.get('series') : 'all') as 'all' | ScheduleSeries
  const view = (['all', 'upcoming', 'completed'].includes(params.get('view') ?? '') ? params.get('view') : 'all') as View
  const season = params.get('season') ?? 'current'

  useEffect(() => { const controller = new AbortController(); loadCombinedSchedule(controller.signal).then((result) => { setEvents(result.events); setPartial(result.unavailableSeries); setStatus('ready') }).catch((error) => { if (error?.name !== 'AbortError') setStatus('error') }); return () => controller.abort() }, [])
  const seasons = useMemo(() => [...new Map(events.filter((event) => series === 'all' || event.series === series).map((event) => [`${event.series}:${event.seasonId}`, event])).values()], [events, series])
  const update = (key: string, value: string, defaultValue: string) => { const next = new URLSearchParams(params); if (value === defaultValue) next.delete(key); else next.set(key, value); if (key === 'series') next.delete('season'); setParams(next, { replace: true }) }
  const filtered = events.filter((event) => (series === 'all' || event.series === series) && (season === 'all' || season === 'current' && event.seasonStatus === 'active' || season === `${event.series}:${event.seasonId}`))
  const upcoming = sortSchedule(filtered.filter((event) => event.state !== 'completed'), 'upcoming')
  const completed = sortSchedule(filtered.filter((event) => event.state === 'completed'), 'completed')

  return <><header className="page-hero page-hero--compact schedule-hero"><div className="container"><p className="eyebrow">Every GRR series · One calendar</p><h1>Race Schedule</h1><p>Upcoming events and official results from the Cup Series, GT League, and IndyCar.</p></div></header><div className="page-content page-content--tight container schedule-page">
    <form className="schedule-filters" aria-label="Schedule filters" onReset={(event) => { event.preventDefault(); setParams({}, { replace: true }) }}><label><span>Series</span><select value={series} onChange={(event) => update('series', event.target.value, 'all')}>{Object.entries(seriesLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Season</span><select value={season} onChange={(event) => update('season', event.target.value, 'current')}><option value="current">Current seasons</option><option value="all">All seasons</option>{seasons.map((event) => <option value={`${event.series}:${event.seasonId}`} key={`${event.series}:${event.seasonId}`}>{series === 'all' ? `${event.seriesLabel} · ` : ''}{event.season}{event.seasonStatus === 'active' ? ' — Current' : ''}</option>)}</select></label><fieldset><legend>Event history</legend>{(['all', 'upcoming', 'completed'] as View[]).map((item) => <button type="button" className={view === item ? 'filter-button is-active' : 'filter-button'} aria-pressed={view === item} onClick={() => update('view', item, 'all')} key={item}>{item === 'all' ? 'All events' : item[0].toUpperCase() + item.slice(1)}</button>)}</fieldset><button className="schedule-filters__reset" type="reset">Reset filters</button></form>
    {status === 'loading' && <div className="state-message" role="status">Loading the complete GRR schedule…</div>}
    {status === 'error' && <div className="state-message" role="alert"><strong>Schedule unavailable</strong><p>Please try again shortly.</p></div>}
    {partial.length > 0 && <p className="schedule-notice" role="status">Some series are temporarily unavailable; available schedule data is shown.</p>}
    {status === 'ready' && view !== 'completed' && <section className="schedule-section" aria-labelledby="upcoming-title"><div className="schedule-section__heading"><div><p className="eyebrow">Next on track</p><h2 id="upcoming-title">Upcoming Events</h2></div><span>{upcoming.length} event{upcoming.length === 1 ? '' : 's'}</span></div>{upcoming.length ? <div className="schedule-list">{upcoming.map((event) => <EventCard event={event} key={event.id} />)}</div> : <p className="schedule-empty">No upcoming events match these filters.</p>}</section>}
    {status === 'ready' && view !== 'upcoming' && <section className="schedule-section schedule-section--past" aria-labelledby="past-title"><div className="schedule-section__heading"><div><p className="eyebrow">Official history</p><h2 id="past-title">Completed Races</h2></div><span>{completed.length} race{completed.length === 1 ? '' : 's'}</span></div>{completed.length ? <div className="schedule-list">{completed.map((event) => <EventCard event={event} key={event.id} />)}</div> : <p className="schedule-empty">No completed races match these filters.</p>}</section>}
  </div></>
}
