import type { SaleStatus } from '@/types'

export const STATUS_META: Record<SaleStatus, { label: string; color: string; textOnColor: string }> = {
  PAGO: { label: 'PAGO', color: '#008000', textOnColor: '#ffffff' },
  PENDENTE: { label: 'PENDENTE', color: '#ffa500', textOnColor: '#2a1d1a' },
  ATRASADO: { label: 'ATRASADO', color: '#ff0000', textOnColor: '#ffffff' },
  CREDITO: { label: 'A DEVOLVER', color: '#7a2e8e', textOnColor: '#ffffff' },
  CANCELADA: { label: 'CANCELADA', color: '#6b6560', textOnColor: '#ffffff' },
}
