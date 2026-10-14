# Visual Pimenta — Gestão de estoque, vendas, pagamentos e balanço

Sistema web (React + TypeScript + Vite + Tailwind) com banco central no **Supabase** (PostgreSQL, Auth, Storage, Realtime, RLS), pronto para publicar no **GitHub** e na **Vercel**.

* **Home**: 4 categorias (Feminino, Masculino, Lingerie, Sex shop) e resumo do estoque.
* **Estoque** por categoria: busca, filtros, ordenação, cards/tabela, cadastro/edição com **upload de foto direto pelo site**, "Adicionar ao estoque" com histórico.
* **Vendas**: nova venda (categoria → produto → tamanho → quantidade), desconto, pagamento parcial/total, edição com ajuste automático de estoque, cancelamento, histórico, envio por WhatsApp/PDF.
* **Balanço**: período (hoje, 7/30 dias, mês atual/anterior, personalizado), cards, gráficos, extrato com CSV/PDF.
* **Tempo real**: vários aparelhos ao mesmo tempo, indicador Conectado / Sincronizando / Reconectando / Offline.

> Os valores e o estoque são calculados **no banco** (funções transacionais). O navegador só exibe e envia pedidos.

---

## A. Preparar o computador

1. Instale o **Node.js LTS** (20 ou 22): https://nodejs.org
2. Extraia `visual-pimenta.zip` e abra a pasta no **VS Code**.
3. No terminal do VS Code:
   ```bash
   npm install
   cp .env.example .env      # no Windows (PowerShell): copy .env.example .env
   ```
4. Preencha o `.env` (passo B.2). **Nunca** use a chave `service_role`.

## B. Configurar o Supabase

