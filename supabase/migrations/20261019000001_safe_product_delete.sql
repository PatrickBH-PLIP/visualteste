-- Visual Pimenta — exclusão permanente segura de produto sem histórico real
create or replace function public.delete_product_permanently(p_company uuid, p_product uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prod public.products%rowtype;
  movement_count integer;
begin
  perform public._require(p_company, true);

  select * into prod
    from public.products
   where id = p_product and company_id = p_company
   for update;

  if not found then
    raise exception 'Produto não encontrado nesta loja.';
  end if;

  if exists (
    select 1 from public.sale_items
    where product_id = p_product
  ) then
    raise exception 'Este produto possui itens de venda e não pode ser apagado permanentemente. Ele pode continuar arquivado.';
  end if;

  select count(*) into movement_count
    from public.inventory_movements
   where product_id = p_product
     and company_id = p_company;

  if movement_count > 0 then
    -- Exceção restrita: produto arquivado com apenas o lançamento automático
    -- de estoque inicial, sem vendas e sem outras movimentações.
    if prod.archived_at is not null
       and movement_count = 1
       and exists (
         select 1
           from public.inventory_movements m
          where m.product_id = p_product
            and m.company_id = p_company
            and m.type = 'estoque_inicial'
            and m.quantity_before = 0
            and m.quantity_delta = prod.quantity
            and m.quantity_after = prod.quantity
            and m.sale_id is null
       ) then
      delete from public.inventory_movements
       where product_id = p_product
         and company_id = p_company
         and type = 'estoque_inicial'
         and sale_id is null;
    else
      raise exception 'Este produto possui histórico de movimentações e não pode ser apagado permanentemente. Ele pode continuar arquivado.';
    end if;
  end if;

  delete from public.products
   where id = p_product and company_id = p_company;
end;
$$;

revoke all on function public.delete_product_permanently(uuid, uuid) from public, anon;
grant execute on function public.delete_product_permanently(uuid, uuid) to authenticated;
