import type { ReactNode } from 'react'

export function DataTable({
  caption,
  columns,
  children,
}: {
  caption: string
  columns: string[]
  children?: ReactNode
}) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={`${caption}, scrollable`}>
      <table className="data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function EmptyTableRow({ columns, message }: { columns: number; message: string }) {
  return (
    <tr>
      <td className="table-empty" colSpan={columns}>
        {message}
      </td>
    </tr>
  )
}
