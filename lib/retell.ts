// Read-only Retell client. It reads no settings and imports nothing, so tests can load it directly.
// It can make exactly three requests, all of which only read data. Nothing here can change Retell.
export const retellOrigin = 'https://api.retellai.com'
export const maximumCalls = 1000
const maximumAgentPages = 10

const listPaths = ['/v2/list-agents', '/v3/list-calls'] as const
type ListPath = (typeof listPaths)[number]
const getCallPath = '/v2/get-call/'
const retellCallId = /^[A-Za-z0-9_-]{1,128}$/

export type AgentRow = { retell_agent_id: string; name: string; is_suspended: boolean; is_transfer_agent: boolean; retell_modified_at: string | null }
export type CallRow = {
  retell_call_id: string; retell_agent_id: string; started_at: string; ended_at: string | null; call_status: string | null
  call_type: string | null; direction: string | null; disconnection_reason: string | null; agent_version: number | null; duration_ms: number | null
  cost_cents: number | null
}
export type RetellFailure = 'rejected' | 'rate' | 'unavailable' | 'unexpected' | 'missing'

export class RetellError extends Error {
  failure: RetellFailure
  constructor(failure: RetellFailure, message: string) {
    super(message)
    this.failure = failure
  }
}

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null)
const whole = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null)
const instant = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function toAgentRow(item: unknown): AgentRow | null {
  if (!isObject(item)) return null
  const id = text(item.agent_id, 200)
  if (!id) return null
  return {
    retell_agent_id: id,
    name: text(item.agent_name, 200) ?? 'Unnamed agent',
    is_suspended: item.is_suspended === true,
    is_transfer_agent: item.is_transfer_agent === true,
    retell_modified_at: instant(item.user_modified_timestamp)
  }
}

// Calls without a start time (for example ones that never connected) cannot be stored, so they are skipped.
// A cost in US cents. Retell may send fractions of a cent; anything negative, huge or not a number is dropped.
const cents = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e9 ? Math.round(value * 10000) / 10000 : null

export function toCallRow(item: unknown): CallRow | null {
  if (!isObject(item)) return null
  const id = text(item.call_id, 200)
  const agent = text(item.agent_id, 200)
  const started = instant(item.start_timestamp)
  if (!id || !agent || !started) return null
  const ended = instant(item.end_timestamp)
  const callType = item.call_type === 'phone_call' || item.call_type === 'web_call' ? item.call_type : null
  const direction = item.direction === 'inbound' || item.direction === 'outbound' ? item.direction : null
  return {
    retell_call_id: id,
    retell_agent_id: agent,
    started_at: started,
    ended_at: ended && ended >= started ? ended : null,
    call_status: text(item.call_status, 50),
    call_type: callType,
    direction,
    disconnection_reason: text(item.disconnection_reason, 100),
    agent_version: whole(item.agent_version),
    duration_ms: whole(item.duration_ms),
    cost_cents: cents(isObject(item.call_cost) ? item.call_cost.combined_cost : undefined)
  }
}

export type Speaker = 'agent' | 'user' | 'transfer_target'
export type Utterance = { role: Speaker; text: string; start: number | null; end: number | null }
export type CallDetail = {
  recordingUrl: string | null; transcript: Utterance[]; plainTranscript: string | null
  summary: string | null; sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Unknown' | null; successful: boolean | null
}
const seconds = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 86_400 ? value : null)
const httpsUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 4096) return null
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null } catch { return null }
}

// One call's recording link, transcript and analysis. These are shown when someone opens the call and never stored.
export function toCallDetail(item: unknown): CallDetail {
  const data = isObject(item) ? item : {}
  const transcript: Utterance[] = []
  if (Array.isArray(data.transcript_object)) {
    for (const entry of data.transcript_object.slice(0, 3000)) {
      if (!isObject(entry) || !['agent', 'user', 'transfer_target'].includes(entry.role as string)) continue
      const said = text(entry.content, 5000)
      if (!said) continue
      const words = Array.isArray(entry.words) ? entry.words.filter(isObject) : []
      const start = words.length ? seconds(words[0].start) : null
      const end = words.length ? seconds(words[words.length - 1].end) : null
      transcript.push({ role: entry.role as Speaker, text: said, start, end: end !== null && start !== null && end < start ? null : end })
    }
  }
  const sentiment = ['Positive', 'Neutral', 'Negative', 'Unknown'].includes(isObject(data.call_analysis) ? data.call_analysis.user_sentiment as string : '')
    ? (data.call_analysis as Json).user_sentiment as CallDetail['sentiment'] : null
  return {
    recordingUrl: httpsUrl(data.recording_url) ?? httpsUrl(data.scrubbed_recording_url),
    transcript,
    plainTranscript: transcript.length ? null : text(data.transcript, 200_000),
    summary: isObject(data.call_analysis) ? text(data.call_analysis.call_summary, 5000) : null,
    sentiment,
    successful: isObject(data.call_analysis) && typeof data.call_analysis.call_successful === 'boolean' ? data.call_analysis.call_successful : null
  }
}

