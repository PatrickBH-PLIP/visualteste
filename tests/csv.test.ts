import { describe, expect, it } from 'vitest'
import { toCsv } from '@/lib/csv'

describe('csv', () => {
  it('usa ; e BOM e protege aspas, ; e quebras de linha', () => {
    const out = toCsv([['a', 'b;c', 'd"e'], [1, null, 'x\ny']])
    expect(out.startsWith('\ufeff')).toBe(true)
    expect(out).toContain('a;"b;c";"d""e"')
    expect(out).toContain('1;;"x\ny"')
  })
})
