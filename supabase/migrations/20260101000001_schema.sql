-- Visual Pimenta — 001 Esquema
-- Valores monetários SEMPRE em centavos (integer). Datas de venda em 'date' (data local da loja).

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'staff');
create type public.product_category as enum ('feminino', 'masculino', 'lingerie', 'sex_shop');
create type public.payment_method as enum ('pix', 'dinheiro', 'debito', 'credito', 'transferencia', 'outra');
create type public.movement_type as enum
  ('estoque_inicial', 'entrada_manual', 'devolucao', 'ajuste', 'venda', 'edicao_venda', 'cancelamento_venda');

create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  timezone   text not null default 'America/Sao_Paulo',
  sale_seq   bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  category    public.product_category not null,
  name        text not null check (length(trim(name)) > 0),
  brand       text not null check (length(trim(brand)) > 0),
  size        text not null check (size in ('P','M','G','GG','EXG','G2','G3','G4','G5','Único')),
  material    text not null check (length(trim(material)) > 0),
  price_cents integer not null check (price_cents >= 0),
  cost_cents  integer check (cost_cents >= 0),
  quantity    integer not null default 0 check (quantity >= 0),   -- nunca negativo
  min_stock   integer not null default 0 check (min_stock >= 0),
  sku         text,
  barcode     text,
  supplier    text,
  description text,
  notes       text,
  image_path  text,                       -- caminho no bucket product-images
  archived_at timestamptz,                -- exclusão lógica
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Mesmo nome+marca em tamanhos diferentes = produtos (linhas) diferentes, controlados separadamente.
create unique index products_identity_uq on public.products
  (company_id, category, lower(name), lower(brand), size) where archived_at is null;
create unique index products_sku_uq on public.products (company_id, lower(sku))
  where sku is not null and archived_at is null;
create index products_list_idx on public.products (company_id, category, archived_at);

create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  sale_number    bigint not null,
  customer_name  text not null check (length(trim(customer_name)) > 0),
  customer_phone text not null,
  purchase_date  date not null,
  due_date       date not null,
  gross_cents    integer not null default 0 check (gross_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  net_cents      integer not null default 0 check (net_cents >= 0),
  notes          text,
  cancelled_at   timestamptz,
  cancelled_by   uuid references auth.users (id),
  cancel_reason  text,
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, sale_number),
  check (discount_cents <= gross_cents),
  check (net_cents = gross_cents - discount_cents)
);
create index sales_company_date_idx on public.sales (company_id, purchase_date desc);
create index sales_company_customer_idx on public.sales (company_id, lower(customer_name));

create table public.sale_items (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  sale_id          uuid not null references public.sales (id) on delete cascade,
  product_id       uuid not null references public.products (id),
  quantity         integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),   -- preço histórico
  -- snapshot para preservar o histórico mesmo que o produto seja editado depois
  product_name     text not null,
  brand            text not null,
  size             text not null,
  category         public.product_category not null,
  unique (sale_id, product_id)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_company_idx on public.sale_items (company_id);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  sale_id         uuid not null references public.sales (id) on delete cascade,
  kind            text not null default 'payment' check (kind in ('payment', 'refund')),
  amount_cents    integer not null check (amount_cents > 0),
  method          public.payment_method not null,
  reference       text,
  notes           text,
  received_at     timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  -- estorno controlado: o registro nunca é apagado
  reversed_at     timestamptz,
  reversed_by     uuid references auth.users (id),
  reversal_reason text,
  check ((reversed_at is null) = (reversal_reason is null))
);
create index payments_sale_idx on public.payments (sale_id);
create index payments_company_received_idx on public.payments (company_id, received_at desc);

create table public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  product_id      uuid not null references public.products (id),
  type            public.movement_type not null,
  quantity_delta  integer not null check (quantity_delta <> 0),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after  integer not null check (quantity_after >= 0),
  reason          text,
  sale_id         uuid references public.sales (id),
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  check (quantity_after = quantity_before + quantity_delta)
);
create index movements_product_idx on public.inventory_movements (product_id, created_at desc);
create index movements_company_idx on public.inventory_movements (company_id, created_at desc);

create table public.audit_logs (
  id         bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid references auth.users (id),
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index audit_company_idx on public.audit_logs (company_id, created_at desc);

-- Idempotência: cada operação sensível recebe um op_id gerado no cliente.
-- Reenviar o mesmo op_id (clique duplo, retry após queda de rede) devolve o resultado original.
create table public.operations (
  company_id uuid not null references public.companies (id) on delete cascade,
  op_id      uuid not null,
  kind       text not null,
  result     jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (company_id, op_id)
);

-- Visão calculada: valor pago, saldo e STATUS vêm do banco (nunca de uma caixa marcada na tela).
create view public.sales_summary with (security_invoker = true) as
select
  s.*,
  coalesce(p.paid, 0)::integer                       as paid_cents,
  (s.net_cents - coalesce(p.paid, 0))::integer       as balance_cents,
  case
    when s.cancelled_at is not null                              then 'CANCELADA'
    when s.net_cents - coalesce(p.paid, 0) = 0                   then 'PAGO'
    when s.net_cents - coalesce(p.paid, 0) < 0                   then 'CREDITO'
    when s.due_date < (now() at time zone c.timezone)::date      then 'ATRASADO'
    else 'PENDENTE'
  end as status
from public.sales s
join public.companies c on c.id = s.company_id
left join lateral (
  select sum(case when pm.kind = 'refund' then -pm.amount_cents else pm.amount_cents end) as paid
  from public.payments pm
  where pm.sale_id = s.id and pm.reversed_at is null
) p on true;
