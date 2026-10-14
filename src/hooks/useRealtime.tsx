import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type SyncState = 'conectado' | 'sincronizando' | 'reconectando' | 'offline'
const Ctx = createContext<SyncState>('conectado')
export const useSyncState = () => useContext(Ctx)

/**
 * Um único canal por empresa, assinando só as tabelas necessárias.
 * Eventos apenas INVALIDAM o cache (o servidor continua sendo a fonte da verdade),
 * então eventos repetidos, atrasados ou perdidos não corrompem nada:
 * a revalidação ao reconectar / voltar à aba / a cada 60 s fecha qualquer lacuna.
 */
export function RealtimeProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  const qc = useQueryClient()
  const [channelOk, setChannelOk] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const timer = useRef<number | undefined>(undefined)
  const pendingKeys = useRef(new Set<string>())

  const fetching = useIsFetching()
  const mutating = useIsMutating()

  useEffect(() => {
    const flush = () => {
      pendingKeys.current.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      pendingKeys.current.clear()
    }
    const schedule = (...keys: string[]) => {
      keys.forEach((k) => pendingKeys.current.add(k))
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, 250) // agrupa rajadas de eventos
    }

    const filter = `company_id=eq.${companyId}`
    const ch = supabase.channel(`vp-${companyId}`)
    const on = (table: string, ...keys: string[]) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => schedule(...keys))
    on('products', 'products', 'home', 'balance', 'movements')
    on('sales', 'sales', 'sale', 'statement', 'home', 'balance')
    on('sale_items', 'sales', 'sale', 'statement', 'balance')
    on('payments', 'sales', 'sale', 'payments', 'statement', 'home', 'balance')
    on('inventory_movements', 'movements', 'products')

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setChannelOk(true)
        qc.invalidateQueries() // reconcilia com o servidor ao (re)conectar
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setChannelOk(false)
      }
    })

    const poll = window.setInterval(() => { if (navigator.onLine) qc.invalidateQueries() }, 60_000)
    const goOnline = () => setOnline(true)
    const goOffline = () => { setOnline(false); setChannelOk(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => { // limpeza: evita assinaturas duplicadas
      window.clearTimeout(timer.current)
      window.clearInterval(poll)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      supabase.removeChannel(ch)
    }
  }, [companyId, qc])

  let state: SyncState = 'conectado'
  if (!online) state = 'offline'
  else if (!channelOk) state = 'reconectando'
  else if (fetching + mutating > 0) state = 'sincronizando'

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
