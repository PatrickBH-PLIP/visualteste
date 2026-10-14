import { useState } from 'react'
import { bootstrapCompany } from '@/services/members'
import { errorMessage } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBanner, Field } from '@/components/ui'

/** Aparece só para quem está autenticado, ainda não pertence a nenhuma loja. O banco só aceita o PRIMEIRO cadastro. */
export default function Setup() {
  const { refreshMembership, signOut } = useAuth()
  const [store, setStore] = useState('Visual Pimenta')
  const [me, setMe] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try { await bootstrapCompany(store, me); refreshMembership() }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-6">
        <h1 className="text-2xl">Configuração inicial</h1>
        <p className="text-sm text-tinta/75">Você será o administrador da loja. Se a loja já foi configurada, peça a um administrador para adicionar seu e-mail em Configurações.</p>
        {error && <ErrorBanner message={error} />}
        <Field label="Nome da loja"><input className="input" required value={store} onChange={(e) => setStore(e.target.value)} /></Field>
        <Field label="Seu nome"><input className="input" value={me} onChange={(e) => setMe(e.target.value)} /></Field>
        <div className="flex gap-2">
          <button type="button" className="btn-outline" onClick={signOut}>Sair</button>
          <button type="submit" className="btn-primary flex-1" disabled={busy}>{busy ? 'Configurando…' : 'Criar loja e continuar'}</button>
        </div>
      </form>
    </div>
  )
}