export function createRetell({ apiKey, fetchImpl = fetch }: { apiKey: string; fetchImpl?: typeof fetch }) {
  // Sends one allowed request and returns the parsed reply. The key goes only to Retell.
  async function send(url: string, init: { method: 'GET' | 'POST'; body?: string }, missingStatuses: number[] = []) {
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: init.method,
        headers: { Authorization: `Bearer ${apiKey}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
        body: init.body,
        redirect: 'error', // never send the key anywhere else
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000)
      })
    } catch {
      throw new RetellError('unavailable', 'Retell could not be reached.')
    }
    if (response.status === 401 || response.status === 403) throw new RetellError('rejected', `Retell refused the key (${response.status}).`)
    if (response.status === 429) throw new RetellError('rate', 'Retell is rate limiting requests.')
    if (missingStatuses.includes(response.status)) throw new RetellError('missing', 'Retell has no such call.')
    if (response.status >= 500) throw new RetellError('unavailable', `Retell returned ${response.status}.`)
    if (!response.ok) throw new RetellError('unexpected', `Retell returned ${response.status}.`)
    try { return await response.json() as unknown } catch { throw new RetellError('unexpected', 'Retell sent an unreadable reply.') }
  }

  async function list(path: ListPath, query: Record<string, string>, body: Json) {
    if (!listPaths.includes(path)) throw new RetellError('unexpected', 'Request not allowed.')
    const data = await send(`${retellOrigin}${path}?${new URLSearchParams(query)}`, { method: 'POST', body: JSON.stringify(body) })
    if (!isObject(data) || !Array.isArray(data.items) || typeof data.has_more !== 'boolean')
      throw new RetellError('unexpected', 'Retell sent an unexpected reply.')
    const key = typeof data.pagination_key === 'string' && data.pagination_key ? data.pagination_key : null
    return { items: data.items as unknown[], hasMore: data.has_more, key }
  }

  return {
    // Voice agents only, all pages.
    async listAgents() {
      const agents: AgentRow[] = []
      let skipped = 0
      let cursor: string | null = null
      for (let page = 0; page < maximumAgentPages; page++) {
        const query: Record<string, string> = { limit: '1000' }
        if (cursor) query.pagination_key = cursor
        const { items, hasMore, key } = await list('/v2/list-agents', query, { filter_criteria: { channel: { type: 'string', op: 'eq', value: 'voice' } } })
        for (const item of items) { const row = toAgentRow(item); if (row) agents.push(row); else skipped++ }
        if (!hasMore) return { agents, skipped, truncated: false }
        if (!key || key === cursor) throw new RetellError('unexpected', 'Retell sent an unexpected reply.')
        cursor = key
      }
      return { agents, skipped, truncated: true }
    },
    // The most recent calls, newest first, up to maximumCalls.
    async listCalls() {
      const { items, hasMore } = await list('/v3/list-calls', {}, { sort_order: 'descending', limit: maximumCalls })
      const calls: CallRow[] = []
      let skipped = 0
      for (const item of items) { const row = toCallRow(item); if (row) calls.push(row); else skipped++ }
      return { calls, skipped, truncated: hasMore }
    },
    // One call's details. Retell answers 404 or 422 when the key cannot see the call.
    async getCall(callId: string): Promise<CallDetail> {
      if (!retellCallId.test(callId)) throw new RetellError('missing', 'Not a Retell call id.')
      const data = await send(`${retellOrigin}${getCallPath}${callId}`, { method: 'GET' }, [404, 422])
      if (!isObject(data)) throw new RetellError('unexpected', 'Retell sent an unexpected reply.')
      return toCallDetail(data)
    }
  }
}
