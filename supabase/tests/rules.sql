-- Visual Pimenta — testes de regras no banco (rodar no SQL Editor de um projeto DE TESTE, nunca em produção)
-- Pré-requisitos: migrações 001..005 aplicadas e 2 usuários criados em Authentication (A e B).
-- Substitua os dois UUIDs abaixo. O script roda tudo dentro de uma transação e termina com ROLLBACK.
begin;

do $$
declare
  ua uuid := '00000000-0000-0000-0000-00000000000a';   -- << UUID do usuário A (admin da empresa 1)
  ub uuid := '00000000-0000-0000-0000-00000000000b';   -- << UUID do usuário B (admin da empresa 2)
  c1 uuid; c2 uuid; pid uuid; r jsonb; sid uuid; q int; st text; ok boolean;
begin
  insert into companies (name) values ('Loja 1') returning id into c1;
  insert into companies (name) values ('Loja 2') returning id into c2;
  insert into company_members values (c1, ua, 'admin'), (c2, ub, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1) produto com 1 unidade
  r := create_product(c1, gen_random_uuid(), jsonb_build_object('category','masculino','name','Cueca boxer','brand','X','size','M','material','Algodão','price_cents',5000,'quantity',1));
  pid := (r->>'product_id')::uuid;

  -- 2) venda da única unidade
  r := create_sale(c1, gen_random_uuid(), jsonb_build_object('customer_name','Ana','customer_phone','27999990000','purchase_date',current_date,'due_date',current_date + 5,'discount_cents',0,'items',jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',1))));
  sid := (r->>'sale_id')::uuid;
  select quantity into q from products where id = pid; assert q = 0, 'estoque deveria ser 0';

  -- 3) segunda venda da mesma unidade deve falhar
  begin
    perform create_sale(c1, gen_random_uuid(), jsonb_build_object('customer_name','Bia','customer_phone','27999990001','purchase_date',current_date,'due_date',current_date,'items',jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',1))));
    assert false, 'deveria bloquear estoque insuficiente';
  exception when others then if sqlerrm like 'deveria%' then raise; end if; end;

  -- 4) idempotência: mesmo op_id não duplica
  declare op uuid := gen_random_uuid(); r1 jsonb; r2 jsonb; begin
    r1 := add_stock(c1, op, pid, 5, 'entrada_manual', 'teste');
    r2 := add_stock(c1, op, pid, 5, 'entrada_manual', 'teste');
    select quantity into q from products where id = pid; assert q = 5, 'add_stock duplicou';
  end;

  -- 5) editar venda de 1 para 3 retira só 2 a mais; reduzir devolve
  perform update_sale(c1, gen_random_uuid(), sid, jsonb_build_object('customer_name','Ana','customer_phone','27999990000','purchase_date',current_date,'due_date',current_date + 5,'discount_cents',0,'items',jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',3))));
  select quantity into q from products where id = pid; assert q = 3, 'após editar para 3 deveria sobrar 3';
  perform update_sale(c1, gen_random_uuid(), sid, jsonb_build_object('customer_name','Ana','customer_phone','27999990000','purchase_date',current_date,'due_date',current_date + 5,'discount_cents',0,'items',jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',2))));
  select quantity into q from products where id = pid; assert q = 4, 'após reduzir para 2 deveria sobrar 4';

  -- 6) pagamento parcial, depois total; excesso é bloqueado
  perform register_payment(c1, gen_random_uuid(), sid, 4000, 'pix');
  select status into st from sales_summary where id = sid; assert st in ('PENDENTE','ATRASADO'), 'parcial não quita';
  begin perform register_payment(c1, gen_random_uuid(), sid, 999999, 'pix'); assert false, 'deveria bloquear excesso';
  exception when others then if sqlerrm like 'deveria%' then raise; end if; end;
  perform register_payment(c1, gen_random_uuid(), sid, 6000, 'dinheiro');
  select status into st from sales_summary where id = sid; assert st = 'PAGO', 'deveria estar PAGO';

  -- 7) cancelar devolve o estoque uma única vez
  perform cancel_sale(c1, gen_random_uuid(), sid, 'teste');
  select quantity into q from products where id = pid; assert q = 6, 'cancelamento deveria devolver 2';
  begin perform cancel_sale(c1, gen_random_uuid(), sid, 'de novo'); assert false, 'deveria bloquear 2º cancelamento';
  exception when others then if sqlerrm like 'deveria%' then raise; end if; end;

  -- 8) quantity não pode ser alterado por UPDATE direto
  begin update products set quantity = 999 where id = pid; assert false, 'update direto deveria falhar';
  exception when others then if sqlerrm like 'update direto%' then raise; end if; end;

  -- 9) isolamento: usuário B não enxerga nem altera dados da empresa 1
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  select count(*) into q from products where company_id = c1; assert q = 0, 'B enxergou produtos da empresa 1';
  select count(*) into q from sales_summary where company_id = c1; assert q = 0, 'B enxergou vendas da empresa 1';
  begin perform add_stock(c1, gen_random_uuid(), pid, 1, 'entrada_manual', 'invasão'); assert false, 'B deveria ser negado';
  exception when others then if sqlerrm like 'B deveria%' then raise; end if; end;

  raise notice 'TODOS OS TESTES DE REGRAS PASSARAM';
end $$;

rollback;
