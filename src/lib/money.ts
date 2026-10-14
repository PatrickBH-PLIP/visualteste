/** Todos os valores monetários trafegam em centavos (inteiros). */
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(cents: number): string {
  return brl.format(cents / 100)
}

/** Converte "1.234,56", "12,5", "12.50" ou "12" em centavos. Retorna null se inválido. */
export function parseBRL(input: string): number | null {
  let s = (input ?? '').trim().replace(/[R$\s]/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [int, dec = ''] = s.split('.')
  return parseInt(int, 10) * 100 + parseInt(dec.padEnd(2, '0'), 10)
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}
