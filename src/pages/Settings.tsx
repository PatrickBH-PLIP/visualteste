import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listMovements } from '@/services/products'
import { useAuth, useCompany } from '@/hooks/useAuth'
import { formatDateTime } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui'

const MOV_LABEL: Record<string, string> = {
  estoque_inicial: 'Estoque inicial', entrada_manual: 'Entrada (compra)', devolucao: 'Devolução', ajuste: 'Ajuste',
  venda: 'Venda', edicao_venda: 'Edição de venda', cancelamento_venda: 'Cancelamento de venda',
}

export default function Settings() {
  const { companyId, companyName, role } = useCompany()
  const { signOut } = useAuth()
  const [memberEmail, setMemberEmail] = useState('visualpimenta@gmail.com')
  const [memberBusy, setMemberBusy] = useState(false)
  const [memberMessage, setMemberMessage] = useState('')

  const moves = useQuery({ queryKey: ['movements', companyId], queryFn: () => listMovements(companyId, 50) })

  async function addAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMemberBusy(true)
    setMemberMessage('')
    try {
      const { error } = await supabase.rpc('add_member', {
        p_company: companyId,
        p_email: memberEmail.trim(),
        p_role: 'admin',
      })
      if (error) throw error
      setMemberMessage('Administrador vinculado à loja com sucesso.')
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : 'Não foi possível adicionar o administrador.')
    } finally {
      setMemberBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-chilli">Configurações</h1>

      <section className="card space-y-1 p-4 text-sm">
        <p><strong>Loja:</strong> {companyName}</p>
        <button type="button" className="btn-outline mt-2" onClick={signOut}>Sair</button>
      </section>

      {role === 'admin' && (
        <section className="card space-y-3 p-4">
          <h2 className="text-xl">Adicionar administrador</h2>
          <p className="text-sm text-tinta/70">O usuário precisa já ter uma conta cadastrada no sistema.</p>
          <form className="space-y-3" onSubmit={addAdmin}>
            <label className="block space-y-1 text-sm">
              <span>E-mail do usuário</span>
              <input
                className="input w-full"
                type="email"
                required
                value={memberEmail}
                onChange={(event) => setMemberEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={memberBusy}>
              {memberBusy ? 'Adicionando...' : 'Adicionar como administrador'}
            </button>
          </form>
          {memberMessage && <p role="status" className="text-sm break-words">{memberMessage}</p>}
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
                  <td className="p-2 text-right">{m.quantity_before} → {m.quantity_after}</td><td className="p-2 text-tinta/70">{m.reason}</td></tr>))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
