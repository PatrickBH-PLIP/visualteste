-- Limpeza estritamente validada dos registros de teste confirmados.
create or replace function public.cleanup_cancelled_test_product(
  p_company uuid,
  p_product uuid,
  p_sale uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prod public.products%rowtype;
  sale_row public.sales%rowtype;
begin
  perform public._require(p_company, true);

  -- Trava esta rotina aos IDs da venda/produto de teste identificados.
  if p_company <> '4558bccd-5713-44ae-a7d9-fd3d72bcea08'::uuid
     or p_product <> '25c9a9c6-3a4b-448e-8654-7a47f02081f4'::uuid
     or p_sale <> 'd2ebebce-33a9-40b1-87d6-b88728a3c84b'::uuid then
    raise exception 'Esta rotina só pode limpar os registros de teste previamente identificados.';
  end if;

  select * into prod
    from public.products
   where id = p_product and company_id = p_company
   for update;

  if not found or prod.archived_at is null then
    raise exception 'Produto não encontrado ou não está arquivado.';
  end if;

  select * into sale_row
    from public.sales
   where id = p_sale and company_id = p_company
   for update;

  if not found or sale_row.cancelled_at is null
     or sale_row.sale_number <> 1
     or sale_row.cancel_reason <> 'FICOU PEQUENO' then
    raise exception 'Venda não encontrada ou não está cancelada.';
  end if;

  -- Só permite uma venda cancelada que contenha exclusivamente este produto.
  if (select count(*) from public.sale_items where sale_id = p_sale) <> 1
     or not exists (
       select 1 from public.sale_items
        where sale_id = p_sale and product_id = p_product
     )
     or (select count(*) from public.sale_items where product_id = p_product) <> 1 then
    raise exception 'O produto ou a venda tem outros itens relacionados; nada foi apagado.';
  end if;

  -- Exige exatamente os três movimentos conhecidos deste teste.
  if (select count(*) from public.inventory_movements
       where company_id = p_company and product_id = p_product) <> 3
     or not exists (
       select 1 from public.inventory_movements
        where company_id = p_company and product_id = p_product
          and type = 'entrada_manual'
          and quantity_before = 0
          and quantity_delta = prod.quantity
          and quantity_after = prod.quantity
          and sale_id is null
     )
     or not exists (
       select 1 from public.inventory_movements
        where company_id = p_company and product_id = p_product
          and type = 'venda' and sale_id = p_sale
          and quantity_delta = -1
     )
     or not exists (
       select 1 from public.inventory_movements
        where company_id = p_company and product_id = p_product
          and type = 'cancelamento_venda' and sale_id = p_sale
          and quantity_delta = 1
     ) then
    raise exception 'As movimentações não correspondem exatamente ao teste conhecido; nada foi apagado.';
  end if;

  -- Só permite pagamentos já estornados.
  if exists (
       select 1 from public.payments
        where sale_id = p_sale and reversed_at is null
     ) then
    raise exception 'Existe pagamento não estornado; nada foi apagado.';
  end if;

  delete from public.payments where sale_id = p_sale;
  delete from public.inventory_movements
   where company_id = p_company and product_id = p_product;
  delete from public.sale_items where sale_id = p_sale and product_id = p_product;
  delete from public.sales where id = p_sale and company_id = p_company;
  delete from public.products where id = p_product and company_id = p_company;
end;
$$;

revoke all on function public.cleanup_cancelled_test_product(uuid, uuid, uuid) from public, anon;
grant execute on function public.cleanup_cancelled_test_product(uuid, uuid, uuid) to authenticated;
