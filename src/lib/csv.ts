function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV com separador ";" e BOM — abre direto no Excel em português. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return '\ufeff' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
