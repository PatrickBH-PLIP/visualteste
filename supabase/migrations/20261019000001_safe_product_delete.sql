-- Visual Pimenta — exclusão permanente segura de produto sem histórico
create or replace function public.delete_product_permanently(p_company uuid, p_product uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare prod public.products%rowtype;
begin
  perform public._require(p_company, true);

  select * into prod
    from public.products
   where id = p_product and company_id = p_company
   for update;

  if not found then
    raise exception 'Produto não encontrado nesta loja.';
  end if;

  if exists (select 1 from public.sale_items where product_id = p_product)
     or exists (select 1 from public.inventory_movements where product_id = p_product) then
    raise exception 'Este produto possui histórico de vendas ou movimentações. Ele pode permanecer arquivado, mas não pode ser apagado permanentemente.';
  end if;

  delete from public.products where id = p_product and company_id = p_company;
end;
$$;

revoke all on function public.delete_product_permanently(uuid, uuid) from public, anon;
grant execute on function public.delete_product_permanently(uuid, uuid) to authenticated;
