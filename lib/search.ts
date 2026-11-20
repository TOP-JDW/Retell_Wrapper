// Ranking for quick search. Kept free of imports so tests can load it directly.
export type SearchItem = { kind: 'page' | 'agent' | 'client'; label: string; hint: string; href: string }

const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Higher is better; 0 means no match. Every word typed must appear somewhere in the name.
export function score(query: string, label: string): number {
  const q = fold(query).trim()
  if (!q) return 1
  const name = fold(label)
  const words = q.split(/\s+/)
  if (!words.every(word => name.includes(word))) return 0
  if (name === q) return 100
  if (name.startsWith(q)) return 80
  if (name.split(/[\s\-–—_/]+/).some(part => part.startsWith(words[0]))) return 60
  return 40 - Math.min(30, name.indexOf(words[0]))
}

const kindOrder = { page: 0, agent: 1, client: 2 }

export function search(query: string, items: SearchItem[], limit = 12): SearchItem[] {
  return items
    .map((item, index) => ({ item, index, s: score(query, item.label) }))
    .filter(r => r.s > 0)
    .sort((x, y) => (query.trim() ? y.s - x.s : 0) || kindOrder[x.item.kind] - kindOrder[y.item.kind] || x.index - y.index)
    .slice(0, limit)
    .map(r => r.item)
}
