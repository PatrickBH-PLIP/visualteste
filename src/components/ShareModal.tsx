import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, MessageCircle, Share2 } from 'lucide-react'
import { Modal } from './Modal'
import { downloadBlob } from '@/lib/csv'
import { buildSaleMessage, whatsappLink } from '@/utils/saleMessage'
import { buildSalePdf } from '@/utils/salePdf'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { Payment, SaleItem, SaleSummary } from '@/types'

export function ShareModal({ sale, items, payments, onClose }: { sale: SaleSummary; items: SaleItem[]; payments: Payment[]; onClose: () => void }) {
  const { companyName } = useCompany()
  const toast = useToast()
  const [tab, setTab] = useState<'whatsapp' | 'pdf'>('whatsapp')
  const initial = useMemo(() => buildSaleMessage(sale, items, companyName), [sale, items, companyName])
  const [text, setText] = useState(initial)
  const [pdf, setPdf] = useState<Blob | null>(null)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
  const filename = `visual-pimenta-venda-${sale.sale_number}.pdf`

  useEffect(() => {
    if (tab !== 'pdf' || pdf) return
    buildSalePdf(sale, items, payments, companyName).then(setPdf).catch(() => setPdfErr('Não foi possível gerar o PDF.'))
  }, [tab, pdf, sale, items, payments, companyName])

  const canShareText = typeof navigator !== 'undefined' && !!navigator.share
  const pdfFile = pdf ? new File([pdf], filename, { type: 'application/pdf' }) : null
  const canShareFile = !!pdfFile && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [pdfFile] })

  return (
    <Modal title="Enviar ao cliente" onClose={onClose} wide>
      <div className="mb-4 flex gap-2" role="tablist">
        {([['whatsapp', 'Texto para WhatsApp'], ['pdf', 'PDF do comprovante']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={tab === k ? 'btn-primary' : 'btn-outline'}>{l}</button>
        ))}
      </div>

      {tab === 'whatsapp' && (
        <div className="space-y-3">
          <label><span className="label">Mensagem (você pode editar antes de enviar)</span>
            <textarea className="input font-mono !text-sm" rows={14} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={whatsappLink(sale.customer_phone, text)} target="_blank" rel="noreferrer"><MessageCircle size={18} />Abrir no WhatsApp</a>
            {canShareText && <button type="button" className="btn-outline" onClick={() => navigator.share({ text }).catch(() => {})}><Share2 size={18} />Compartilhar…</button>}
            <button type="button" className="btn-outline" onClick={() => navigator.clipboard.writeText(text).then(() => toast('ok', 'Mensagem copiada.'), () => toast('erro', 'Não foi possível copiar.'))}><Copy size={18} />Copiar</button>
            <button type="button" className="btn-ghost" onClick={() => setText(initial)}>Restaurar texto</button>
          </div>
          <p className="text-xs text-tinta/60">O WhatsApp abrirá com a mensagem preenchida. O envio só acontece quando você confirmar lá.</p>
        </div>
      )}

      {tab === 'pdf' && (
        <div className="space-y-3">
          {pdfErr && <p className="field-error">{pdfErr}</p>}
          {!pdf && !pdfErr && <p className="text-sm">Gerando PDF…</p>}
          {pdf && (
            <>
              <p className="text-sm">PDF pronto ({Math.round(pdf.size / 1024)} KB).</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => downloadBlob(pdf, filename)}><Download size={18} />Baixar PDF</button>
                {canShareFile && <button type="button" className="btn-outline" onClick={() => navigator.share({ files: [pdfFile!], title: filename }).catch(() => {})}><Share2 size={18} />Compartilhar PDF</button>}
              </div>
              {!canShareFile && <p className="text-xs text-tinta/60">Este navegador não compartilha arquivos diretamente. Baixe o PDF e anexe no WhatsApp ou e-mail.</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
