import { STATUS_META } from '@/utils/status'
import type { SaleStatus } from '@/types'

export function StatusBadge({ status }: { status: SaleStatus }) {
  const m = STATUS_META[status]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide" style={{ background: m.color, color: m.textOnColor }}>
      {m.label}
    </span>
  )
}
