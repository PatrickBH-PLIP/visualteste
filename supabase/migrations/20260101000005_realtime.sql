-- Visual Pimenta — 005 Realtime
-- postgres_changes respeita RLS: cada usuário só recebe eventos de linhas que pode ler (isolamento por empresa).
do $$
declare t text;
begin
  foreach t in array array['products', 'sales', 'sale_items', 'payments', 'inventory_movements'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
