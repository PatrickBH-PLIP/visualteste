import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { ImageUploader } from './ImageUploader'
import { ErrorBanner, Field } from './ui'
import { CATEGORY_LIST } from '@/lib/categories'
import { centsToInput, parseBRL } from '@/lib/money'
import { errorMessage, newId } from '@/lib/supabase'
import { productSchema, type ProductFormValues } from '@/lib/validation'
import { archiveProduct, createProduct, removeImage, updateProduct, uploadProductImage } from '@/services/products'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { SIZES, type Category, type Product } from '@/types'

type Stage = 'idle' | 'otimizando' | 'salvando'

export function ProductForm({ product, initialProduct, defaultCategory, onClose }: {
  product?: Product; initialProduct?: Product; defaultCategory: Category; onClose: () => void
}) {
  const { companyId, role } = useCompany()
  const qc = useQueryClient()
  const toast = useToast()
  const editing = !!product

  // ids estáveis por abertura do formulário: tentar de novo NÃO duplica produto nem foto
  const productId = useRef(product?.id ?? newId())
  const opId = useRef(newId())
  const fileKey = useRef(newId())

  const [file, setFile] = useState<File | null>(null)
  const [removeCurrent, setRemoveCurrent] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      name: product.name, category: product.category, brand: product.brand, size: product.size, material: product.material,
      quantity: product.quantity, price: centsToInput(product.price_cents), cost: centsToInput(product.cost_cents),
      min_stock: product.min_stock, sku: product.sku ?? '', barcode: product.barcode ?? '', supplier: product.supplier ?? '',
      description: product.description ?? '', notes: product.notes ?? '',
    } : initialProduct ? {
      name: initialProduct.name, category: initialProduct.category, brand: initialProduct.brand, size: '', material: initialProduct.material,
      quantity: 0, price: centsToInput(initialProduct.price_cents), cost: centsToInput(initialProduct.cost_cents),
      min_stock: initialProduct.min_stock, sku: '', barcode: '', supplier: initialProduct.supplier ?? '',
      description: initialProduct.description ?? '', notes: initialProduct.notes ?? '',
    } : { category: defaultCategory, quantity: 0, min_stock: 0, price: '', cost: '' } as Partial<ProductFormValues>,
  })

  const save = useMutation({
    mutationFn: async (v: ProductFormValues) => {
      setError(null)
      const base = {
        category: v.category, name: v.name, brand: v.brand, size: v.size, material: v.material,
        price_cents: parseBRL(v.price)!, cost_cents: v.cost ? parseBRL(v.cost) : null, min_stock: v.min_stock,
      }
      let newPath: string | null = null
      try {
        if (file) { setStage('otimizando'); newPath = await uploadProductImage(companyId, productId.current, file, fileKey.current) }
        setStage('salvando')
        if (!editing) {
          await createProduct(companyId, opId.current, {
            id: productId.current, ...base, quantity: v.quantity, sku: v.sku, barcode: v.barcode,
            supplier: v.supplier, description: v.description, notes: v.notes,
          }, newPath ?? initialProduct?.image_path ?? null)
        } else {
          const image_path = file ? newPath : removeCurrent ? null : product!.image_path
          await updateProduct(product!.id, {
            ...base, sku: v.sku || null, barcode: v.barcode || null, supplier: v.supplier || null,
            description: v.description || null, notes: v.notes || null, image_path,
          })
          // arquivo antigo só é apagado DEPOIS de o banco apontar para o novo (sem órfãos / sem perda)
          if ((file || removeCurrent) && product!.image_path && product!.image_path !== newPath) await removeImage(product!.image_path)
        }
      } catch (e) {
        if (newPath && (!editing || newPath !== product?.image_path)) await removeImage(newPath) // desfaz upload órfão
        throw e
      }
    },
    onSuccess: () => {
      toast('ok', editing ? 'Produto atualizado.' : 'Produto cadastrado.')
      qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['home'] })
      onClose()
    },
    onError: (e) => setError(errorMessage(e)),
    onSettled: () => setStage('idle'),
  })

  const archive = useMutation({
    mutationFn: async () => {
      await archiveProduct(product!.id)
      await removeImage(product!.image_path)
    },
    onSuccess: () => { toast('ok', 'Produto arquivado. O histórico foi preservado.'); qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['home'] }); onClose() },
    onError: (e) => { setConfirmArchive(false); setError(errorMessage(e)) },
  })

  const busy = save.isPending
  const stageText = stage === 'otimizando' ? 'Enviando foto…' : stage === 'salvando' ? 'Salvando…' : 'Aguarde…'

  return (
    <>
      <Modal title={editing ? 'Editar produto' : 'Cadastrar novo produto'} onClose={busy ? () => {} : onClose} wide
        footer={<>
          {editing && role === 'admin' && <button type="button" className="btn-ghost mr-auto !text-chilli" disabled={busy} onClick={() => setConfirmArchive(true)}>Arquivar produto</button>}
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="product-form" className="btn-primary" disabled={busy}>{busy ? stageText : editing ? 'Salvar alterações' : 'Cadastrar produto'}</button>
        </>}>
        <form id="product-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          {error && <div className="sm:col-span-2"><ErrorBanner message={error} onRetry={file ? () => handleSubmit((v) => save.mutate(v))() : undefined} /></div>}
          {busy && <div className="sm:col-span-2 h-1.5 overflow-hidden rounded bg-tinta/10" aria-hidden><div className="h-full w-1/3 animate-pulse rounded" style={{ background: 'var(--c-main)' }} /></div>}

          <div className="sm:col-span-2">
            <ImageUploader file={file} onFile={(f) => { setFile(f); if (f) setRemoveCurrent(false) }} existingPath={product?.image_path ?? initialProduct?.image_path}
              removed={removeCurrent} onRemoveExisting={() => setRemoveCurrent(true)} disabled={busy} />
          </div>

          <div className="sm:col-span-2"><Field label="Nome do produto *" error={errors.name?.message}><input className="input" {...register('name')} autoComplete="off" /></Field></div>
          <Field label="Categoria *" error={errors.category?.message}>
            <select className="input" {...register('category')}>{CATEGORY_LIST.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
          </Field>
          <Field label="Marca *" error={errors.brand?.message}><input className="input" {...register('brand')} autoComplete="off" /></Field>
          <Field label="Tamanho *" error={errors.size?.message}>
            <select className="input" {...register('size')} defaultValue={product?.size ?? ''}>
              <option value="" disabled>Selecione</option>{SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Material *" error={errors.material?.message}><input className="input" {...register('material')} placeholder="Algodão, renda, microfibra…" /></Field>
          {!editing && <Field label="Quantidade inicial *" error={errors.quantity?.message}><input className="input" type="number" inputMode="numeric" min={0} {...register('quantity')} /></Field>}
          {editing && <Field label="Quantidade em estoque" hint="Para alterar, use “Adicionar ao estoque” ou registre uma venda."><input className="input opacity-70" value={product!.quantity} readOnly /></Field>}
          <Field label="Preço de venda (R$) *" error={errors.price?.message}><input className="input" inputMode="decimal" placeholder="0,00" {...register('price')} /></Field>
          <Field label="Custo de aquisição (R$)" error={errors.cost?.message}><input className="input" inputMode="decimal" placeholder="0,00" {...register('cost')} /></Field>
          <Field label="Estoque mínimo" error={errors.min_stock?.message}><input className="input" type="number" inputMode="numeric" min={0} {...register('min_stock')} /></Field>
          <Field label="Código SKU"><input className="input" {...register('sku')} /></Field>
          <Field label="Código de barras"><input className="input" inputMode="numeric" {...register('barcode')} /></Field>
          <Field label="Fornecedor"><input className="input" {...register('supplier')} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição complementar"><textarea className="input" rows={2} {...register('description')} /></Field></div>
          <div className="sm:col-span-2"><Field label="Observações"><textarea className="input" rows={2} {...register('notes')} /></Field></div>
        </form>
      </Modal>
      {confirmArchive && (
        <ConfirmDialog title="Arquivar produto" danger confirmLabel="Arquivar" busy={archive.isPending}
          message="O produto sai das listas de estoque e de vendas, mas o histórico de movimentações e vendas é mantido."
          onConfirm={() => archive.mutate()} onClose={() => setConfirmArchive(false)} />
      )}
    </>
  )
}
