import type { TableRow } from '../types/league'

export type ExportColumn = { key: string; label: string }
export type PngExportOptions = { preset?: 'gt-overall-discord' }

const safeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(title: string, columns: ExportColumn[], rows: TableRow[]) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const lines = [columns.map((column) => escape(column.label)).join(',')]
  rows.forEach((row) => lines.push(columns.map((column) => escape(row[column.key] ?? '')).join(',')))
  download(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${safeName(title)}.csv`)
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) return value
  let end = value.length
  while (end > 0 && context.measureText(`${value.slice(0, end)}…`).width > maxWidth) end -= 1
  return `${value.slice(0, end)}…`
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The PNG could not be created.')), 'image/png')
  })
}

export async function copyPng(
  title: string,
  columns: ExportColumn[],
  rows: TableRow[],
  options: PngExportOptions = {},
) {
  const visibleRows = rows.slice(0, 100)
  const isGtOverall = options.preset === 'gt-overall-discord'
  const exportColumns = isGtOverall
    ? columns.filter((column) => column.key !== 'penalty')
    : columns
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not supported in this browser.')

  const cellPadding = isGtOverall ? 20 : 24
  const bodyFont = isGtOverall ? '16px Arial' : '14px Arial'
  context.font = bodyFont
  const gtWidths: Record<string, number> = {
    position: 115, driver: 285, class: 125, car: 245, start: 90, interval: 120,
    laps: 85, racePoints: 120, bonus: 95, total: 105, incidents: 85, status: 130,
  }
  const widths = exportColumns.map((column) => {
    if (isGtOverall && gtWidths[column.key]) return gtWidths[column.key]
    const headerWidth = context.measureText(column.label.toUpperCase()).width
    const contentWidth = Math.max(...visibleRows.map((row) => context.measureText(String(row[column.key] ?? '')).width), 0)
    return Math.ceil(Math.max(88, Math.min(380, Math.max(headerWidth, contentWidth) + cellPadding)))
  })
  const width = Math.max(900, widths.reduce((total, value) => total + value, 0))
  const rowHeight = isGtOverall ? 44 : 38
  const titleHeight = isGtOverall ? 70 : 54
  const height = titleHeight + rowHeight * (visibleRows.length + 1)
  canvas.width = width
  canvas.height = height

  context.fillStyle = '#111511'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#fff'
  context.font = isGtOverall ? '700 26px Arial' : '700 22px Arial'
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(title, 20, titleHeight / 2)
  context.fillStyle = '#65bd59'
  context.fillRect(0, titleHeight, width, rowHeight)
  context.font = isGtOverall ? '700 13px Arial' : '700 12px Arial'
  context.fillStyle = '#081006'

  let x = 0
  exportColumns.forEach((column, index) => {
    context.textAlign = isGtOverall ? 'center' : 'left'
    context.fillText(
      fitText(context, column.label.toUpperCase(), widths[index] - cellPadding),
      isGtOverall ? x + widths[index] / 2 : x + 12,
      titleHeight + rowHeight / 2,
    )
    x += widths[index]
  })

  const classPlaces = new Map<string, number>()
  context.font = bodyFont
  visibleRows.forEach((row, rowIndex) => {
    const y = titleHeight + rowHeight + rowIndex * rowHeight
    context.fillStyle = rowIndex % 2 ? '#192018' : '#111511'
    context.fillRect(0, y, width, rowHeight)
    context.fillStyle = '#fff'
    x = 0
    const className = String(row.class ?? '').trim()
    const countedClassPlace = className ? (classPlaces.get(className) ?? 0) + 1 : 0
    if (className) classPlaces.set(className, countedClassPlace)
    const classPlace = Number(row.podiumPosition ?? countedClassPlace)
    exportColumns.forEach((column, index) => {
      let value = String(row[column.key] ?? '')
      if (isGtOverall && column.key === 'driver') {
        const medal = classPlace === 1 ? '🥇' : classPlace === 2 ? '🥈' : classPlace === 3 ? '🥉' : ''
        value = medal ? `${medal} ${value}` : value
      }
      const hasFastestLap = isGtOverall && column.key === 'driver' && Boolean(row.fastestLap)
      const fitted = fitText(context, value, widths[index] - cellPadding - (hasFastestLap ? 20 : 0))
      if (isGtOverall) {
        const dotSpace = hasFastestLap ? 18 : 0
        const textWidth = context.measureText(fitted).width
        const startX = x + (widths[index] - textWidth - dotSpace) / 2
        context.textAlign = 'left'
        context.fillStyle = '#fff'
        context.fillText(fitted, startX, y + rowHeight / 2)
        if (hasFastestLap) {
          context.beginPath()
          context.fillStyle = '#a855f7'
          context.arc(startX + textWidth + 10, y + rowHeight / 2, 6, 0, Math.PI * 2)
          context.fill()
          context.strokeStyle = '#d8b4fe'
          context.lineWidth = 1.5
          context.stroke()
        }
      } else {
        context.textAlign = 'left'
        context.fillText(fitted, x + 12, y + rowHeight / 2)
      }
      x += widths[index]
    })
  })

  const blob = await canvasToBlob(canvas)
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'copied' as const
    } catch {
      download(blob, `${safeName(title)}.png`)
      return 'downloaded' as const
    }
  }

  download(blob, `${safeName(title)}.png`)
  return 'downloaded' as const
}