1. **Criar o projeto** em https://supabase.com → *New project* (anote a senha do banco em local seguro; ela não vai no código).
2. **Chaves**: *Project Settings → API*. Copie a **Project URL** e a chave **anon / publishable** para o `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. **Executar as migrações** — *SQL Editor → New query*, cole e execute **nesta ordem**, um arquivo por vez:
   1. `supabase/migrations/20260101000001_schema.sql` (tabelas, índices, visão de status)
   2. `supabase/migrations/20260101000002_helpers_rls.sql` (RLS e permissões)
   3. `supabase/migrations/20260101000003_functions.sql` (vendas, estoque, pagamentos, balanço)
   4. `supabase/migrations/20260101000004_storage.sql` (bucket privado `product-images` e políticas)
   5. `supabase/migrations/20260101000005_realtime.sql` (publicação Realtime)

   (Alternativa: Supabase CLI — `npx supabase link --project-ref <ref>` e `npx supabase db push`.)
4. **Autenticação**: *Authentication → Providers → Email* habilitado. Em *Authentication → Sign In / Providers* **desative "Allow new users to sign up"** depois de criar seus usuários — assim ninguém se cadastra sozinho.
5. **Criar o primeiro administrador (sem senha embutida no código)**:
   1. *Authentication → Users → Add user → Create new user*: seu e-mail e uma senha forte (marque *Auto Confirm User*).
   2. Rode o sistema (`npm run dev`), entre com esse usuário: aparece **Configuração inicial**. Informe o nome da loja. O banco só aceita **o primeiro** cadastro; você vira administrador.
   3. Para a equipe: crie cada usuário em *Authentication → Users* e, no sistema, vá em **Configurações → Equipe → Conceder acesso** (perfil *Equipe* ou *Administrador*).
6. **Storage**: o bucket `product-images` é criado pela migração 4 (privado, até 5 MB, JPG/PNG/WebP). Fotos são exibidas por URL assinada. Não é preciso abrir o painel do Supabase para cadastrar fotos.
7. **Testar a conexão**: `npm run dev` → http://localhost:5173 → entrar → cadastrar um produto com foto.

### Perfis
| Ação | Equipe | Administrador |
|---|:-:|:-:|
| Ver, cadastrar, editar produtos, entrada de estoque, vendas, pagamentos | ✔ | ✔ |
| Ajuste de estoque "autorizado", cancelar venda, estornar pagamento, arquivar produto, gerenciar equipe | — | ✔ |

## C. Publicar no GitHub

```bash
git init
git add .
git commit -m "Visual Pimenta - versão inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/visual-pimenta.git
git push -u origin main
```
O `.gitignore` já exclui `node_modules`, `dist` e `.env`. Confira com `git status` que **`.env` não aparece** antes do commit.

## D. Publicar na Vercel

1. https://vercel.com → *Add New → Project* → importe o repositório.
2. Framework: **Vite** (detectado). Build: `npm run build`. Output: `dist` (já definidos em `vercel.json`, que também faz o redirecionamento SPA).
3. *Environment Variables*: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesmos valores do `.env`).
4. *Deploy*. Depois, no Supabase em *Authentication → URL Configuration*, coloque o endereço da Vercel em **Site URL**.
5. Teste em dois aparelhos (celular e computador) logados ao mesmo tempo.

## E. Manutenção

* **Atualizar**: edite, `git add . && git commit -m "..." && git push` — a Vercel publica sozinha.
* **Novas migrações**: crie `supabase/migrations/AAAAMMDDHHMMSS_descricao.sql` e execute no SQL Editor (ou `npx supabase db push`). Nunca edite migrações já aplicadas.
* **Backup**: *Supabase → Database → Backups* (planos pagos têm backups diários). Manual: `pg_dump "postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres" > backup.sql`. Fotos: baixe o bucket em *Storage*.
* **Restaurar**: em um projeto vazio, rode as migrações e depois `psql ... < backup.sql` (somente dados, se preferir `--data-only`).
* **Erros**: Vercel → *Deployments → Logs*; Supabase → *Logs* (API, Postgres, Storage, Realtime); console do navegador (F12).
* **Comandos**: `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`.

---

## Regras de negócio (no banco)

* Estoque **nunca negativo** (`CHECK` + validação nas funções). `products.quantity` não pode ser alterada por UPDATE direto (coluna sem permissão + gatilho).
* **Venda**: `create_sale` trava os produtos (`FOR UPDATE`, em ordem de id), confere estoque e grava venda, itens, baixa e movimentações **numa única transação**. Duas vendas da última unidade: só uma passa.
* **Edição**: `update_sale` calcula apenas a **diferença** por produto (2→3 retira 1; 3→2 devolve 1; item removido devolve tudo). Preço histórico do item é mantido; item novo usa o preço atual.
* **Cancelamento**: devolve o estoque **uma só vez**, guarda motivo, preserva venda e pagamentos. Não há exclusão física.
* **Pagamentos**: vários por venda; excesso sobre o saldo é bloqueado. **Estorno** exige justificativa e mantém o registro. Se uma edição baixa o total abaixo do já pago, a venda vira **A DEVOLVER** e o usuário registra a devolução (ação explícita).
* **Status calculado no banco** (`sales_summary`): PAGO (saldo 0), PENDENTE (saldo > 0 e prazo não vencido), ATRASADO (saldo > 0 e prazo vencido), além de A DEVOLVER e CANCELADA. A data de hoje usa o fuso da loja (`America/Sao_Paulo`).
* **Idempotência**: toda operação sensível leva um `op_id`; repetir (duplo clique, reconexão) devolve o resultado original sem repetir baixa, venda ou pagamento.
* **Auditoria**: `inventory_movements` (antes/depois, motivo, usuário) e `audit_logs` (antes/depois, visível para administradores).
* Dinheiro em **centavos inteiros**.

### Critérios do Balanço
* **Vendido** = vendas não canceladas com data da compra no período (bruto, desconto, líquido).
* **Recebido** = pagamentos não estornados com data de recebimento no período, menos devoluções (inclui vendas de períodos anteriores).
* **Saldo pendente** = saldo em aberto **hoje** das vendas do período (PENDENTE/ATRASADO).
* **Ticket médio** = líquido ÷ vendas válidas do período. Vendas por categoria usam o valor bruto dos itens (o desconto é da venda, não do item).
* "Clientes com maior saldo" considera todas as vendas em aberto.

## Segurança
* RLS ativo em todas as tabelas; `anon` sem acesso; `authenticated` só lê o que é da própria empresa; escritas sensíveis só por funções que checam a associação à empresa.
* Realtime (`postgres_changes`) respeita RLS: cada usuário só recebe eventos da sua empresa.
* Bucket privado; políticas por pasta `<company_id>/…`.
* Só chaves públicas no navegador; `service_role` nunca é usada.

## Fotos
* Upload no próprio formulário (galeria do celular ou arquivos do computador), prévia, trocar/remover. A imagem é reduzida (máx. 1280 px, WebP) antes do envio.
* A foto antiga só é apagada **depois** que o banco aponta para a nova; se o salvamento falha, a foto recém-enviada é removida (sem órfãs).
* Fotos das **categorias da Home**: coloque seus arquivos em `public/assets/categories/feminino.jpg`, `masculino.jpg`, `lingerie.jpg`, `sex-shop.jpg` (sem imagens de terceiros no projeto). Sem arquivo, aparece um quadro neutro.

## Cores
Paleta oficial aplicada. Para o **texto pequeno** sobre o bege `#ede8df`, `#00a8ff` e `#ff746c` não têm contraste suficiente; nesses textos usamos versões mais escuras do mesmo tom (`#00699c`, `#b8332b`), mantendo as cores oficiais em botões, selos e destaques (`src/lib/categories.ts`).

## Testes
* `npm test` (Vitest): dinheiro, datas/períodos, mensagem de WhatsApp, CSV.
* `supabase/tests/rules.sql`: testes das regras críticas **no banco** (última unidade, idempotência, edição 1→3→2, pagamento parcial/total/excesso, cancelamento sem estorno duplo, bloqueio de UPDATE direto, isolamento entre empresas). Rode no SQL Editor de um projeto **de teste**; termina com `ROLLBACK`.

## Estrutura
```
src/components  src/pages  src/hooks  src/services  src/lib  src/types  src/utils  src/styles
supabase/migrations  supabase/tests  supabase/seed.sql
tests/  public/assets/logo.jpg
```
