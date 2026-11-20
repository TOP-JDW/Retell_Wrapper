import { RetellError, type CallDetail, type RetellFailure } from '../../lib/retell'
import { retell, retellConfigured } from '../../lib/retell-server'
import { CallPlayer } from './CallPlayer'

const problems: Record<RetellFailure | 'not_configured', string> = {
  not_configured: 'Retell is not connected, so the recording and transcript cannot be shown.',
  rejected: 'Retell refused the key. It needs Read access to History to show recordings and transcripts.',
  rate: 'Retell is limiting requests right now. Refresh the page in a minute.',
  unavailable: 'Retell could not be reached. Refresh the page shortly.',
  unexpected: 'Retell sent a reply the app did not expect.',
  missing: 'Retell no longer has this call. Its recording may have been deleted under Retell\'s data retention setting.'
}
const sentimentTone = { Positive: 'ok', Neutral: 'neutral', Negative: 'bad', Unknown: 'neutral' } as const

// A call's summary, recording and transcript, read live from Retell and never stored. The caller decides
// who may see it; the recording itself is relayed by /calls/[id]/recording, which checks again.
export async function CallInsight({ callId, retellCallId, finished, agentName }: { callId: string; retellCallId: string; finished: boolean; agentName: string }) {
  let detail: CallDetail | null = null
  let problem: keyof typeof problems | null = null
  if (!retellConfigured()) problem = 'not_configured'
  else try { detail = await retell().getCall(retellCallId) }
  catch (failure) { problem = failure instanceof RetellError ? failure.failure : 'unexpected' }
  if (problem) return <p role="alert" className="notice problem">{problems[problem]}</p>
  if (!detail) return null
  return <>
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
            : <CallPlayer src={detail.recordingUrl ? `/calls/${callId}/recording` : null} lines={detail.transcript}
                plain={detail.plainTranscript} agentName={agentName}/>}
          <p className="hint player-note">Played from Retell when you open the call. Nothing is saved in this app. Choose a line to play from there.</p>
        </section>
  </>
}
