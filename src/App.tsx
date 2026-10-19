import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { RealtimeProvider } from '@/hooks/useRealtime'
import { ToastProvider } from '@/hooks/useToast'
import { Layout } from '@/components/Layout'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import Setup from '@/pages/Setup'
import Home from '@/pages/Home'
import Stock from '@/pages/Stock'
import NewSale from '@/pages/NewSale'
import EditSale from '@/pages/EditSale'
import SalesHistory from '@/pages/SalesHistory'
import Balance from '@/pages/Balance'
import Settings from '@/pages/Settings'
import ArchivedProducts from '@/pages/ArchivedProducts'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true, refetchOnReconnect: true } },
})

function Gate() {
  const { loading, session, membership, needsSetup } = useAuth()
  if (loading) return <Spinner label="Abrindo o sistema…" />
  if (!session) return <Login />
  if (needsSetup) return <Setup />
  if (!membership) return <Spinner label="Carregando sua loja…" />
  return (
    <RealtimeProvider companyId={membership.companyId}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="estoque/:slug" element={<Stock />} />
          <Route path="vendas" element={<SalesHistory />} />
          <Route path="vendas/nova" element={<NewSale />} />
          <Route path="vendas/:id/editar" element={<EditSale />} />
          <Route path="balanco" element={<Balance />} />
          <Route path="configuracoes" element={<Settings />} />
          <Route path="produtos-arquivados" element={<ArchivedProducts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter><Gate /></BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
