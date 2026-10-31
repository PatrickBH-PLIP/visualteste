-- Cores por variante: cada combinação produto/marca/tamanho/cor possui estoque próprio.
alter table public.products add column if not exists color text;
alter table public.sale_items add column if not exists color text;

drop index if exists public.products_identity_uq;
create unique index products_identity_uq
  on public.products (company_id, category, lower(name), lower(brand), size, lower(coalesce(color, '')))
  where archived_at is null;

grant update (color) on public.products to authenticated;
