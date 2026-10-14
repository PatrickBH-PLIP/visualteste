export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_INPUT_BYTES = 12 * 1024 * 1024 // arquivo original
export const MAX_OUTPUT_BYTES = 5 * 1024 * 1024 // limite do bucket

export function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Formato não suportado. Use JPG, PNG ou WebP.'
  if (file.size > MAX_INPUT_BYTES) return 'A imagem passa de 12 MB. Escolha uma foto menor.'
  return null
}

/** Redimensiona (lado maior 1280px), corrige a orientação do celular e converte para WebP. */
export async function optimizeImage(file: File, maxSide = 1280, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.')
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q))
  let blob = await toBlob('image/webp', quality)
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', quality) // Safari antigo
  if (!blob) throw new Error('Falha ao otimizar a imagem.')
  if (blob.size > MAX_OUTPUT_BYTES) throw new Error('A imagem continua grande demais após a otimização.')
  return blob
}

export const extForBlob = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'jpg')
