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

const easternDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const monthNumbers: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const calendarDate = (year: number, month: number, day: number) => {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function normalizeScheduleDate(value: string) {
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  if (iso) return iso

  const numeric = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/)
  if (numeric) return calendarDate(Number(numeric[3]), Number(numeric[1]), Number(numeric[2]))

  const named = value.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i,
  )
  if (named)
    return calendarDate(Number(named[3]), monthNumbers[named[1].slice(0, 3).toLowerCase()], Number(named[2]))

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return ''
  const parts = Object.fromEntries(
    easternDateParts.formatToParts(parsed).map((part) => [part.type, Number(part.value)]),
  )
  return calendarDate(parts.year, parts.month, parts.day)
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

