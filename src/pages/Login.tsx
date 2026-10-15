
import { useState } from 'react'
import { supabase, errorMessage, isConfigured } from '@/lib/supabase'
import { ErrorBanner, Field } from '@/components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      if (creating) {
        if (password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres.')
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })

        if (error) throw error

        if (!data.session) {
          setSuccess(
            'Conta criada! Confira seu e-mail para confirmar o cadastro. Depois, entre com seu e-mail e senha.'
          )
        } else {
          setSuccess(
            'Conta criada! Se for o primeiro acesso, você poderá configurar sua loja.'
          )
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          setError(
            error.message === 'Invalid login credentials'
              ? 'E-mail ou senha incorretos.'
              : errorMessage(error)
          )
        }
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="rounded-xl bg-white p-2">
          <img
            src="/assets/logo.jpg"
            alt="Visual Pimenta"
            className="mx-auto h-40 w-auto object-contain"
          />
        </div>

        <h1 className="text-xl font-semibold">
          {creating ? 'Criar conta' : 'Entrar no Visual Pimenta'}
        </h1>

        {!isConfigured && (
          <ErrorBanner message="Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." />
        )}

        {error && <ErrorBanner message={error} />}

        {success && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {success}
          </p>
        )}

        <Field label="E-mail">
          <input
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Senha">
          <input
            className="input"
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={busy || !isConfigured}
        >
          {busy
            ? 'Aguarde…'
            : creating
              ? 'Criar conta'
              : 'Entrar'}
        </button>

        <button
          type="button"
          className="btn-outline w-full"
          disabled={busy}
          onClick={() => {
            setCreating(!creating)
            setError(null)
            setSuccess(null)
          }}
        >
          {creating
            ? 'Já tenho conta — Entrar'
            : 'Não tenho conta — Criar conta'}
        </button>
      </form>
    </div>
  )
}
