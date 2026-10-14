import { useQuery } from '@tanstack/react-query'
import { signedUrls } from '@/services/products'

/** URL assinada (1 h) da foto; reaproveitada pelo cache entre telas e renovada antes de expirar. */
export function useProductImage(path: string | null | undefined) {
  return useQuery({
    queryKey: ['img', path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => (await signedUrls([path!]))[path!] ?? null,
  }).data ?? null
}
