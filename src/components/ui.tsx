import { AlertTriangle, Loader2, PackageOpen } from 'lucide-react'
import type { ReactNode } from 'react'

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-tinta/70" role="status">
      <Loader2 className="animate-spin" size={20} /> <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-tinta/25 px-6 py-14 text-center">
      <PackageOpen size={34} className="text-tinta/40" />
      <p className="font-serif text-lg">{title}</p>
      {hint && <p className="max-w-sm text-sm text-tinta/70">{hint}</p>}
      {action}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-chilli/40 bg-chilli/10 px-4 py-3 text-sm text-chilli">
      <AlertTriangle size={18} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="btn-outline !min-h-[36px] !border-chilli/50 !text-chilli">Tentar novamente</button>}
    </div>
  )
}

export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-tinta/60">{hint}</span>}
      {error && <span className="field-error block">{error}</span>}
    </label>
  )
}
