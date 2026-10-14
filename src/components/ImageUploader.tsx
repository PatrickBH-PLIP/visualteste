import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2, RefreshCw } from 'lucide-react'
import { validateImage } from '@/lib/image'
import { useProductImage } from '@/hooks/useProductImage'

/**
 * Seletor de foto (galeria do celular / arquivos do computador) com prévia, troca e remoção.
 * `existingPath` = foto já salva (exibida via URL assinada) até o usuário trocar ou remover.
 */
export function ImageUploader({ file, onFile, existingPath, removed, onRemoveExisting, disabled }: {
  file: File | null
  onFile: (f: File | null) => void
  existingPath?: string | null
  removed?: boolean
  onRemoveExisting?: () => void
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const savedUrl = useProductImage(existingPath && !removed ? existingPath : null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const shown = preview ?? (removed ? null : savedUrl)
  const pick = (f: File | undefined) => {
    if (!f) return
    const err = validateImage(f)
    setError(err)
    if (!err) onFile(f)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <span className="label">Foto do produto</span>
      <div className="flex items-center gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-tinta/20 bg-white/60">
          {shown ? <img src={shown} alt="Prévia da foto" className="h-full w-full object-cover" /> : <ImagePlus className="text-tinta/35" size={30} />}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="product-photo"
            onChange={(e) => pick(e.target.files?.[0])} disabled={disabled} />
          <button type="button" className="btn-outline" disabled={disabled} onClick={() => input.current?.click()}>
            {shown ? <><RefreshCw size={16} />Trocar foto</> : <><ImagePlus size={16} />Escolher da galeria</>}
          </button>
          {shown && (
            <button type="button" className="btn-ghost !text-chilli" disabled={disabled}
              onClick={() => { onFile(null); onRemoveExisting?.() }}>
              <Trash2 size={16} />Remover foto
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-tinta/60">JPG, PNG ou WebP até 12 MB. A foto é reduzida automaticamente antes do envio.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
