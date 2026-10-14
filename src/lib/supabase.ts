import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anon)

// Somente a chave pública (anon) é usada no navegador. A service_role NUNCA entra aqui.
export const supabase = createClient(url ?? 'http://localhost:54321', anon ?? 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
})

export const IMAGE_BUCKET = 'product-images'

/** Traduz erros do Postgres/Supabase em mensagem clara. */
export function errorMessage(e: unknown): string {
  if (!e) return 'Erro desconhecido.'
  const err = e as { message?: string; code?: string }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Sem conexão com a internet. Nada foi salvo.'
  if (err.message === 'Failed to fetch' || err.message?.includes('NetworkError'))
    return 'Falha de conexão com o servidor. Verifique a internet e tente novamente — nada foi salvo.'
  if (err.code === '42501') return err.message || 'Acesso negado.'
  return err.message || 'Erro inesperado.'
}

export const newId = () => crypto.randomUUID()
