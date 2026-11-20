import { randomUUID } from 'node:crypto'
import { Toast } from './Toast'

// The pop-up messages for a page. A new key on every request means the same message shows again
// after a second save, rather than React keeping the closed one.
export function Flash({ success, problem }: { success?: string | null | false; problem?: string | null | false }) {
  if (!success && !problem) return null
  const key = randomUUID()
  return <div className="toasts">
    {problem && <Toast key={`p${key}`} tone="problem" message={problem}/>}
    {success && <Toast key={`s${key}`} tone="success" message={success}/>}
  </div>
}
