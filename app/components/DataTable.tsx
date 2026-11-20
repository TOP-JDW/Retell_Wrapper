'use client'
import Link from 'next/link'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { matchesSearch, nextDirection, sortRows, type Direction, type SortValue } from '../../lib/table'

export type Cell = { content: ReactNode; value?: SortValue; text?: string; className?: string }
export type Column = {
  label: string; className?: string; hideLabel?: boolean
  // 'none' turns sorting off. 'desc' starts with the largest or newest first.
  first?: Direction | 'none'
  // Sorting done by the server across every page: a link per direction, and which one is active.
  server?: { asc: string; desc: string; active?: Direction }
}
export type Row = { key: string; cells: Cell[] }

const searchFrom = 6   // a search box helps only once there are a few rows

// A table you can sort by clicking a column heading and search with the box above it.
export function DataTable({ label, columns, rows, search = 'auto', searchHint }: {
  label: string; columns: Column[]; rows: Row[]; search?: 'auto' | 'always' | 'never'; searchHint?: string
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ column: number; direction: Direction } | null>(null)
  const showSearch = search === 'always' || (search === 'auto' && rows.length >= searchFrom)

  const shown = useMemo(() => {
    const text = (row: Row) => row.cells.map(cell => cell.text ?? (typeof cell.value === 'string' || typeof cell.value === 'number' ? String(cell.value) : '')).join(' ')
    const found = query.trim() ? rows.filter(row => matchesSearch(text(row), query)) : rows
    return sort ? sortRows(found, row => row.cells[sort.column]?.value, sort.direction) : found
  }, [rows, query, sort])

  return <>
    {showSearch && <div className="table-tools">
      <label className="table-search"><span className="visually-hidden">Search {label}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={searchHint ?? 'Search'} aria-controls={id} autoComplete="off"/>
      </label>
      <span className="table-count" role="status">{query.trim() ? `${shown.length} of ${rows.length} shown` : ''}</span>
    </div>}
    <div className="table-scroll"><table id={id} aria-label={label}>
      <thead><tr>{columns.map((column, index) => {
        const server = column.server
        const active = server ? server.active : sort?.column === index ? sort.direction : undefined
        const ariaSort = active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : undefined
        const arrow = <span className={`sort-arrow${active ? ' on' : ''}`} aria-hidden="true">{active === 'asc' ? '↑' : active === 'desc' ? '↓' : '↕'}</span>
        if (column.first === 'none' && !server) return <th key={index} className={column.className}>{column.hideLabel ? <span className="visually-hidden">{column.label}</span> : column.label}</th>
        return <th key={index} className={column.className} aria-sort={ariaSort}>{server
          ? <Link className="sort" href={active === 'desc' ? server.asc : active === 'asc' ? server.desc : column.first === 'asc' ? server.asc : server.desc} scroll={false}>{column.label}{arrow}</Link>
          : <button type="button" className="sort" onClick={() => setSort({ column: index, direction: nextDirection(sort, index, column.first === 'desc' ? 'desc' : 'asc') })}>{column.label}{arrow}</button>}
        </th>
      })}</tr></thead>
      <tbody>{shown.map(row => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index} className={cell.className}>{cell.content}</td>)}</tr>)}
        {shown.length === 0 && <tr><td colSpan={columns.length} className="no-match">Nothing matches “{query.trim()}”.</td></tr>}
      </tbody>
    </table></div>
  </>
}
