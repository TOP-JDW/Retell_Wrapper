import ExcelJS from 'exceljs'

// Builds the Excel file for a Call History export. Self-contained so tests can load it directly.
export const maximumExportRows = 10_000

export type ExportCall = {
  id: string; started_at: string; agent_name: string; client_name: string | null; call_status: string | null
  call_type: string | null; direction: string | null; disconnection_reason: string | null; duration_ms: number | null; retell_call_id: string
}

const london = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

// Excel has no time zones, so the UK wall-clock time is stored as the cell's date and time.
export function ukWallClock(iso: string): Date | null {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const p = Object.fromEntries(london.formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second))
}

const words = (value: string | null) => (value ? value.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : '')

export async function buildCallWorkbook(calls: ExportCall[], about: { filters: string; truncated: boolean; origin: string; exportedAt: Date }) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'The One Point AI Voice'
  workbook.created = about.exportedAt
  const sheet = workbook.addWorksheet('Calls', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Started (UK time)', key: 'started', width: 20, style: { numFmt: 'dd mmm yyyy hh:mm' } },
    { header: 'Agent', key: 'agent', width: 40 },
    { header: 'Client', key: 'client', width: 24 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Type', key: 'type', width: 11 },
    { header: 'Length', key: 'length', width: 10, style: { numFmt: '[m]:ss' } },
    { header: 'Ended because', key: 'reason', width: 26 },
    { header: 'Retell call ID', key: 'retell', width: 36 },
    { header: 'Open in the portal', key: 'link', width: 20 }
  ]
  for (const call of calls) {
    sheet.addRow({
      started: ukWallClock(call.started_at),
      agent: call.agent_name,
      client: call.client_name ?? 'No client',
      status: words(call.call_status),
      type: call.call_type === 'web_call' ? 'Web' : words(call.direction),
      length: typeof call.duration_ms === 'number' && call.duration_ms >= 0 ? call.duration_ms / 86_400_000 : null,
      reason: words(call.disconnection_reason),
      retell: call.retell_call_id,
      link: { text: 'Open call', hyperlink: `${about.origin}/calls/${call.id}` }
    })
  }
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3C97' } }
  sheet.autoFilter = { from: 'A1', to: 'I1' }

  const info = workbook.addWorksheet('About this export')
  info.columns = [{ width: 22 }, { width: 70 }]
  info.addRows([
    ['Exported', about.exportedAt.toISOString()],
    ['Filters', about.filters || 'None'],
    ['Calls', calls.length],
    ['Note', about.truncated ? `Only the ${maximumExportRows.toLocaleString('en-GB')} newest matching calls are included. Narrow the filters to export older ones.` : 'All matching calls are included.'],
    ['Times', 'UK time. Lengths are minutes and seconds.']
  ])
  info.getColumn(1).font = { bold: true }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export type UsageRow = { client: string; total: number; connected: number; duration_ms: number; cost_cents: number; costed: number }

// The Usage & Cost page for one month as an Excel file, one row per client, for invoicing.
export async function buildUsageWorkbook(rows: UsageRow[], about: { month: string; exportedAt: Date }) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'The One Point AI Voice'
  workbook.created = about.exportedAt
  const sheet = workbook.addWorksheet('Usage', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Client', key: 'client', width: 30 },
    { header: 'Calls', key: 'total', width: 10 },
    { header: 'Connected', key: 'connected', width: 12 },
    { header: 'Minutes', key: 'minutes', width: 12, style: { numFmt: '#,##0.0' } },
    { header: 'Retell cost (USD)', key: 'cost', width: 18, style: { numFmt: '$#,##0.00' } },
    { header: 'Calls without a cost', key: 'missing', width: 20 }
  ]
  for (const row of rows) sheet.addRow({ client: row.client, total: row.total, connected: row.connected, minutes: row.duration_ms / 60000,
    cost: row.cost_cents / 100, missing: row.total - row.costed })
  const last = rows.length + 1
  const totals = sheet.addRow({ client: 'Total', total: { formula: `SUM(B2:B${last})` }, connected: { formula: `SUM(C2:C${last})` },
    minutes: { formula: `SUM(D2:D${last})` }, cost: { formula: `SUM(E2:E${last})` }, missing: { formula: `SUM(F2:F${last})` } })
  totals.font = { bold: true }
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3C97' } }
  const info = workbook.addWorksheet('About this export')
  info.columns = [{ width: 22 }, { width: 80 }]
  info.addRows([
    ['Month', about.month],
    ['Exported', about.exportedAt.toISOString()],
    ['Costs', 'What Retell charged, in US dollars, before any margin. Transfer calls are included.'],
    ['Minutes', 'Total call length, including calls that did not connect.']
  ])
  info.getColumn(1).font = { bold: true }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}
