import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArchiveRestore, Package, Trash2 } from 'lucide-react'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { deleteProductPermanently, listArchivedProducts, restoreProduct } from '@/services/products'
import { formatBRL } from '@/lib/money'
import { errorMessage } from '@/lib/supabase'
import { ErrorBanner, Spinner } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Product } from '@/types'

const CATEGORY: Record<string, string> = {
  feminino: 'Feminino', masculino: 'Masculino', lingerie: 'Lingerie', sex_shop: 'Sex Shop',
}

export default function ArchivedProducts() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const q = useQuery({
    queryKey: ['archived-products', companyId],
    queryFn: () => listArchivedProducts(companyId),
  })
  const restore = useMutation({
    mutationFn: restoreProduct,
    onSuccess: async () => {
      toast('ok', 'Produto restaurado para o estoque.')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['archived-products', companyId] }),
        qc.invalidateQueries({ queryKey: ['products', companyId] }),
        qc.invalidateQueries({ queryKey: ['home'] }),
      ])
    },
    onError: (e) => toast('erro', errorMessage(e)),
    onSettled: () => setBusyId(null),
  })

  const remove = useMutation({
    mutationFn: (p: Product) => deleteProductPermanently(companyId, p.id),
    onSuccess: async () => {
      toast('ok', 'Produto excluído permanentemente.')
      setDeleting(null)
      await qc.invalidateQueries({ queryKey: ['archived-products', companyId] })
    },
    onError: (e) => toast('erro', errorMessage(e)),
  })

  return (
    <>
    <section className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-marinho">Produtos arquivados</h1>
        <p className="mt-1 text-sm text-tinta/70">Consulte os detalhes e restaure produtos quando quiser. Arquivar não apaga o histórico.</p>
      </div>
      {q.isLoading && <Spinner />}
      {q.isError && <ErrorBanner message="Não foi possível carregar os produtos arquivados." onRetry={() => q.refetch()} />}
      {q.isSuccess && q.data.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <ArchiveRestore size={30} className="text-tinta/50" />
          <h2 className="font-semibold">Nenhum produto arquivado</h2>
          <p className="text-sm text-tinta/70">Os produtos que você arquivar aparecerão aqui.</p>
        </div>
      )}
      {q.data && q.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((p) => (
            <article key={p.id} className="card space-y-3 p-4">
              <div className="flex gap-3">
                {p.image_path ? <img src={p.image_path.startsWith('http') ? p.image_path : ''} alt="" className="h-20 w-20 rounded object-cover bg-bege-escuro/20" /> : <div className="flex h-20 w-20 items-center justify-center rounded bg-bege-escuro/20"><Package size={26} /></div>}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-marinho">{p.name}</h2>
                  <p className="text-sm text-tinta/70">{p.brand || 'Sem marca'} · {p.size}</p>
                  <p className="text-sm text-tinta/70">{CATEGORY[p.category] ?? p.category}</p>
                  <p className="mt-1 font-semibold">{formatBRL(p.price_cents)}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><dt className="text-tinta/60">Estoque ao arquivar</dt><dd>{p.quantity}</dd></div>
                <div><dt className="text-tinta/60">Estoque mínimo</dt><dd>{p.min_stock}</dd></div>
                <div><dt className="text-tinta/60">Custo</dt><dd>{p.cost_cents == null ? '—' : formatBRL(p.cost_cents)}</dd></div>
                <div><dt className="text-tinta/60">Material</dt><dd>{p.material || '—'}</dd></div>
                <div><dt className="text-tinta/60">SKU</dt><dd>{p.sku || '—'}</dd></div>
                <div><dt className="text-tinta/60">Código de barras</dt><dd>{p.barcode || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-tinta/60">Fornecedor</dt><dd>{p.supplier || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-tinta/60">Descrição</dt><dd className="whitespace-pre-wrap">{p.description || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-tinta/60">Observações</dt><dd className="whitespace-pre-wrap">{p.notes || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-tinta/60">Arquivado em</dt><dd>{p.archived_at ? new Date(p.archived_at).toLocaleString('pt-BR') : '—'}</dd></div>
              </dl>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" className="btn-primary w-full" disabled={restore.isPending || remove.isPending} onClick={() => { setBusyId(p.id); restore.mutate(p.id) }}>
                  <ArchiveRestore size={17} /> {busyId === p.id ? 'Restaurando…' : 'Restaurar'}
                </button>
                <button type="button" className="btn-outline w-full !text-chilli" disabled={restore.isPending || remove.isPending} onClick={() => setDeleting(p)}>
                  <Trash2 size={17} /> Excluir permanentemente
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
    {deleting && <ConfirmDialog title="Excluir produto permanentemente" danger confirmLabel="Excluir definitivamente" busy={remove.isPending}
      message="Esta ação não pode ser desfeita. Produtos com vendas ou movimentações registradas não poderão ser apagados, para preservar o histórico."
      onConfirm={() => remove.mutate(deleting)} onClose={() => { if (!remove.isPending) setDeleting(null) }} />}
    </>
  )
}
