// Searching and sorting for tables. Kept free of imports so tests can load it directly.
export type SortValue = string | number | null | undefined
export type Direction = 'asc' | 'desc'

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })

// Numbers sort as numbers, text in dictionary order. Empty values always go last.
export function compareValues(a: SortValue, b: SortValue, direction: Direction): number {
  const emptyA = a === null || a === undefined || a === '', emptyB = b === null || b === undefined || b === ''
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1
  const result = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b))
  return direction === 'asc' ? result : -result
}

// Sorts rows by one column. Rows that compare equal keep their order.
export function sortRows<T>(rows: T[], value: (row: T) => SortValue, direction: Direction): T[] {
  return rows.map((row, index) => ({ row, index }))
    .sort((x, y) => compareValues(value(x.row), value(y.row), direction) || x.index - y.index)
    .map(item => item.row)
}

// Every word typed must appear somewhere in the row, in any order, ignoring case and accents.
export function matchesSearch(text: string, query: string): boolean {
  const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const haystack = fold(text)
  return fold(query).split(/\s+/).filter(Boolean).every(word => haystack.includes(word))
}

// The first click on a column sorts A to Z or smallest first; dates and lengths start with the largest.
export function nextDirection(current: { column: number; direction: Direction } | null, column: number, firstDirection: Direction): Direction {
  return current?.column === column ? (current.direction === 'asc' ? 'desc' : 'asc') : firstDirection
}
