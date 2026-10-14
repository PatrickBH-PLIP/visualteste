import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/types'

interface Membership { companyId: string; role: Role; companyName: string; timezone: string }
interface AuthState {
  loading: boolean
  session: Session | null
  membership: Membership | null
  needsSetup: boolean
  refreshMembership: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) qc.clear()
    })
    return () => sub.subscription.unsubscribe()
  }, [qc])

  const uid = session?.user.id
  const mem = useQuery({
    queryKey: ['membership', uid],
    enabled: !!uid,
    retry: 1,
    queryFn: async (): Promise<Membership | null> => {
      const { data, error } = await supabase.from('company_members')
        .select('company_id, role, companies(name, timezone)').eq('user_id', uid!).limit(1)
      if (error) throw error
      const row = data?.[0] as unknown as { company_id: string; role: Role; companies: { name: string; timezone: string } | null } | undefined
      if (!row) return null
      return { companyId: row.company_id, role: row.role, companyName: row.companies?.name ?? 'Visual Pimenta', timezone: row.companies?.timezone ?? 'America/Sao_Paulo' }
    },
  })

  const value: AuthState = {
    loading: !ready || (!!uid && mem.isLoading),
    session,
    membership: mem.data ?? null,
    needsSetup: !!uid && mem.isSuccess && !mem.data,
    refreshMembership: () => qc.invalidateQueries({ queryKey: ['membership'] }),
    signOut: async () => { await supabase.auth.signOut() },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}

export function useCompany() {
  const { membership } = useAuth()
  if (!membership) throw new Error('Sem empresa')
  return membership
}
