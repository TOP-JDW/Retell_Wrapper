import Link from 'next/link'
import type { ReactNode } from 'react'
import { loadPreview } from '../../../../lib/preview'
import { PreviewNav } from '../../../components/PreviewNav'

export const dynamic = 'force-dynamic'

// The tab shows the client's display name, as their own portal would.
export async function generateMetadata({ params }: { params: Promise<{ clientId: string }> }) {
  const { brand } = await loadPreview((await params).clientId)
  return { title: { absolute: brand.name } }
}

export default async function PreviewLayout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string }> }) {
  const { client, brand } = await loadPreview((await params).clientId)
  const base = `/preview/${client.id}`
  return <div className="cp" style={{ ['--accent' as string]: brand.accent, ['--on-accent' as string]: brand.onAccent }}>
    <div className="cp-bar" role="region" aria-label="Preview">
      <span><strong>Preview.</strong> This is how {brand.name}&apos;s portal will look, with only their agents and calls.{!brand.set && ' Their branding is not set yet, so The One Point colour is used.'}</span>
      <Link className="cp-back" href={`/clients/${client.id}`}>Back to The One Point</Link>
    </div>
    <div className="cp-shell">
      <aside className="cp-side">
        <div className="cp-brand">{brand.logo ? <img src={brand.logo} alt={brand.name}/> : <strong>{brand.name}</strong>}</div>
        <PreviewNav base={base}/>
      </aside>
      <main className="content">{children}</main>
    </div>
  </div>
}
