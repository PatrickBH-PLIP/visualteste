import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatBRL } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/dates'
import { methodLabel } from '@/lib/categories'
import { STATUS_META } from './status'
import type { Payment, SaleItem, SaleSummary } from '@/types'

const VINHO: [number, number, number] = [205, 28, 24]
const TINTA: [number, number, number] = [42, 29, 26]

async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch('/assets/logo.jpg')).blob()
    const data: string = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob)
    })
    const dim: { w: number; h: number } = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = rej; i.src = data
    })
    return { data, ...dim }
  } catch { return null }
}

/** PDF A4 em fundo branco (economiza tinta), pronto para enviar ou imprimir. */
export async function buildSalePdf(sale: SaleSummary, items: SaleItem[], payments: Payment[], storeName = 'Visual Pimenta'): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 15
  let y = 14

  const logo = await loadLogo()
  if (logo) {
    const h = 30, w = (logo.w / logo.h) * h
    doc.addImage(logo.data, 'JPEG', M, y - 4, w, h)
  }
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...VINHO)
  doc.text(storeName, W - M, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...TINTA)
  doc.text(`Comprovante de venda nº ${sale.sale_number}`, W - M, y + 13, { align: 'right' })
  doc.text(`Data da compra: ${formatDate(sale.purchase_date)}`, W - M, y + 19, { align: 'right' })
  y += 34
  doc.setDrawColor(...VINHO).setLineWidth(0.5).line(M, y, W - M, y)
  y += 7

  doc.setFont('helvetica', 'bold').setFontSize(11).text('Cliente', M, y)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text(`${sale.customer_name}`, M, y + 6)
  doc.text(`Telefone: ${sale.customer_phone}`, M, y + 11)
  y += 17

  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Produto', 'Tam.', 'Qtd.', 'Preço unit.', 'Subtotal']],
    body: items.map((i) => [`${i.product_name} (${i.brand})`, i.size, String(i.quantity), formatBRL(i.unit_price_cents), formatBRL(i.quantity * i.unit_price_cents)]),
    styles: { fontSize: 9.5, textColor: TINTA, cellPadding: 2.2 },
    headStyles: { fillColor: VINHO, textColor: 255 },
    alternateRowStyles: { fillColor: [250, 247, 242] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 6

  const right = W - M
  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 12 : 10).setTextColor(...TINTA)
    doc.text(label, right - 62, y); doc.text(value, right, y, { align: 'right' }); y += bold ? 7 : 5.5
  }
  row('Subtotal', formatBRL(sale.gross_cents))
  if (sale.discount_cents > 0) row('Desconto', `- ${formatBRL(sale.discount_cents)}`)
  row('Total', formatBRL(sale.net_cents), true)
  row('Valor recebido', formatBRL(sale.paid_cents))
  row('Saldo pendente', formatBRL(Math.max(sale.balance_cents, 0)), true)
  y += 2

  const st = STATUS_META[sale.status]
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...TINTA)
  doc.text(`Status: ${st.label}`, M, y)
  if (sale.balance_cents > 0) doc.text(`Pagamento previsto para: ${formatDate(sale.due_date)}`, M, y + 5.5)
  y += 12

  const valid = payments.filter((p) => !p.reversed_at)
  if (valid.length) {
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Recebimento', 'Forma', 'Valor']],
      body: valid.map((p) => [formatDateTime(p.received_at), methodLabel(p.method), `${p.kind === 'refund' ? '- ' : ''}${formatBRL(p.amount_cents)}`]),
      styles: { fontSize: 9, textColor: TINTA }, headStyles: { fillColor: [90, 80, 75], textColor: 255 },
      columnStyles: { 2: { halign: 'right' } },
    })
    // @ts-expect-error lastAutoTable é injetado pelo plugin
    y = doc.lastAutoTable.finalY + 6
  }

  doc.setFont('helvetica', 'bold').setFontSize(10).text('Observações', M, y)
  doc.setFont('helvetica', 'normal').setFontSize(9.5)
  const obs = doc.splitTextToSize(sale.notes || '—', W - 2 * M)
  doc.text(obs, M, y + 5)
  y += 5 + obs.length * 4.5 + 14

  if (y > 265) { doc.addPage(); y = 30 }
  doc.setDrawColor(...TINTA).setLineWidth(0.3).line(M, y, M + 75, y).line(W - M - 75, y, W - M, y)
  doc.setFontSize(8.5).text('Assinatura / confirmação de recebimento', M, y + 4.5)
  doc.text(storeName, W - M - 75, y + 4.5)

  return doc.output('blob')
}
