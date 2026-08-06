import type { TableRow } from '../types/league'

export type ExportColumn = { key: string; label: string }

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

export async function copyPng(title: string, columns: ExportColumn[], rows: TableRow[]) {
  const visibleRows = rows.slice(0, 100)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not supported in this browser.')

  const cellPadding = 24
  context.font = '14px Arial'
  const widths = columns.map((column) => {
    const headerWidth = context.measureText(column.label.toUpperCase()).width
    const contentWidth = Math.max(...visibleRows.map((row) => context.measureText(String(row[column.key] ?? '')).width), 0)
    return Math.ceil(Math.max(88, Math.min(380, Math.max(headerWidth, contentWidth) + cellPadding)))
  })
  const width = Math.max(900, widths.reduce((total, value) => total + value, 0))
  const rowHeight = 38
  const height = 86 + rowHeight * (visibleRows.length + 1)
  canvas.width = width
  canvas.height = height

  context.fillStyle = '#111511'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#fff'
  context.font = '700 22px Arial'
  context.fillText(title, 18, 34)
  context.fillStyle = '#65bd59'
  context.fillRect(0, 54, width, rowHeight)
  context.font = '700 12px Arial'
  context.fillStyle = '#081006'

  let x = 12
  columns.forEach((column, index) => {
    context.fillText(fitText(context, column.label.toUpperCase(), widths[index] - cellPadding), x, 78)
    x += widths[index]
  })

  context.font = '14px Arial'
  visibleRows.forEach((row, rowIndex) => {
    const y = 92 + rowIndex * rowHeight
    context.fillStyle = rowIndex % 2 ? '#192018' : '#111511'
    context.fillRect(0, y, width, rowHeight)
    context.fillStyle = '#fff'
    x = 12
    columns.forEach((column, index) => {
      const value = String(row[column.key] ?? '')
      context.fillText(fitText(context, value, widths[index] - cellPadding), x, y + 25)
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
