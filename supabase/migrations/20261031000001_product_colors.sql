-- Cores por variante: cada combinação produto/marca/tamanho/cor possui estoque próprio.
alter table public.products add column if not exists color text;
alter table public.sale_items add column if not exists color text;

drop index if exists public.products_identity_uq;
create unique index products_identity_uq
  on public.products (company_id, category, lower(name), lower(brand), size, lower(coalesce(color, '')))
  where archived_at is null;

grant update (color) on public.products to authenticated;

-- Mantém a cor no snapshot da venda, mesmo se o cadastro do produto mudar depois.
update public.sale_items si set color = p.color
from public.products p where p.id = si.product_id and si.color is null;

create or replace function public._sync_sale_items(p_company uuid, p_sale uuid, p_items jsonb,
                                                   p_type public.movement_type, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; prod public.products%rowtype; old_qty int; delta int;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A venda precisa ter ao menos um produto.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where (e->>'product_id') is null or (e->>'quantity') is null or (e->>'quantity')::int <= 0) then
    raise exception 'Todas as quantidades devem ser maiores que zero.';
  end if;
  for r in
    select t.pid, sum(t.q)::int as new_qty
      from (select (e->>'product_id')::uuid as pid, (e->>'quantity')::int as q from jsonb_array_elements(p_items) e) t
     group by t.pid
    union all
    select si.product_id, 0 from public.sale_items si
     where si.sale_id = p_sale
       and si.product_id not in (select (e->>'product_id')::uuid from jsonb_array_elements(p_items) e)
    order by 1
  loop
    select * into prod from public.products where id = r.pid and company_id = p_company for update;
    if not found then raise exception 'Produto não encontrado.'; end if;
    select quantity into old_qty from public.sale_items where sale_id = p_sale and product_id = r.pid;
    old_qty := coalesce(old_qty, 0);
    delta := r.new_qty - old_qty;
    if delta = 0 then continue; end if;
    if delta > 0 then
      if prod.archived_at is not null then raise exception 'Produto arquivado: % (tam. %).', prod.name, prod.size; end if;
      if delta > prod.quantity then
        raise exception 'Estoque insuficiente: % — % (tam. %). Disponível: %, necessário: %.',
          prod.name, prod.brand, prod.size, prod.quantity, delta;
      end if;
    end if;
    perform set_config('app.stock_write', 'on', true);
    update public.products set quantity = quantity - delta where id = prod.id;
    insert into public.inventory_movements (company_id, product_id, type, quantity_delta, quantity_before, quantity_after, reason, sale_id, created_by)
    values (p_company, prod.id, p_type, -delta, prod.quantity, prod.quantity - delta, p_reason, p_sale, auth.uid());
    if r.new_qty = 0 then
      delete from public.sale_items where sale_id = p_sale and product_id = r.pid;
    elsif old_qty = 0 then
      insert into public.sale_items (company_id, sale_id, product_id, quantity, unit_price_cents, product_name, brand, size, category, color)
      values (p_company, p_sale, prod.id, r.new_qty, prod.price_cents, prod.name, prod.brand, prod.size, prod.category, prod.color);
    else
      update public.sale_items set quantity = r.new_qty where sale_id = p_sale and product_id = r.pid;
    end if;
  end loop;
end $$;
