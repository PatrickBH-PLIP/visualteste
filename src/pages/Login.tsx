import { useState } from 'react'
import { supabase, errorMessage, isConfigured } from '@/lib/supabase'
import { ErrorBanner, Field } from '@/components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : errorMessage(error))
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="rounded-xl bg-white p-2"><img src="/assets/logo.jpg" alt="Visual Pimenta" className="mx-auto h-40 w-auto object-contain" /></div>
        {!isConfigured && <ErrorBanner message="Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README)." />}
        {error && <ErrorBanner message={error} />}
        <Field label="E-mail"><input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Senha"><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button type="submit" className="btn-primary w-full" disabled={busy || !isConfigured}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
