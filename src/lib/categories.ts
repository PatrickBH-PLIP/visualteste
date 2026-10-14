import type { Category } from '@/types'

export interface CategoryTheme {
  key: Category
  label: string
  description: string
  main: string        // cor principal (botões, destaques)
  accent: string      // cor oficial secundária (detalhes, bordas)
  accentText: string  // versão com contraste para TEXTO pequeno sobre #ede8df
  slug: string
}

export const CATEGORIES: Record<Category, CategoryTheme> = {
  feminino: {
    key: 'feminino', slug: 'feminino', label: 'Feminino',
    description: 'Calcinhas de renda, algodão, modelos básicos, conjuntos e diferentes tamanhos.',
    main: '#fa300f', accent: '#ff746c', accentText: '#b8332b',
  },
  masculino: {
    key: 'masculino', slug: 'masculino', label: 'Masculino',
    description: 'Cuecas boxer, slip, algodão, microfibra e diferentes tamanhos.',
    main: '#0f2a4f', accent: '#00a8ff', accentText: '#00699c',
  },
  lingerie: {
    key: 'lingerie', slug: 'lingerie', label: 'Lingerie',
    description: 'Conjuntos, camisolas, bodies e peças especiais.',
    main: '#fa300f', accent: '#ff746c', accentText: '#b8332b',
  },
  sex_shop: {
    key: 'sex_shop', slug: 'sex-shop', label: 'Sex shop',
    description: 'Acessórios, produtos adultos e itens diversos.',
    main: '#cd1c18', accent: '#ff746c', accentText: '#b8332b',
  },
}

export const CATEGORY_LIST = Object.values(CATEGORIES)

export function categoryFromSlug(slug: string | undefined): CategoryTheme | null {
  return CATEGORY_LIST.find((c) => c.slug === slug) ?? null
}

export const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'transferencia', label: 'Transferência bancária' },
  { value: 'outra', label: 'Outra forma' },
] as const

export const methodLabel = (v: string) => PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v
