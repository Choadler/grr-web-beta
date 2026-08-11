import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DataLoader, TableRow } from '../../types/league'
import { copyPng, downloadCsv, type PngExportOptions } from '../../utils/tableExport'
import { DataTable, EmptyTableRow } from './DataTable'
import { ErrorState, LoadingState } from './States'

export type LiveColumn = {
  key: string
  label: string
  link?: boolean
  cellClassName?: (value: string | number, row: TableRow) => string
}

export function LiveDataTable({
  title,
  columns,
  loader,
  search = false,
  rowClassName,
  toolbarActions,
  tableClassName,
  pngOptions,
  rowLink,
}: {
  title: string
  columns: LiveColumn[]
  loader: DataLoader
  search?: boolean
  rowClassName?: (row: TableRow) => string
  toolbarActions?: ReactNode
  tableClassName?: string
  pngOptions?: PngExportOptions
  rowLink?: (row: TableRow) => string | undefined
}) {
  const [rows, setRows] = useState<TableRow[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null)
  const [pngStatus, setPngStatus] = useState<
    'idle' | 'copying' | 'copied' | 'downloaded' | 'error'
  >('idle')

  useEffect(() => {
    const controller = new AbortController()
    loader(controller.signal)
      .then((result) => {
        setRows(result.rows)
        setMessage(result.updated || result.label || '')
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setMessage(error instanceof Error ? error.message : 'The data source returned an error.')
        setStatus('error')
      })
    return () => controller.abort()
  }, [loader, retry])

  const reload = () => {
    setStatus('loading')
    setRetry((value) => value + 1)
  }

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? rows.filter((row) =>
          Object.values(row).some((value) => String(value).toLowerCase().includes(needle)),
        )
      : [...rows]
    if (!sort) return filtered
    return filtered.sort((left, right) => {
      const a = left[sort.key] ?? ''
      const b = right[sort.key] ?? ''
      return (
        (typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b), undefined, { numeric: true })) * sort.direction
      )
    })
  }, [query, rows, sort])

  const handleCopyPng = async () => {
    setPngStatus('copying')
    try {
      const result = await copyPng(title, columns, visibleRows, pngOptions)
      setPngStatus(result)
      window.setTimeout(() => setPngStatus('idle'), 2500)
    } catch {
      setPngStatus('error')
      window.setTimeout(() => setPngStatus('idle'), 3000)
    }
  }

  if (status === 'loading') return <LoadingState label={`Loading ${title}…`} />
  if (status === 'error') return <ErrorState message={message} onRetry={reload} />

  return (
    <>
      <div className="data-toolbar">
        {search && (
          <label className="search-field">
            <span>Search table</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search…"
            />
          </label>
        )}
        {toolbarActions}
        <div className="export-controls" aria-label="Table export controls">
          <button
            className="button button--compact"
            type="button"
            disabled={!visibleRows.length}
            onClick={() => downloadCsv(title, columns, visibleRows)}
          >
            Export CSV
          </button>
          <button
            className="button button--compact button--secondary"
            type="button"
            disabled={!visibleRows.length || pngStatus === 'copying'}
            onClick={handleCopyPng}
            aria-live="polite"
          >
            {pngStatus === 'copying'
              ? 'Copying...'
              : pngStatus === 'copied'
                ? 'Copied to Clipboard'
                : pngStatus === 'downloaded'
                  ? 'PNG Downloaded'
                  : pngStatus === 'error'
                    ? 'Copy Failed'
                    : 'Copy PNG'}
          </button>
          <button
            className="button button--compact button--secondary"
            type="button"
            onClick={reload}
          >
            Refresh
          </button>
        </div>
      </div>
      {message && <p className="data-note">{message}</p>}
      <DataTable
        caption={title}
        columns={columns.map((column) => column.label)}
        className={tableClassName}
        header={(column) => {
          const item = columns.find((candidate) => candidate.label === column)
          if (!item) return column
          const active = sort?.key === item.key
          return (
            <button
              className="sort-button"
              type="button"
              onClick={() =>
                setSort(
                  active
                    ? { key: item.key, direction: sort.direction === 1 ? -1 : 1 }
                    : { key: item.key, direction: 1 },
                )
              }
            >
              {column}
              <span aria-hidden="true">{active ? (sort.direction === 1 ? ' ↑' : ' ↓') : ''}</span>
            </button>
          )
        }}
      >
        {visibleRows.map((row, index) => (
          <tr
            className={rowClassName?.(row)}
            key={`${String(row.driver ?? row.track ?? 'row')}-${index}`}
          >
            {columns.map((column) => (
              <td className={column.cellClassName?.(row[column.key] ?? '', row)} key={column.key}>
                {rowLink?.(row) && column.key === 'track' ? (
                  <Link className="data-table__race-link" to={rowLink(row)!}>
                    {row[column.key]}
                  </Link>
                ) : column.link && row[column.key] ? (
                  <a href={String(row[column.key])} target="_blank" rel="noreferrer">
                    View<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <>
                    {row[column.key]}
                    {column.key === 'driver' && Boolean(row.fastestLap) && (
                      <span className="fastest-lap-dot" title="Fastest lap">
                        <span className="sr-only"> Fastest lap</span>
                      </span>
                    )}
                  </>
                )}
              </td>
            ))}
          </tr>
        ))}
        {!visibleRows.length && (
          <EmptyTableRow
            columns={columns.length}
            message={query ? 'No rows match your search.' : 'No data is currently available.'}
          />
        )}
      </DataTable>
      <p className="table-hint">Mobile: swipe left/right · Select a column heading to sort</p>
    </>
  )
}
