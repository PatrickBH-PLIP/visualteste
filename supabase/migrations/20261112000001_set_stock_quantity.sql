-- Ajuste de estoque para definir a quantidade real (permite aumentar ou reduzir).
create or replace function public.set_stock_quantity(
  p_company uuid, p_op uuid, p_product uuid, p_quantity integer, p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  previous_result jsonb;
  prod public.products%rowtype;
  delta integer;
  result jsonb;
  reason_text text;
begin
  uid := public._require(p_company, true);
  previous_result := public._begin_op(p_company, p_op);
  if previous_result is not null then return previous_result; end if;

  if p_quantity is null or p_quantity < 0 then
    raise exception 'A quantidade deve ser um número inteiro igual ou maior que zero.';
  end if;

  select * into prod
    from public.products
   where id = p_product and company_id = p_company and archived_at is null
   for update;
  if not found then raise exception 'Produto não encontrado.'; end if;

  delta := p_quantity - prod.quantity;
  reason_text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Ajuste manual de estoque');

  if delta <> 0 then
    perform set_config('app.stock_write', 'on', true);
    update public.products set quantity = p_quantity where id = prod.id;

    insert into public.inventory_movements (
      company_id, product_id, type, quantity_delta, quantity_before, quantity_after, reason, created_by
    ) values (
      p_company, prod.id, 'ajuste', delta, prod.quantity, p_quantity, reason_text, uid
    );

    perform public._audit(
      p_company, 'stock_set', 'products', prod.id,
      jsonb_build_object('quantity', prod.quantity),
      jsonb_build_object('quantity', p_quantity, 'delta', delta, 'reason', reason_text)
    );
  end if;

  result := jsonb_build_object('product_id', prod.id, 'quantity', p_quantity, 'delta', delta);
  return public._end_op(p_company, p_op, 'set_stock_quantity', result);
end;
$$;

revoke all on function public.set_stock_quantity(uuid, uuid, uuid, integer, text) from public, anon;
grant execute on function public.set_stock_quantity(uuid, uuid, uuid, integer, text) to authenticated;
