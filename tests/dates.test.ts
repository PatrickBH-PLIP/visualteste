import { describe, expect, it } from 'vitest'
import { addDays, formatDate, periodRange, todayLocal } from '@/lib/dates'

describe('dates', () => {
  it('usa a data local da loja, não a do aparelho (UTC já virou o dia)', () => {
    // 01:30 UTC de 15/03 = 22:30 de 14/03 em Brasília (UTC-3)
    expect(todayLocal('America/Sao_Paulo', new Date('2026-03-15T01:30:00Z'))).toBe('2026-03-14')
  })
  it('soma dias sem mudar de fuso', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('formata dd/mm/aaaa', () => expect(formatDate('2026-10-13')).toBe('13/10/2026'))
  it('calcula os períodos do balanço', () => {
    const today = '2026-10-13'
    expect(periodRange('hoje', today)).toEqual({ from: today, to: today })
    expect(periodRange('7d', today)).toEqual({ from: '2026-10-07', to: today })
    expect(periodRange('30d', today)).toEqual({ from: '2026-09-14', to: today })
    expect(periodRange('mes', today)).toEqual({ from: '2026-10-01', to: today })
    expect(periodRange('mes_anterior', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(periodRange('mes_anterior', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(periodRange('custom', today, { from: '2026-01-01', to: '2026-01-31' })).toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })
})
