import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

type Toast = { id: number; kind: 'ok' | 'erro'; text: string }
const Ctx = createContext<(kind: Toast['kind'], text: string) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, kind, text }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'erro' ? 7000 : 3500)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`flex max-w-md items-start gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-suave ${t.kind === 'ok' ? 'bg-pago' : 'bg-chilli'}`}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <XCircle size={18} className="mt-0.5 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
