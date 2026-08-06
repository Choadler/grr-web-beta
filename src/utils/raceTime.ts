const easternParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export function normalizeScheduleDate(value: string) {
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  if (iso) return iso
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : ''
}

export function easternRaceTime(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  const estimate = Date.UTC(year, month - 1, day, 20)
  const parts = Object.fromEntries(
    easternParts.formatToParts(estimate).map((part) => [part.type, Number(part.value)]),
  )
  const offset =
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    estimate
  return estimate - offset
}

export function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`
}
