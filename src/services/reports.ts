import { supabase } from '@/lib/supabase'
import type { BalanceReport, SaleSummary } from '@/types'

export async function balanceReport(companyId: string, from: string, to: string): Promise<BalanceReport> {
  const { data, error } = await supabase.rpc('balance_report', { p_company: companyId, p_from: from, p_to: to })
  if (error) throw error
  return data as BalanceReport
}

/** Extrato: vendas do período (inclui canceladas, marcadas como tal). */
export async function statement(companyId: string, from: string, to: string): Promise<SaleSummary[]> {
  const { data, error } = await supabase.from('sales_summary').select('*')
    .eq('company_id', companyId).gte('purchase_date', from).lte('purchase_date', to)
    .order('purchase_date', { ascending: false }).order('sale_number', { ascending: false }).limit(5000)
  if (error) throw error
  return data as SaleSummary[]
}
