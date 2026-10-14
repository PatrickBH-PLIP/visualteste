import { describe, expect, it } from 'vitest'
import { centsToInput, formatBRL, parseBRL } from '@/lib/money'

describe('money', () => {
  it('converte texto em centavos sem erro de ponto flutuante', () => {
    expect(parseBRL('49,90')).toBe(4990)
    expect(parseBRL('49.90')).toBe(4990)
    expect(parseBRL('1.234,56')).toBe(123456)
    expect(parseBRL('12')).toBe(1200)
    expect(parseBRL('12,5')).toBe(1250)
    expect(parseBRL('0,10')).toBe(10)
    expect(parseBRL('19,99')).toBe(1999)
    expect(parseBRL('R$ 8,05')).toBe(805)
  })
  it('rejeita valores inválidos', () => {
    for (const v of ['', 'abc', '-5', '1,234', '12,345', '1,2,3']) expect(parseBRL(v)).toBeNull()
  })
  it('formata em reais', () => {
    expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
    expect(centsToInput(4990)).toBe('49,90')
    expect(centsToInput(null)).toBe('')
  })
})
