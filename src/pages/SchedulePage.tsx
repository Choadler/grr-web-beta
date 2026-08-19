import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bulkCalendarFilename, calendarFilename, googleCalendarUrl, icsCalendar, loadCombinedSchedule, monthDays, multiEventIcs, scheduleDisplay, shiftMonth, sortSchedule, updateScheduleParams, validMonth, type CombinedScheduleEvent, type ScheduleDisplay, type ScheduleSeries } from '../services/combinedSchedule'

type HistoryView = 'all' | 'upcoming' | 'completed'
type BulkScope = 'upcoming' | 'all'
const seriesLabels: Record<'all' | ScheduleSeries, string> = { all: 'All GRR series', cup: 'Cup Series', gt: 'GT League', indycar: 'IndyCar' }
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const currentMonth = () => validMonth(null)
const niceDate = (event: CombinedScheduleEvent) => event.date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${event.date}T12:00:00Z`)) : 'Date TBD'
const monthLabel = (month: string) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))

function downloadCalendar(content: string | undefined, filename: string) {
  if (!content) return
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function CalendarActions({ event }: { event: CombinedScheduleEvent }) {
  if (!event.date || event.state !== 'upcoming') return null
  const google = googleCalendarUrl(event, window.location.origin)
  return <div className="schedule-card__calendar" aria-label={`Calendar options for ${event.name}`}>
    {google && <a href={google} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>}
    <button type="button" onClick={() => downloadCalendar(icsCalendar(event, window.location.origin), calendarFilename(event))}>Download Calendar Event</button>
  </div>
}

function Winner({ event, compact = false }: { event: CombinedScheduleEvent; compact?: boolean }) {
  if (event.state !== 'completed') return null
  const winner = event.winners.length ? event.winners.join(' · ') : event.resultsUrl ? 'Results available' : 'Winner unavailable'
  return <div className={compact ? 'calendar-event__winner' : 'schedule-card__winner'}><span>{event.winners.length > 1 ? 'Winners' : 'Winner'}</span><strong>{winner}</strong></div>
}

function EventCard({ event }: { event: CombinedScheduleEvent }) {
  const body = <><div className="schedule-card__date"><strong>{niceDate(event)}</strong>{event.time && event.timezone ? <span>{event.time} {event.timezone}</span> : <span>{event.date ? 'All-day calendar date' : 'Time TBD'}</span>}</div><div className="schedule-card__main"><div className="schedule-card__badges"><span className={`series-badge series-badge--${event.series}`}>{event.seriesLabel}</span><span className={`event-status event-status--${event.state}`}>{event.statusLabel}</span></div><h3>{event.name}</h3><p>{event.season}{event.round ? ` · Round ${event.round}` : ''}{event.track && event.track !== event.name ? ` · ${event.track}` : ''}</p><Winner event={event} /></div></>
  return <article className={`schedule-card schedule-card--${event.state}`}>
    {event.resultsUrl ? <Link className="schedule-card__result-link" to={event.resultsUrl} aria-label={`View results for ${event.name}, ${event.seriesLabel}, ${event.season}`}>{body}<span className="schedule-card__view">View results →</span></Link> : <div className="schedule-card__content">{body}</div>}
    <CalendarActions event={event} />
  </article>
}

function CalendarEvent({ event }: { event: CombinedScheduleEvent }) {
  const [expanded, setExpanded] = useState(false)
  const content = <><span className="calendar-event__title">{event.name}</span><span className="calendar-event__meta">{event.seriesLabel} · {event.statusLabel}</span><Winner event={event} compact /></>
  if (event.resultsUrl) return <Link className={`calendar-event calendar-event--${event.series} calendar-event--${event.state}`} to={event.resultsUrl} aria-label={`View results for ${event.name}, ${event.seriesLabel}, ${event.season}`}>{content}</Link>
  return <div className="calendar-event-wrap"><button className={`calendar-event calendar-event--${event.series} calendar-event--${event.state}`} type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{content}</button>{expanded && <div className="calendar-event__details"><strong>{event.season}{event.round ? ` · Round ${event.round}` : ''}</strong><span>{event.track ?? 'Location unavailable'}</span><span>{event.time && event.timezone ? `${event.time} ${event.timezone}` : 'Time unavailable; calendar export is all day.'}</span><CalendarActions event={event} /></div>}</div>
}

function MonthCalendar({ events, month, setMonth }: { events: CombinedScheduleEvent[]; month: string; setMonth: (month: string) => void }) {
  const { leading, days } = monthDays(month)
  const dated = events.filter((event) => event.date?.startsWith(month))
  const byDate = new Map<string, CombinedScheduleEvent[]>()
  dated.forEach((event) => byDate.set(event.date!, [...(byDate.get(event.date!) ?? []), event]))
  return <section className="month-calendar" aria-labelledby="calendar-month-title">
    <div className="month-calendar__toolbar"><button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">← Previous</button><h2 id="calendar-month-title" aria-live="polite">{monthLabel(month)}</h2><div><button type="button" onClick={() => setMonth(currentMonth())}>Today</button><button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">Next →</button></div></div>
    {!dated.length && <p className="schedule-empty">No races match these filters in {monthLabel(month)}.</p>}
    <div className="month-calendar__weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day.slice(0, 3)}</span>)}</div>
    <div className="month-calendar__grid" role="grid" aria-label={`${monthLabel(month)} race calendar`}>{Array.from({ length: leading }, (_, index) => <div className="month-calendar__blank" aria-hidden="true" key={`blank-${index}`} />)}{days.map((date) => { const dayEvents = byDate.get(date) ?? []; return <section className={`month-calendar__day${dayEvents.length ? ' has-events' : ''}`} role="gridcell" aria-label={`${Number(date.slice(-2))}, ${dayEvents.length} race${dayEvents.length === 1 ? '' : 's'}`} key={date}><time dateTime={date}>{Number(date.slice(-2))}</time><div>{dayEvents.map((event) => <CalendarEvent event={event} key={event.id} />)}</div></section> })}</div>
    <div className="month-agenda" aria-label={`${monthLabel(month)} race agenda`}>{dated.length ? sortSchedule(dated, 'upcoming').map((event) => <div className="month-agenda__row" key={event.id}><time dateTime={event.date}>{niceDate(event)}</time><CalendarEvent event={event} /></div>) : <p className="schedule-empty">No races this month.</p>}</div>
  </section>
}

function BulkCalendar({ events, selectedSeason }: { events: CombinedScheduleEvent[]; selectedSeason: string }) {
  const [open, setOpen] = useState(false)
  const [series, setSeries] = useState<'all' | ScheduleSeries>('all')
  const [scope, setScope] = useState<BulkScope>('upcoming')
  const [useSeason, setUseSeason] = useState(selectedSeason !== 'all')
  const selected = events.filter((event) => (series === 'all' || event.series === series) && (scope === 'all' || event.state === 'upcoming') && (!useSeason || selectedSeason === 'all' || selectedSeason === 'current' && event.seasonStatus === 'active' || selectedSeason === `${event.series}:${event.seasonId}`))
  const exportCalendar = () => downloadCalendar(multiEventIcs(selected, window.location.origin), bulkCalendarFilename(series))
  return <section className="bulk-calendar" aria-labelledby="bulk-calendar-title"><button className="button" type="button" aria-expanded={open} aria-controls="bulk-calendar-options" onClick={() => setOpen(!open)}>Add Schedule to Calendar</button>{open && <div id="bulk-calendar-options"><div><p className="eyebrow">One-time calendar import</p><h2 id="bulk-calendar-title">Add a GRR schedule</h2><p>Download {selected.length} dated race{selected.length === 1 ? '' : 's'} as one calendar file. This is a one-time import, not a subscription; download again to receive later schedule changes.</p></div><div className="bulk-calendar__controls"><label><span>Series</span><select value={series} onChange={(event) => setSeries(event.target.value as 'all' | ScheduleSeries)}>{Object.entries(seriesLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Events included</span><select value={scope} onChange={(event) => setScope(event.target.value as BulkScope)}><option value="upcoming">Upcoming races only</option><option value="all">All available races, including history</option></select></label>{selectedSeason !== 'all' && <label className="bulk-calendar__check"><input type="checkbox" checked={useSeason} onChange={(event) => setUseSeason(event.target.checked)} /><span>Use the selected season filter</span></label>}</div><div className="bulk-calendar__actions"><button type="button" disabled={!selected.length} onClick={exportCalendar}>Download for Google Calendar import</button><button type="button" disabled={!selected.length} onClick={exportCalendar}>Download for Apple Calendar</button></div><p className="bulk-calendar__note">In Google Calendar, use Settings → Import &amp; export to import the downloaded file. Apple Calendar and other compatible apps can open it directly.</p></div>}</section>
}

export function SchedulePage() {
  const [params, setParams] = useSearchParams()
  const [events, setEvents] = useState<CombinedScheduleEvent[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [partial, setPartial] = useState<string[]>([])
  const series = (['all', 'cup', 'gt', 'indycar'].includes(params.get('series') ?? '') ? params.get('series') : 'all') as 'all' | ScheduleSeries
  const requestedHistory = params.get('history') ?? params.get('view')
  const history = (['all', 'upcoming', 'completed'].includes(requestedHistory ?? '') ? requestedHistory : 'all') as HistoryView
  const display = scheduleDisplay(params.get('display'))
  const month = validMonth(params.get('month'))
  const season = params.get('season') ?? 'current'
  useEffect(() => { const controller = new AbortController(); loadCombinedSchedule(controller.signal).then((result) => { setEvents(result.events); setPartial(result.unavailableSeries); setStatus('ready') }).catch((error) => { if (error?.name !== 'AbortError') setStatus('error') }); return () => controller.abort() }, [])
  const seasons = useMemo(() => [...new Map(events.filter((event) => series === 'all' || event.series === series).map((event) => [`${event.series}:${event.seasonId}`, event])).values()], [events, series])
  const update = (key: string, value: string, defaultValue: string) => setParams(updateScheduleParams(params, key, value, defaultValue))
  const seasonEvents = events.filter((event) => (series === 'all' || event.series === series) && (season === 'all' || season === 'current' && event.seasonStatus === 'active' || season === `${event.series}:${event.seasonId}`))
  const filtered = seasonEvents.filter((event) => history === 'all' || history === 'completed' && event.state === 'completed' || history === 'upcoming' && event.state !== 'completed')
  const upcoming = sortSchedule(filtered.filter((event) => event.state !== 'completed'), 'upcoming')
  const completed = sortSchedule(filtered.filter((event) => event.state === 'completed'), 'completed')
  const setDisplay = (value: ScheduleDisplay) => update('display', value, 'calendar')
  return <><header className="page-hero page-hero--compact schedule-hero"><div className="container"><p className="eyebrow">Every GRR series · One calendar</p><h1>Race Schedule</h1><p>Upcoming events and official results from the Cup Series, GT League, and IndyCar.</p></div></header><div className="page-content page-content--tight container schedule-page">
    <div className="schedule-view-toggle" role="group" aria-label="Schedule display"><button type="button" className={display === 'calendar' ? 'is-active' : ''} aria-pressed={display === 'calendar'} onClick={() => setDisplay('calendar')}>Calendar</button><button type="button" className={display === 'list' ? 'is-active' : ''} aria-pressed={display === 'list'} onClick={() => setDisplay('list')}>List</button></div>
    <form className="schedule-filters" aria-label="Schedule filters" onReset={(event) => { event.preventDefault(); setParams(display === 'list' ? { display: 'list' } : {}) }}><label><span>Series</span><select value={series} onChange={(event) => update('series', event.target.value, 'all')}>{Object.entries(seriesLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Season</span><select value={season} onChange={(event) => update('season', event.target.value, 'current')}><option value="current">Current seasons</option><option value="all">All seasons</option>{seasons.map((event) => <option value={`${event.series}:${event.seasonId}`} key={`${event.series}:${event.seasonId}`}>{series === 'all' ? `${event.seriesLabel} · ` : ''}{event.season}{event.seasonStatus === 'active' ? ' — Current' : ''}</option>)}</select></label><fieldset><legend>Event history</legend>{(['all', 'upcoming', 'completed'] as HistoryView[]).map((item) => <button type="button" className={history === item ? 'filter-button is-active' : 'filter-button'} aria-pressed={history === item} onClick={() => update('history', item, 'all')} key={item}>{item === 'all' ? 'All events' : item[0].toUpperCase() + item.slice(1)}</button>)}</fieldset><button className="schedule-filters__reset" type="reset">Reset filters</button></form>
    <BulkCalendar events={events} selectedSeason={season} />
    {status === 'loading' && <div className="state-message" role="status">Loading the complete GRR schedule…</div>}{status === 'error' && <div className="state-message" role="alert"><strong>Schedule unavailable</strong><p>Please try again shortly.</p></div>}{partial.length > 0 && <p className="schedule-notice" role="status">Some series are temporarily unavailable; available schedule data is shown.</p>}
    {status === 'ready' && display === 'calendar' && <MonthCalendar events={filtered} month={month} setMonth={(value) => update('month', value, currentMonth())} />}
    {status === 'ready' && display === 'list' && history !== 'completed' && <section className="schedule-section" aria-labelledby="upcoming-title"><div className="schedule-section__heading"><div><p className="eyebrow">Next on track</p><h2 id="upcoming-title">Upcoming Events</h2></div><span>{upcoming.length} event{upcoming.length === 1 ? '' : 's'}</span></div>{upcoming.length ? <div className="schedule-list">{upcoming.map((event) => <EventCard event={event} key={event.id} />)}</div> : <p className="schedule-empty">No upcoming events match these filters.</p>}</section>}
    {status === 'ready' && display === 'list' && history !== 'upcoming' && <section className="schedule-section schedule-section--past" aria-labelledby="past-title"><div className="schedule-section__heading"><div><p className="eyebrow">Official history</p><h2 id="past-title">Completed Races</h2></div><span>{completed.length} race{completed.length === 1 ? '' : 's'}</span></div>{completed.length ? <div className="schedule-list">{completed.map((event) => <EventCard event={event} key={event.id} />)}</div> : <p className="schedule-empty">No completed races match these filters.</p>}</section>}
  </div></>
}
