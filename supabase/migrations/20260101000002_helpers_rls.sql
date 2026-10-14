-- Visual Pimenta — 002 Funções auxiliares, RLS e permissões
-- Política: negar por padrão. Escritas sensíveis só via funções (security definer) em 003.

create or replace function public.is_member(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members
                 where company_id = p_company and user_id = auth.uid());
$$;

create or replace function public.is_admin(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members
                 where company_id = p_company and user_id = auth.uid() and role = 'admin');
$$;

revoke all on function public.is_member(uuid), public.is_admin(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_admin(uuid) to authenticated;

alter table public.companies           enable row level security;
alter table public.profiles            enable row level security;
alter table public.company_members     enable row level security;
alter table public.products            enable row level security;
alter table public.sales               enable row level security;
alter table public.sale_items          enable row level security;
alter table public.payments            enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.operations          enable row level security;

-- Remove tudo de anon e de authenticated; concede só o necessário.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.companies, public.sales, public.sale_items, public.payments,
                public.inventory_movements, public.sales_summary to authenticated;
grant select on public.products to authenticated;
grant select (company_id, user_id, role, created_at) on public.company_members to authenticated;
grant select on public.profiles to authenticated;
grant select on public.audit_logs to authenticated;

-- Produtos: editar dados cadastrais direto pela API; "quantity" NÃO está na lista (só via funções).
grant update (category, name, brand, size, material, price_cents, cost_cents, min_stock, sku, barcode,
              supplier, description, notes, image_path, archived_at, updated_at)
  on public.products to authenticated;

create policy companies_select on public.companies for select to authenticated
  using (public.is_member(id));

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid());

create policy members_select on public.company_members for select to authenticated
  using (user_id = auth.uid() or public.is_admin(company_id));

create policy products_select on public.products for select to authenticated
  using (public.is_member(company_id));
create policy products_update on public.products for update to authenticated
  using (public.is_member(company_id)) with check (public.is_member(company_id));

create policy sales_select on public.sales for select to authenticated
  using (public.is_member(company_id));
create policy sale_items_select on public.sale_items for select to authenticated
  using (public.is_member(company_id));
create policy payments_select on public.payments for select to authenticated
  using (public.is_member(company_id));
create policy movements_select on public.inventory_movements for select to authenticated
  using (public.is_member(company_id));
create policy audit_select on public.audit_logs for select to authenticated
  using (public.is_admin(company_id));
-- operations: sem policy => ninguém lê/escreve direto (somente as funções).

-- Impede mudar company_id/quantity por qualquer caminho de UPDATE direto.
create or replace function public.products_guard()
returns trigger language plpgsql as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id é imutável'; end if;
  if new.quantity <> old.quantity and coalesce(current_setting('app.stock_write', true), '') <> 'on' then
    raise exception 'A quantidade só pode ser alterada por entradas/vendas registradas.';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger products_guard_trg before update on public.products
  for each row execute function public.products_guard();
