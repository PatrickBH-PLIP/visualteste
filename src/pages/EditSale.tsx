import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SaleForm } from '@/components/SaleForm'
import { ErrorBanner, Spinner } from '@/components/ui'
import { getSale, listSaleItems } from '@/services/sales'

export default function EditSale() {
  const { id } = useParams()
  const sale = useQuery({ queryKey: ['sale', id], queryFn: () => getSale(id!), enabled: !!id })
  const items = useQuery({ queryKey: ['sales', 'items', id], queryFn: () => listSaleItems([id!]), enabled: !!id })
  if (!id) return <Navigate to="/vendas" replace />
  if (sale.isLoading || items.isLoading) return <Spinner />
  if (!sale.data || !items.data) return <ErrorBanner message="Venda não encontrada." onRetry={() => { sale.refetch(); items.refetch() }} />
  if (sale.data.cancelled_at) return <Navigate to="/vendas" replace />
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-chilli">Editar venda nº {sale.data.sale_number}</h1>
      <p className="text-sm text-tinta/70">O estoque é ajustado automaticamente pela diferença. Pagamentos já registrados são preservados.</p>
      {/* O servidor calcula a diferença a partir do estado ATUAL da venda, então editar com dados levemente antigos é seguro. */}
      <SaleForm key={sale.data.id} initial={{ sale: sale.data, items: items.data }} />
    </div>
  )
}
