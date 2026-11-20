import type { ReactNode } from 'react'

// Frame for sign-in and the other pages people see before they are inside the app.
export function AuthShell({ children }: { children: ReactNode }) {
  return <div className="auth">
    <aside className="auth-brand">
      <img src="/brand/logo-reverse.png" alt="The One Point" width={200} height={122}/>
      <div>
        <h2><span>The One Point</span> <span>AI Voice</span></h2>
        <p>Your voice agents and every call they take, in one place.</p>
      </div>
    </aside>
    <main className="auth-main"><div className="auth-form">{children}</div></main>
  </div>
}
