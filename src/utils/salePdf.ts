import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatBRL } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/dates'
import { methodLabel } from '@/lib/categories'
import { STATUS_META } from './status'
import type { Payment, SaleItem, SaleSummary } from '@/types'

const VINHO: [number, number, number] = [205, 28, 24]
const TINTA: [number, number, number] = [42, 29, 26]
const BEGE: [number, number, number] = [250, 247, 242]

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

/** Comprovante A4 com identificação da compra, variantes e resumo financeiro. */
export async function buildSalePdf(sale: SaleSummary, items: SaleItem[], payments: Payment[], storeName = 'Visual Pimenta'): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 14
  const right = W - M
  let y = 15

  const logo = await loadLogo()
  if (logo) {
    const h = 25, w = Math.min((logo.w / logo.h) * h, 42)
    doc.addImage(logo.data, 'JPEG', M, y - 3, w, h)
  }
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...VINHO)
  doc.text(storeName, right, y + 5, { align: 'right' })
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA)
  doc.text(`COMPROVANTE DE VENDA  #${sale.sale_number}`, right, y + 12, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(105, 91, 84)
  doc.text(`Data da compra: ${formatDate(sale.purchase_date)}`, right, y + 18, { align: 'right' })
  y += 29
  doc.setDrawColor(...VINHO).setLineWidth(0.7).line(M, y, right, y)
  y += 8

  // Identificação do cliente
  doc.setFillColor(...BEGE).setDrawColor(232, 224, 215)
  doc.roundedRect(M, y, W - 2 * M, 23, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...VINHO)
  doc.text('DADOS DO CLIENTE', M + 5, y + 6)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA)
  doc.text(sale.customer_name, M + 5, y + 13)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(95, 82, 76)
  doc.text(`Telefone: ${sale.customer_phone || 'Não informado'}`, M + 5, y + 19)
  y += 31

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA)
  doc.text('PRODUTOS', M, y)
  y += 3
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 16 },
    head: [['Produto / marca', 'Tam.', 'Cor', 'Qtd.', 'Preço unit.', 'Subtotal']],
    body: items.map((i) => [
      `${i.product_name}\n${i.brand}`,
      i.size || '—',
      i.color || '—',
      String(i.quantity),
      formatBRL(i.unit_price_cents),
      formatBRL(i.quantity * i.unit_price_cents),
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, textColor: TINTA, cellPadding: 3, valign: 'middle', lineColor: [232, 224, 215], lineWidth: 0.15 },
    headStyles: { fillColor: VINHO, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: BEGE },
    columnStyles: {
      0: { cellWidth: 57 },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 29 },
      3: { cellWidth: 13, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 29, halign: 'right', fontStyle: 'bold' },
    },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 9

  if (y > H - 75) { doc.addPage(); y = 18 }

  // Resumo financeiro
  const boxW = 82
  const boxX = right - boxW
  doc.setFillColor(...BEGE).setDrawColor(232, 224, 215)
  doc.roundedRect(boxX, y, boxW, 39, 2, 2, 'FD')
  const totalRow = (label: string, value: string, yy: number, strong = false) => {
    doc.setFont('helvetica', strong ? 'bold' : 'normal').setFontSize(strong ? 11 : 9.5)
    doc.setTextColor(...(strong ? VINHO : TINTA))
    doc.text(label, boxX + 5, yy)
    doc.text(value, right - 5, yy, { align: 'right' })
  }
  totalRow('Subtotal', formatBRL(sale.gross_cents), y + 8)
  if (sale.discount_cents > 0) totalRow('Desconto', `− ${formatBRL(sale.discount_cents)}`, y + 15)
  totalRow('TOTAL', formatBRL(sale.net_cents), y + 24, true)
  totalRow('Valor recebido', formatBRL(sale.paid_cents), y + 32)
  y += 46

  const status = STATUS_META[sale.status]
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...TINTA)
  doc.text(`Situação: ${status.label}`, M, y)
  if (sale.balance_cents > 0) {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(95, 82, 76)
    doc.text(`Pagamento previsto para: ${formatDate(sale.due_date)}`, M, y + 6)
  }
  y += sale.balance_cents > 0 ? 14 : 8

  const validPayments = payments.filter((p) => !p.reversed_at)
  if (validPayments.length) {
    if (y > H - 48) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...TINTA)
    doc.text('PAGAMENTOS REGISTRADOS', M, y)
    autoTable(doc, {
      startY: y + 3,
      margin: { left: M, right: M, bottom: 16 },
      head: [['Data', 'Forma de pagamento', 'Valor']],
      body: validPayments.map((p) => [formatDateTime(p.received_at), methodLabel(p.method), `${p.kind === 'refund' ? '− ' : ''}${formatBRL(p.amount_cents)}`]),
      styles: { fontSize: 8.5, textColor: TINTA, cellPadding: 2.5, lineColor: [232, 224, 215], lineWidth: 0.15 },
      headStyles: { fillColor: [90, 80, 75], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BEGE },
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    })
    // @ts-expect-error lastAutoTable é injetado pelo plugin
    y = doc.lastAutoTable.finalY + 8
  }

  if (sale.notes?.trim()) {
    if (y > H - 30) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...TINTA)
    doc.text('OBSERVAÇÕES', M, y)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(95, 82, 76)
    const notes = doc.splitTextToSize(sale.notes, W - 2 * M)
    doc.text(notes, M, y + 6)
  }

  return doc.output('blob')
}
