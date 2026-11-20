import Link from 'next/link'
import { notFound } from 'next/navigation'
import { member } from '../../../../lib/auth'
import { agentNames } from '../../../../lib/calls'
import { parseId } from '../../../../lib/clients'
import { formatDuration, formatTime, plainWords } from '../../../../lib/format'
import { RetellError, type CallDetail, type RetellFailure } from '../../../../lib/retell'
import { retell, retellConfigured } from '../../../../lib/retell-server'
import { callTone, capitalise } from '../../../../lib/status'
import { CallPlayer } from '../../../components/CallPlayer'

const problems: Record<RetellFailure | 'not_configured', string> = {
  not_configured: 'Retell is not connected, so the recording and transcript cannot be shown.',
  rejected: 'Retell refused the key. It needs Read access to History to show recordings and transcripts.',
  rate: 'Retell is limiting requests right now. Refresh the page in a minute.',
  unavailable: 'Retell could not be reached. Refresh the page shortly.',
  unexpected: 'Retell sent a reply the app did not expect.',
  missing: 'Retell no longer has this call. Its recording may have been deleted under Retell\'s data retention setting.'
}
const sentimentTone = { Positive: 'ok', Neutral: 'neutral', Negative: 'bad', Unknown: 'neutral' } as const

export default async function Call({params}: {params: Promise<{id: string}>}) {
  const id = parseId((await params).id)
  if (!id) notFound()
  const {db, membership} = await member()
  const isStaff = membership.role === 'owner' || membership.role === 'admin'
  const {data: call, error} = await db.from('calls')
    .select('id,agent_id,retell_call_id,started_at,ended_at,call_status,call_type,direction,disconnection_reason,duration_ms')
    .eq('id', id).eq('workspace_id', membership.workspace_id).maybeSingle()
  if (error) throw new Error('Call could not load.')
  if (!call) notFound()
  const {agents, clients} = await agentNames(db, [call.agent_id])
  const agent = agents.get(call.agent_id)
  const client = agent?.client_id ? clients.get(agent.client_id) ?? null : null

  // Recording, transcript and analysis are read from Retell for owners and admins only, and never stored.
  let detail: CallDetail | null = null
  let problem: keyof typeof problems | null = null
  if (isStaff) {
    if (!retellConfigured()) problem = 'not_configured'
    else try { detail = await retell().getCall(call.retell_call_id) }
    catch (failure) { problem = failure instanceof RetellError ? failure.failure : 'unexpected' }
  }
  const finished = call.call_status === 'ended' || call.call_status === 'error' || call.call_status === 'not_connected'

  return <div className="stack">
    <header className="page-head"><div>
      <p className="crumb"><Link href="/calls">Call History</Link></p>
      <h1>Call with {agent?.name ?? 'an unknown agent'}</h1>
      <p>{formatTime(call.started_at)}, UK time.</p>
    </div></header>

    <section className="panel facts" aria-label="Call details">
      <div><span>Status</span><b><span className={`pill ${callTone(call.call_status)}`}>{capitalise(plainWords(call.call_status))}</span></b></div>
      <div><span>Length</span><b>{formatDuration(call.duration_ms)}</b></div>
      <div><span>Type</span><b>{call.call_type === 'web_call' ? 'Web' : call.direction ? capitalise(plainWords(call.direction)) : 'Unknown'}</b></div>
      <div><span>Client</span><b>{client ?? 'No client'}</b></div>
      <div><span>Ended because</span><b>{capitalise(plainWords(call.disconnection_reason))}</b></div>
    </section>

    {!isStaff
      ? <p className="hint">Only owners and admins can listen to recordings and read transcripts.</p>
      : problem ? <p role="alert" className="notice problem">{problems[problem]}</p>
      : detail && <>
        {(detail.summary || detail.sentiment || detail.successful !== null) && <section className="panel panel-body summary" aria-labelledby="summary">
          <div className="section-head"><h2 id="summary">Summary</h2>
            <div className="tags">
              {detail.sentiment && <span className={`pill ${sentimentTone[detail.sentiment]}`}>Caller mood: {detail.sentiment.toLowerCase()}</span>}
              {detail.successful !== null && <span className={`pill ${detail.successful ? 'ok' : 'warn'}`}>{detail.successful ? 'Successful' : 'Not successful'}</span>}
            </div></div>
          {detail.summary && <p>{detail.summary}</p>}
          <p className="hint">Written by Retell after the call.</p>
        </section>}
        <section className="panel panel-body" aria-labelledby="recording">
          <div className="section-head"><h2 id="recording">Recording and transcript</h2></div>
          {!finished && !detail.recordingUrl && detail.transcript.length === 0
            ? <p className="hint">The recording and transcript appear after the call ends.</p>
            : <CallPlayer src={detail.recordingUrl ? `/calls/${call.id}/recording` : null} lines={detail.transcript}
                plain={detail.plainTranscript} agentName={agent?.name ?? 'Agent'}/>}
          <p className="hint player-note">Played from Retell when you open the call. Nothing is saved in this app. Choose a line to play from there.</p>
        </section>
      </>}
  </div>
}
