// Grey shapes shown while a page loads, laid out like a typical page: a heading, figures and a table.
export function PageSkeleton({ stats = true, rows = 6 }: { stats?: boolean; rows?: number }) {
  return <div className="stack skeleton" aria-busy="true">
    <p className="visually-hidden" role="status">Loading…</p>
    <div className="page-head" aria-hidden="true"><div><span className="bone h1"/><span className="bone line"/></div></div>
    {stats && <div className="panel stats four" aria-hidden="true">{[0, 1, 2, 3].map(i => <div className="stat" key={i}><span className="bone small"/><span className="bone figure"/></div>)}</div>}
    <div className="panel" aria-hidden="true">
      <div className="bone-head"><span className="bone small"/><span className="bone small"/><span className="bone small"/></div>
      {Array.from({ length: rows }, (_, i) => <div className="bone-row" key={i}><span className="bone"/><span className="bone"/><span className="bone short"/></div>)}
    </div>
  </div>
}
