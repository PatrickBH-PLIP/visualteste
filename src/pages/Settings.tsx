import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { addMember, listMembers, removeMember } from '@/services/members'
import { listMovements } from '@/services/products'
import { useAuth, useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { errorMessage } from '@/lib/supabase'
import { formatDateTime } from '@/lib/dates'
import { ErrorBanner, Field, Spinner } from '@/components/ui'
import type { Role } from '@/types'

const MOV_LABEL: Record<string, string> = {
  estoque_inicial: 'Estoque inicial', entrada_manual: 'Entrada (compra)', devolucao: 'Devolução', ajuste: 'Ajuste',
  venda: 'Venda', edicao_venda: 'Edição de venda', cancelamento_venda: 'Cancelamento de venda',
}

export default function Settings() {
  const { companyId, role, companyName } = useCompany()
  const { session, signOut } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('staff')
  const [error, setError] = useState<string | null>(null)

  const members = useQuery({ queryKey: ['members', companyId], queryFn: () => listMembers(companyId), enabled: role === 'admin' })
  const moves = useQuery({ queryKey: ['movements', companyId], queryFn: () => listMovements(companyId, 50) })

  const add = useMutation({
    mutationFn: () => addMember(companyId, email, newRole),
    onSuccess: () => { toast('ok', 'Acesso concedido.'); setEmail(''); setError(null); qc.invalidateQueries({ queryKey: ['members'] }) },
    onError: (e) => setError(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => removeMember(companyId, id),
    onSuccess: () => { toast('ok', 'Acesso removido.'); qc.invalidateQueries({ queryKey: ['members'] }) },
    onError: (e) => toast('erro', errorMessage(e)),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-chilli">Configurações</h1>

      <section className="card space-y-1 p-4 text-sm">
        <p><strong>Loja:</strong> {companyName}</p>
        <button type="button" className="btn-outline mt-2" onClick={signOut}>Sair</button>
      </section>

      {role === 'admin' && (
        <section className="card space-y-3 p-4">
          <h2 className="text-xl">Equipe</h2>
          <p className="text-sm text-tinta/70">Crie o usuário em Authentication › Users no Supabase e depois conceda acesso aqui pelo e-mail.</p>
          {error && <ErrorBanner message={error} />}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Field label="E-mail do usuário"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Perfil"><select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}><option value="staff">Equipe</option><option value="admin">Administrador</option></select></Field>
            <button type="button" className="btn-primary self-end" disabled={!email.includes('@') || add.isPending} onClick={() => add.mutate()}>Conceder acesso</button>
          </div>
          {members.isLoading ? <Spinner /> : (
            <ul className="divide-y divide-tinta/10">
              {members.data?.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{m.email} · {m.role === 'admin' ? 'administrador' : 'equipe'}</span>
                  {m.user_id !== session?.user.id && <button type="button" className="btn-ghost !text-chilli !px-2" aria-label={`Remover ${m.email}`} onClick={() => remove.mutate(m.user_id)}><Trash2 size={16} /></button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl">Últimas movimentações de estoque</h2>
        {moves.isLoading ? <Spinner /> : moves.data?.length === 0 ? <p className="text-sm text-tinta/60">Nenhuma movimentação ainda.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-tinta/15 text-xs text-tinta/70"><tr><th className="p-2">Quando</th><th className="p-2">Produto</th><th className="p-2">Tipo</th><th className="p-2 text-right">Qtd.</th><th className="p-2 text-right">Antes → depois</th><th className="p-2">Motivo</th></tr></thead>
              <tbody>{moves.data?.map((m) => (
                <tr key={m.id} className="border-b border-tinta/10 last:border-0">
                  <td className="p-2 whitespace-nowrap">{formatDateTime(m.created_at)}</td><td className="p-2">{m.products?.name} ({m.products?.size})</td><td className="p-2">{MOV_LABEL[m.type]}</td>
                  <td className={`p-2 text-right font-semibold ${m.quantity_delta < 0 ? 'text-chilli' : 'text-pago'}`}>{m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}</td>
                  <td className="p-2 text-right">{m.quantity_before} → {m.quantity_after}</td><td className="p-2 text-tinta/70">{m.reason}</td></tr>))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
