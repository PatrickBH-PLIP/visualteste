import { NavLink, Outlet } from 'react-router-dom'
import { Archive, BarChart3, Home, LogOut, Receipt, Settings, ShoppingBag } from 'lucide-react'
import { useAuth, useCompany } from '@/hooks/useAuth'
import { SyncIndicator } from './SyncIndicator'

const NAV = [
  { to: '/', label: 'Home', mobileLabel: 'Início', icon: Home, end: true },
  { to: '/vendas/nova', label: 'Nova venda', mobileLabel: 'Venda', icon: ShoppingBag, group: 'VENDAS' },
  { to: '/vendas', label: 'Histórico', mobileLabel: 'Histórico', icon: Receipt, end: true, group: 'VENDAS' },
  { to: '/balanco', label: 'Balanço', mobileLabel: 'Balanço', icon: BarChart3 },
  { to: '/produtos-arquivados', label: 'Produtos arquivados', mobileLabel: 'Arquivados', icon: Archive },
  { to: '/configuracoes', label: 'Configurações', mobileLabel: 'Ajustes', icon: Settings },
]

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-marinho text-white' : 'text-marinho hover:bg-marinho/10'}`

export function Layout() {
  const { signOut } = useAuth()
  const { companyName } = useCompany()
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-tinta/10 bg-bege-escuro/50 md:flex md:sticky md:top-0 md:h-dvh">
        <div className="p-4"><div className="rounded-xl bg-white p-2 shadow-suave"><img src="/assets/logo.jpg" alt="Visual Pimenta" className="mx-auto h-28 w-auto object-contain" /></div></div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Principal">
          {NAV.map((n, i) => (
            <div key={n.to}>
              {n.group && NAV[i - 1]?.group !== n.group && <p className="px-3 pb-1 pt-4 text-xs font-semibold text-tinta/60">{n.group}</p>}
              <NavLink to={n.to} end={n.end} className={link}><n.icon size={18} />{n.label}</NavLink>
            </div>
          ))}
        </nav>
        <div className="space-y-2 border-t border-tinta/10 p-3">
          <p className="truncate px-3 text-xs text-tinta/60">{companyName}</p>
          <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-chilli hover:bg-chilli/10"><LogOut size={18} />Sair</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-tinta/10 bg-bege/95 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur sm:px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            <img src="/assets/logo.jpg" alt="Visual Pimenta" className="h-10 w-auto rounded bg-white p-0.5" />
          </div>
          <p className="hidden font-serif text-lg md:block">{companyName}</p>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <SyncIndicator />
            <button type="button" onClick={signOut} className="btn-ghost !min-h-[40px] !px-2 md:hidden" aria-label="Sair"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-3 py-5 pb-28 sm:px-4 sm:py-6 md:px-8 md:pb-10"><Outlet /></main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto overscroll-x-contain border-t border-tinta/15 bg-bege pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Principal (celular)">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex min-h-[60px] min-w-[72px] shrink-0 flex-col items-center justify-center gap-1 px-2 text-[10px] font-medium whitespace-nowrap ${isActive ? 'text-chilli' : 'text-marinho/80'}`}>
            <n.icon size={20} /><span>{n.mobileLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
