import { useSyncState, type SyncState } from '@/hooks/useRealtime'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

const META: Record<SyncState, { text: string; color: string }> = {
  conectado: { text: 'Conectado', color: '#008000' },
  sincronizando: { text: 'Sincronizando', color: '#0f2a4f' },
  reconectando: { text: 'Reconectando…', color: '#c27a00' },
  offline: { text: 'Offline', color: '#ff0000' },
}

export function SyncIndicator() {
  const s = useSyncState()
  const m = META[s]
  const Icon = s === 'offline' ? WifiOff : s === 'conectado' ? Wifi : RefreshCw
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: m.color }} role="status" aria-live="polite"
      title={s === 'offline' ? 'Sem conexão: nenhuma alteração será confirmada até voltar a internet.' : undefined}>
      <Icon size={14} className={s === 'sincronizando' || s === 'reconectando' ? 'animate-spin' : ''} />
      {m.text}
    </span>
  )
}
