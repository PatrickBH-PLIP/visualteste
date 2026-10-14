-- Visual Pimenta — 003 Funções transacionais (regras de negócio no banco)
-- Todas: security definer, verificam associação à empresa, são idempotentes por op_id
-- e bloqueiam linhas com FOR UPDATE (em ordem de id, para evitar deadlock).

-- ---------- utilitários internos ----------
create or replace function public._require(p_company uuid, p_admin boolean default false)
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501'; end if;
  if p_admin then
    if not public.is_admin(p_company) then raise exception 'Apenas administradores podem realizar esta ação.' using errcode = '42501'; end if;
  elsif not public.is_member(p_company) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create or replace function public._begin_op(p_company uuid, p_op uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if p_op is null then raise exception 'Identificador da operação ausente.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_company::text || p_op::text, 0));
  select result into r from public.operations where company_id = p_company and op_id = p_op;
  return r;  -- não nulo => operação já executada: devolver o resultado original
end $$;

create or replace function public._end_op(p_company uuid, p_op uuid, p_kind text, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  insert into public.operations (company_id, op_id, kind, result, created_by)
  values (p_company, p_op, p_kind, p_result, auth.uid());
  return p_result;
end $$;

create or replace function public._audit(p_company uuid, p_action text, p_entity text, p_id uuid, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (company_id, user_id, action, entity, entity_id, before, after)
  values (p_company, auth.uid(), p_action, p_entity, p_id, p_before, p_after);
$$;

revoke all on function public._require(uuid, boolean), public._begin_op(uuid, uuid),
  public._end_op(uuid, uuid, text, jsonb), public._audit(uuid, text, text, uuid, jsonb, jsonb)
  from public, anon, authenticated;

-- ---------- empresa / usuários ----------
create or replace function public.bootstrap_company(p_name text, p_full_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bootstrap_company', 0));
  if exists (select 1 from public.companies) then
    raise exception 'O sistema já foi configurado. Peça acesso ao administrador.';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Informe o nome da loja.'; end if;
  insert into public.companies (name) values (trim(p_name)) returning id into cid;
  insert into public.company_members (company_id, user_id, role) values (cid, auth.uid(), 'admin');
  insert into public.profiles (id, full_name) values (auth.uid(), nullif(trim(coalesce(p_full_name, '')), ''))
    on conflict (id) do update set full_name = excluded.full_name;
  perform public._audit(cid, 'bootstrap', 'companies', cid, null, jsonb_build_object('name', p_name));
  return cid;
end $$;

create or replace function public.add_member(p_company uuid, p_email text, p_role public.app_role)
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  perform public._require(p_company, true);
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Nenhum usuário com esse e-mail. Crie-o primeiro em Authentication > Users no Supabase.';
  end if;
  insert into public.company_members (company_id, user_id, role) values (p_company, uid, p_role)
    on conflict (company_id, user_id) do update set role = excluded.role;
  perform public._audit(p_company, 'member_add', 'company_members', uid, null,
                        jsonb_build_object('email', p_email, 'role', p_role));
end $$;

create or replace function public.list_members(p_company uuid)
returns table (user_id uuid, email text, role public.app_role)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public._require(p_company, true);
  return query select m.user_id, u.email::text, m.role
               from public.company_members m join auth.users u on u.id = m.user_id
               where m.company_id = p_company order by u.email;
end $$;

create or replace function public.remove_member(p_company uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require(p_company, true);
  if p_user = auth.uid() then raise exception 'Você não pode remover a si mesmo.'; end if;
  delete from public.company_members where company_id = p_company and user_id = p_user;
  perform public._audit(p_company, 'member_remove', 'company_members', p_user, null, null);
end $$;

-- ---------- produtos / estoque ----------
create or replace function public.create_product(p_company uuid, p_op uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; prev jsonb; pid uuid; qty int; res jsonb;
begin
  uid := public._require(p_company);
  prev := public._begin_op(p_company, p_op);
  if prev is not null then return prev; end if;

  qty := coalesce((p->>'quantity')::int, 0);
  if qty < 0 then raise exception 'A quantidade inicial não pode ser negativa.'; end if;
  pid := coalesce((p->>'id')::uuid, gen_random_uuid());

  insert into public.products (id, company_id, category, name, brand, size, material, price_cents, cost_cents,
                               quantity, min_stock, sku, barcode, supplier, description, notes, image_path, created_by)
  values (pid, p_company, (p->>'category')::public.product_category, trim(p->>'name'), trim(p->>'brand'),
          p->>'size', trim(p->>'material'), (p->>'price_cents')::int, nullif(p->>'cost_cents', '')::int,
          0, coalesce((p->>'min_stock')::int, 0), nullif(trim(p->>'sku'), ''), nullif(trim(p->>'barcode'), ''),
          nullif(trim(p->>'supplier'), ''), nullif(trim(p->>'description'), ''), nullif(trim(p->>'notes'), ''),
          nullif(p->>'image_path', ''), uid);

  if qty > 0 then
    perform set_config('app.stock_write', 'on', true);
    update public.products set quantity = qty where id = pid;
    insert into public.inventory_movements (company_id, product_id, type, quantity_delta, quantity_before, quantity_after, reason, created_by)
    values (p_company, pid, 'estoque_inicial', qty, 0, qty, 'Estoque inicial no cadastro', uid);
  end if;

  perform public._audit(p_company, 'product_create', 'products', pid, null, p);
  res := jsonb_build_object('product_id', pid);
  return public._end_op(p_company, p_op, 'create_product', res);
exception when unique_violation then
  raise exception 'Já existe um produto igual (mesmo nome, marca e tamanho) ou o SKU já está em uso.';
end $$;

create or replace function public.add_stock(p_company uuid, p_op uuid, p_product uuid, p_qty int,
                                            p_type public.movement_type, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; prev jsonb; prod public.products%rowtype; res jsonb;
begin
  uid := public._require(p_company);
  prev := public._begin_op(p_company, p_op);
  if prev is not null then return prev; end if;

  if p_qty is null or p_qty <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;
  if p_type not in ('entrada_manual', 'devolucao', 'ajuste') then raise exception 'Tipo de entrada inválido.'; end if;
  if p_type = 'ajuste' then perform public._require(p_company, true); end if;  -- ajuste = autorizado (admin)

  select * into prod from public.products
   where id = p_product and company_id = p_company and archived_at is null for update;
  if not found then raise exception 'Produto não encontrado.'; end if;

  perform set_config('app.stock_write', 'on', true);
  update public.products set quantity = quantity + p_qty where id = prod.id;
  insert into public.inventory_movements (company_id, product_id, type, quantity_delta, quantity_before, quantity_after, reason, created_by)
  values (p_company, prod.id, p_type, p_qty, prod.quantity, prod.quantity + p_qty, nullif(trim(coalesce(p_reason, '')), ''), uid);

  perform public._audit(p_company, 'stock_add', 'products', prod.id,
    jsonb_build_object('quantity', prod.quantity), jsonb_build_object('quantity', prod.quantity + p_qty, 'reason', p_reason));
  res := jsonb_build_object('product_id', prod.id, 'quantity', prod.quantity + p_qty);
  return public._end_op(p_company, p_op, 'add_stock', res);
end $$;

-- ---------- vendas ----------
-- Sincroniza sale_items e estoque com a lista desejada. Calcula só a diferença (delta) por produto.
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
    select si.product_id, 0
      from public.sale_items si
     where si.sale_id = p_sale
       and si.product_id not in (select (e->>'product_id')::uuid from jsonb_array_elements(p_items) e)
    order by 1
  loop
    select * into prod from public.products where id = r.pid and company_id = p_company for update;
    if not found then raise exception 'Produto não encontrado.'; end if;

    select quantity into old_qty from public.sale_items where sale_id = p_sale and product_id = r.pid;
    old_qty := coalesce(old_qty, 0);
    delta := r.new_qty - old_qty;          -- >0 retira mais do estoque; <0 devolve
    if delta = 0 then continue; end if;

    if delta > 0 then
      if prod.archived_at is not null then
        raise exception 'Produto arquivado: % (tam. %).', prod.name, prod.size;
      end if;
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
      insert into public.sale_items (company_id, sale_id, product_id, quantity, unit_price_cents, product_name, brand, size, category)
      values (p_company, p_sale, prod.id, r.new_qty, prod.price_cents, prod.name, prod.brand, prod.size, prod.category);
    else
      update public.sale_items set quantity = r.new_qty where sale_id = p_sale and product_id = r.pid;  -- preço histórico mantido
    end if;
  end loop;
end $$;

create or replace function public._recalc_sale(p_sale uuid, p_discount int)
returns void language plpgsql security definer set search_path = public as $$
declare g int;
begin
  select coalesce(sum(quantity * unit_price_cents), 0) into g from public.sale_items where sale_id = p_sale;
  if p_discount < 0 then raise exception 'O desconto não pode ser negativo.'; end if;
  if p_discount > g then raise exception 'O desconto não pode ser maior que o subtotal.'; end if;
  update public.sales set gross_cents = g, discount_cents = p_discount, net_cents = g - p_discount, updated_at = now()
   where id = p_sale;
end $$;

create or replace function public._insert_payment(p_company uuid, p_sale uuid, p_kind text, p_amount int,
                                                  p_method public.payment_method, p_ref text, p_notes text, p_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.sales%rowtype; paid int; limit_cents int; pid uuid;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  select * into s from public.sales where id = p_sale and company_id = p_company for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  select coalesce(sum(case when kind = 'refund' then -amount_cents else amount_cents end), 0) into paid
    from public.payments where sale_id = p_sale and reversed_at is null;

  if p_kind = 'payment' then
    if s.cancelled_at is not null then raise exception 'Venda cancelada não recebe pagamentos.'; end if;
    limit_cents := s.net_cents - paid;
    if p_amount > limit_cents then
      raise exception 'O valor excede o saldo em aberto (R$ %).', to_char(limit_cents / 100.0, 'FM999G999G990D00');
    end if;
  else  -- refund: só devolve o que foi pago a mais (ou tudo, se a venda foi cancelada)
    limit_cents := case when s.cancelled_at is not null then paid else greatest(paid - s.net_cents, 0) end;
    if p_amount > limit_cents then
      raise exception 'A devolução excede o valor a devolver (R$ %).', to_char(limit_cents / 100.0, 'FM999G999G990D00');
    end if;
  end if;

  insert into public.payments (company_id, sale_id, kind, amount_cents, method, reference, notes, received_at, created_by)
  values (p_company, p_sale, p_kind, p_amount, p_method, nullif(trim(coalesce(p_ref, '')), ''),
          nullif(trim(coalesce(p_notes, '')), ''), coalesce(p_at, now()), auth.uid())
  returning id into pid;
  return pid;
end $$;

revoke all on function public._sync_sale_items(uuid, uuid, jsonb, public.movement_type, text),
  public._recalc_sale(uuid, int),
  public._insert_payment(uuid, uuid, text, int, public.payment_method, text, text, timestamptz)
  from public, anon, authenticated;

create or replace function public.create_sale(p_company uuid, p_op uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; prev jsonb; n bigint; sid uuid; res jsonb; pay jsonb; disc int;
begin
  uid := public._require(p_company);
  prev := public._begin_op(p_company, p_op);
  if prev is not null then return prev; end if;

  if length(trim(coalesce(p->>'customer_name', ''))) = 0 then raise exception 'Informe o nome do cliente.'; end if;
  if length(regexp_replace(coalesce(p->>'customer_phone', ''), '\D', '', 'g')) not between 10 and 13 then
    raise exception 'Informe o telefone com DDD.';
  end if;
  if (p->>'due_date')::date < (p->>'purchase_date')::date then
    raise exception 'A data prevista de pagamento não pode ser anterior à data da compra.';
  end if;
  disc := coalesce((p->>'discount_cents')::int, 0);

  update public.companies set sale_seq = sale_seq + 1 where id = p_company returning sale_seq into n;
  sid := gen_random_uuid();
  insert into public.sales (id, company_id, sale_number, customer_name, customer_phone, purchase_date, due_date, notes, created_by)
  values (sid, p_company, n, trim(p->>'customer_name'), trim(p->>'customer_phone'),
          (p->>'purchase_date')::date, (p->>'due_date')::date, nullif(trim(coalesce(p->>'notes', '')), ''), uid);

  perform public._sync_sale_items(p_company, sid, p->'items', 'venda', 'Venda #' || n);
  perform public._recalc_sale(sid, disc);

  pay := p->'payment';
  if pay is not null and jsonb_typeof(pay) = 'object' and coalesce((pay->>'amount_cents')::int, 0) > 0 then
    perform public._insert_payment(p_company, sid, 'payment', (pay->>'amount_cents')::int,
      (pay->>'method')::public.payment_method, pay->>'reference', pay->>'notes', now());
  end if;

  perform public._audit(p_company, 'sale_create', 'sales', sid, null, p);
  res := jsonb_build_object('sale_id', sid, 'sale_number', n);
  return public._end_op(p_company, p_op, 'create_sale', res);
end $$;

create or replace function public.update_sale(p_company uuid, p_op uuid, p_sale uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; prev jsonb; s public.sales%rowtype; before_row jsonb; res jsonb; paid int; net int;
begin
  uid := public._require(p_company);
  prev := public._begin_op(p_company, p_op);
  if prev is not null then return prev; end if;

  select * into s from public.sales where id = p_sale and company_id = p_company for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if s.cancelled_at is not null then raise exception 'Venda cancelada não pode ser editada.'; end if;
  before_row := to_jsonb(s) || jsonb_build_object('items',
    (select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'quantity', quantity, 'unit_price_cents', unit_price_cents)), '[]'::jsonb)
       from public.sale_items where sale_id = p_sale));

  if length(trim(coalesce(p->>'customer_name', ''))) = 0 then raise exception 'Informe o nome do cliente.'; end if;
  if (p->>'due_date')::date < (p->>'purchase_date')::date then
    raise exception 'A data prevista de pagamento não pode ser anterior à data da compra.';
  end if;

  update public.sales set customer_name = trim(p->>'customer_name'), customer_phone = trim(p->>'customer_phone'),
         purchase_date = (p->>'purchase_date')::date, due_date = (p->>'due_date')::date,
         notes = nullif(trim(coalesce(p->>'notes', '')), '') where id = p_sale;

  perform public._sync_sale_items(p_company, p_sale, p->'items', 'edicao_venda', 'Edição da venda #' || s.sale_number);
  perform public._recalc_sale(p_sale, coalesce((p->>'discount_cents')::int, 0));

  -- Pagamentos NUNCA são apagados na edição. Se o novo total ficou abaixo do pago, a venda vira CREDITO
  -- e o usuário decide (ação explícita) registrar a devolução.
  select net_cents into net from public.sales where id = p_sale;
  select coalesce(sum(case when kind = 'refund' then -amount_cents else amount_cents end), 0) into paid
    from public.payments where sale_id = p_sale and reversed_at is null;

  perform public._audit(p_company, 'sale_update', 'sales', p_sale, before_row, p);
  res := jsonb_build_object('sale_id', p_sale, 'credit_cents', greatest(paid - net, 0));
  return public._end_op(p_company, p_op, 'update_sale', res);
end $$;

create or replace function public.cancel_sale(p_company uuid, p_op uuid, p_sale uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; prev jsonb; s public.sales%rowtype; r record; prod public.products%rowtype; res jsonb; paid int;
begin
  uid := public._require(p_company, true);   -- cancelar = administrador
  prev := public._begin_op(p_company, p_op);
  if prev is not null then return prev; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Informe o motivo do cancelamento.'; end if;

  select * into s from public.sales where id = p_sale and company_id = p_company for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if s.cancelled_at is not null then raise exception 'Esta venda já foi cancelada.'; end if;  -- sem estorno duplo

  for r in select product_id, quantity from public.sale_items where sale_id = p_sale order by product_id loop
    select * into prod from public.products where id = r.product_id for update;
    perform set_config('app.stock_write', 'on', true);
    update public.products set quantity = quantity + r.quantity where id = prod.id;
    insert into public.inventory_movements (company_id, product_id, type, quantity_delta, quantity_before, quantity_after, reason, sale_id, created_by)
    values (p_company, prod.id, 'cancelamento_venda', r.quantity, prod.quantity, prod.quantity + r.quantity,
            'Cancelamento da venda #' || s.sale_number || ': ' || trim(p_reason), p_sale, uid);
  end loop;

  update public.sales set cancelled_at = now(), cancelled_by = uid, cancel_reason = trim(p_reason), updated_at = now()
   where id = p_sale;   -- venda e itens ficam preservados; pagamentos também

  select coalesce(sum(case when kind = 'refund' then -amount_cents else amount_cents end), 0) into paid
    from public.payments where sale_id = p_sale and reversed_at is null;

  perform public._audit(p_company, 'sale_cancel', 'sales', p_sale, to_jsonb(s), jsonb_build_object('reason', p_reason));
  res := jsonb_build_object('sale_id', p_sale, 'refund_due_cents', greatest(paid, 0));
  return public._end_op(p_company, p_op, 'cancel_sale', res);
end $$;

-- ---------- pagamentos ----------
create or replace function public.register_payment(p_company uuid, p_op uuid, p_sale uuid, p_amount int,
  p_method public.payment_method, p_reference text default null, p_notes text default null,
  p_received_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare prev jsonb; pid uuid; res jsonb;
begin
  perform public._require(p_company);
  prev := public._begin_op(p_company, p_op);
  if prev is not null then return prev; end if;
  pid := public._insert_payment(p_company, p_sale, 'payment', p_amount, p_method, p_reference, p_notes, p_received_at);
  perform public._audit(p_company, 'payment_create', 'payments', pid, null,
    jsonb_build_object('sale_id', p_sale, 'amount_cents', p_amount, 'method', p_method));
  res := jsonb_build_object('payment_id', pid);
  return public._end_op(p_company, p_op, 'register_payment', res);
end $$;

create or replace function public.register_refund(p_company uuid, p_op uuid, p_sale uuid, p_amount int,
  p_method public.payment_method, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare prev jsonb; pid uuid; res jsonb;
begin
  perform public._require(p_company);
  prev := public._begin_op(p_company, p_op);
  if prev is not null then return prev; end if;
  pid := public._insert_payment(p_company, p_sale, 'refund', p_amount, p_method, null, p_notes, now());
  perform public._audit(p_company, 'refund_create', 'payments', pid, null,
    jsonb_build_object('sale_id', p_sale, 'amount_cents', p_amount));
  res := jsonb_build_object('payment_id', pid);
  return public._end_op(p_company, p_op, 'register_refund', res);
end $$;

create or replace function public.reverse_payment(p_company uuid, p_op uuid, p_payment uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; prev jsonb; pm public.payments%rowtype; res jsonb;
begin
  uid := public._require(p_company, true);
  prev := public._begin_op(p_company, p_op);
  if prev is not null then return prev; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Informe a justificativa do estorno.'; end if;
  perform 1 from public.sales s join public.payments x on x.sale_id = s.id
    where x.id = p_payment and s.company_id = p_company for update of s;
  select * into pm from public.payments where id = p_payment and company_id = p_company for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  if pm.reversed_at is not null then raise exception 'Este pagamento já foi estornado.'; end if;
  update public.payments set reversed_at = now(), reversed_by = uid, reversal_reason = trim(p_reason) where id = p_payment;
  perform public._audit(p_company, 'payment_reverse', 'payments', p_payment, to_jsonb(pm), jsonb_build_object('reason', p_reason));
  res := jsonb_build_object('payment_id', p_payment);
  return public._end_op(p_company, p_op, 'reverse_payment', res);
end $$;

-- ---------- indicadores ----------
create or replace function public.home_summary(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare tz text; m_start date; res jsonb;
begin
  perform public._require(p_company);
  select timezone into tz from public.companies where id = p_company;
  m_start := date_trunc('month', (now() at time zone tz))::date;
  select jsonb_build_object(
    'products',  (select count(*) from public.products where company_id = p_company and archived_at is null),
    'units',     (select coalesce(sum(quantity), 0) from public.products where company_id = p_company and archived_at is null),
    'low_stock', (select count(*) from public.products where company_id = p_company and archived_at is null and quantity <= min_stock),
    'pending_sales', (select count(*) from public.sales_summary where company_id = p_company and status in ('PENDENTE', 'ATRASADO')),
    'received_month', (select coalesce(sum(case when kind = 'refund' then -amount_cents else amount_cents end), 0)
                         from public.payments where company_id = p_company and reversed_at is null
                          and (received_at at time zone tz)::date >= m_start)
  ) into res;
  return res;
end $$;

-- Critérios (documentados no README):
--  vendido  = vendas NÃO canceladas com purchase_date no período
--  recebido = pagamentos não estornados com received_at (data local) no período, menos devoluções
--  pendente = saldo em aberto ATUAL das vendas do período (PENDENTE/ATRASADO)
--  ticket   = líquido / nº de vendas válidas
create or replace function public.balance_report(p_company uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare tz text; res jsonb;
begin
  perform public._require(p_company);
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Período inválido.'; end if;
  select timezone into tz from public.companies where id = p_company;

  with v as (
    select * from public.sales_summary
     where company_id = p_company and cancelled_at is null and purchase_date between p_from and p_to
  ),
  pay as (
    select (received_at at time zone tz)::date as d,
           case when kind = 'refund' then -amount_cents else amount_cents end as amt
      from public.payments
     where company_id = p_company and reversed_at is null
       and (received_at at time zone tz)::date between p_from and p_to
  ),
  days as (select generate_series(p_from, p_to, interval '1 day')::date as d)
  select jsonb_build_object(
    'gross_cents',    (select coalesce(sum(gross_cents), 0) from v),
    'discount_cents', (select coalesce(sum(discount_cents), 0) from v),
    'net_cents',      (select coalesce(sum(net_cents), 0) from v),
    'received_cents', (select coalesce(sum(amt), 0) from pay),
    'pending_cents',  (select coalesce(sum(balance_cents), 0) from v where status in ('PENDENTE', 'ATRASADO')),
    'sales_count',    (select count(*) from v),
    'paid_count',     (select count(*) from v where status = 'PAGO'),
    'pending_count',  (select count(*) from v where status = 'PENDENTE'),
    'late_count',     (select count(*) from v where status = 'ATRASADO'),
    'credit_count',   (select count(*) from v where status = 'CREDITO'),
    'avg_ticket_cents', (select case when count(*) = 0 then 0 else round(sum(net_cents)::numeric / count(*)) end from v),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'date', days.d,
                'sold_cents', (select coalesce(sum(net_cents), 0) from v where v.purchase_date = days.d),
                'received_cents', (select coalesce(sum(amt), 0) from pay where pay.d = days.d)) order by days.d), '[]'::jsonb) from days),
    'by_category', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                select si.category, sum(si.quantity * si.unit_price_cents)::int as gross_cents, sum(si.quantity)::int as units
                  from public.sale_items si join v on v.id = si.sale_id group by si.category order by 2 desc) x),
    'top_products', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                select si.product_name as name, si.brand, si.size, sum(si.quantity)::int as units,
                       sum(si.quantity * si.unit_price_cents)::int as gross_cents
                  from public.sale_items si join v on v.id = si.sale_id
                 group by si.product_name, si.brand, si.size order by units desc, gross_cents desc limit 8) x),
    'debtors', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                select customer_name, customer_phone, sum(balance_cents)::int as balance_cents, count(*)::int as sales
                  from public.sales_summary
                 where company_id = p_company and status in ('PENDENTE', 'ATRASADO')
                 group by customer_name, customer_phone order by 3 desc limit 8) x),
    'low_stock', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                select name, brand, size, quantity, min_stock, category from public.products
                 where company_id = p_company and archived_at is null and quantity <= min_stock
                 order by quantity, name limit 12) x)
  ) into res;
  return res;
end $$;

-- Somente usuários autenticados chamam as funções públicas.
revoke all on function public.bootstrap_company(text, text), public.add_member(uuid, text, public.app_role),
  public.list_members(uuid), public.remove_member(uuid, uuid), public.create_product(uuid, uuid, jsonb),
  public.add_stock(uuid, uuid, uuid, int, public.movement_type, text), public.create_sale(uuid, uuid, jsonb),
  public.update_sale(uuid, uuid, uuid, jsonb), public.cancel_sale(uuid, uuid, uuid, text),
  public.register_payment(uuid, uuid, uuid, int, public.payment_method, text, text, timestamptz),
  public.register_refund(uuid, uuid, uuid, int, public.payment_method, text),
  public.reverse_payment(uuid, uuid, uuid, text), public.home_summary(uuid), public.balance_report(uuid, date, date)
  from public, anon;
grant execute on function public.bootstrap_company(text, text), public.add_member(uuid, text, public.app_role),
  public.list_members(uuid), public.remove_member(uuid, uuid), public.create_product(uuid, uuid, jsonb),
  public.add_stock(uuid, uuid, uuid, int, public.movement_type, text), public.create_sale(uuid, uuid, jsonb),
  public.update_sale(uuid, uuid, uuid, jsonb), public.cancel_sale(uuid, uuid, uuid, text),
  public.register_payment(uuid, uuid, uuid, int, public.payment_method, text, text, timestamptz),
  public.register_refund(uuid, uuid, uuid, int, public.payment_method, text),
  public.reverse_payment(uuid, uuid, uuid, text), public.home_summary(uuid), public.balance_report(uuid, date, date)
  to authenticated;
