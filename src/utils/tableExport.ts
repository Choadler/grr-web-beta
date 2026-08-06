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

export function downloadPng(title: string, columns: ExportColumn[], rows: TableRow[]) {
  const widths = columns.map((column) => Math.max(110, Math.min(260, column.label.length * 10 + 36)))
  const width = Math.min(4096, Math.max(900, widths.reduce((total, value) => total + value, 0)))
  const visibleRows = rows.slice(0, 100)
  const rowHeight = 38
  const height = 86 + rowHeight * (visibleRows.length + 1)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return

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
    context.fillText(column.label.toUpperCase(), x, 78)
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
      context.fillText(value.length > 30 ? `${value.slice(0, 29)}…` : value, x, y + 25)
      x += widths[index]
    })
  })
  canvas.toBlob((blob) => blob && download(blob, `${safeName(title)}.png`), 'image/png')
}
