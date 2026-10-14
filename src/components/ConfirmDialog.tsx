import { useState } from 'react'
import { Modal } from './Modal'

export function ConfirmDialog({ title, message, confirmLabel, danger, askReason, busy, onConfirm, onClose }: {
  title: string; message: string; confirmLabel: string; danger?: boolean; askReason?: string
  busy?: boolean; onConfirm: (reason: string) => void; onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const missing = !!askReason && reason.trim().length < 3
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>Voltar</button>
      <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy || missing} onClick={() => onConfirm(reason.trim())}>
        {busy ? 'Aguarde…' : confirmLabel}
      </button>
    </>}>
      <p className="text-sm">{message}</p>
      {askReason && (
        <label className="mt-4 block">
          <span className="label">{askReason}</span>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}
    </Modal>
  )
}
