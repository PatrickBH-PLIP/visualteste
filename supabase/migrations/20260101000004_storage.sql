-- Visual Pimenta — 004 Storage (bucket PRIVADO; fotos servidas por URL assinada)
-- Caminho dos arquivos: <company_id>/<product_id>/<arquivo>.webp

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create or replace function public.storage_company(p_name text)
returns uuid language sql immutable as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

create policy "product images: select" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_member(public.storage_company(name)));
create policy "product images: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_member(public.storage_company(name)));
create policy "product images: update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_member(public.storage_company(name)))
  with check (bucket_id = 'product-images' and public.is_member(public.storage_company(name)));
create policy "product images: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_member(public.storage_company(name)));
