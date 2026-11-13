-- Guarda a tonalidade escolhida para cada cor personalizada.
alter table public.products add column if not exists color_hex text;
alter table public.products drop constraint if exists products_color_hex_check;
alter table public.products add constraint products_color_hex_check
  check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');
grant update (color_hex) on public.products to authenticated;
