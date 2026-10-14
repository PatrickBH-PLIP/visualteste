export const STORE_TZ = 'America/Sao_Paulo'

/** Data local da loja (YYYY-MM-DD), independente do fuso do aparelho. */
export function todayLocal(tz = STORE_TZ, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTime(ts: string, tz = STORE_TZ): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts))
}

export type PeriodKey = 'hoje' | '7d' | '30d' | 'mes' | 'mes_anterior' | 'custom'

export function periodRange(key: PeriodKey, today: string, custom?: { from: string; to: string }) {
  const [y, m] = today.split('-').map(Number)
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  switch (key) {
    case 'hoje': return { from: today, to: today }
    case '7d': return { from: addDays(today, -6), to: today }
    case '30d': return { from: addDays(today, -29), to: today }
    case 'mes': return { from: first, to: today }
    case 'mes_anterior': {
      const prevLast = addDays(first, -1)
      return { from: prevLast.slice(0, 8) + '01', to: prevLast }
    }
    case 'custom': return custom ?? { from: first, to: today }
  }
}
