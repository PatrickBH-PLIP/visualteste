import { supabase } from '@/lib/supabase'
import type { Role } from '@/types'

export async function bootstrapCompany(name: string, fullName: string) {
  const { error } = await supabase.rpc('bootstrap_company', { p_name: name, p_full_name: fullName })
  if (error) throw error
}
export async function listMembers(companyId: string) {
  const { data, error } = await supabase.rpc('list_members', { p_company: companyId })
  if (error) throw error
  return data as { user_id: string; email: string; role: Role }[]
}
export async function addMember(companyId: string, email: string, role: Role) {
  const { error } = await supabase.rpc('add_member', { p_company: companyId, p_email: email, p_role: role })
  if (error) throw error
}
export async function removeMember(companyId: string, userId: string) {
  const { error } = await supabase.rpc('remove_member', { p_company: companyId, p_user: userId })
  if (error) throw error
}
