## Security hardening — current request

- Inspect every caller of the targeted server functions and read current schema/policies without modifying data.
- Enforce organization-scoped permissions, safe initial plans, verified invite identity, and employee cleanup on failures.
- Add only versioned migrations for atomic operations and demonstrably unsafe weekly-evaluation policies; do not apply them.
- Add automated regression tests using existing tooling, run tests/lint, and inspect automatic build results.
- Document migration dependencies and any unverified flows. No production deployment or database writes.

### Technical details
- Keep caller contracts compatible where safe; deny unsafe actions until required migrations are reviewed/applied separately.
- Use authenticated clients for authorization before privileged reads/writes.
- The previous plan below is historical context, not part of this implementation.

## Objetivo
Transformar o sistema em um SaaS comercializável: landing pública, pricing, checkout Stripe recorrente, trial de 14 dias com expiração, controle de limites por plano e gestão de assinatura self-service.

## Escopo

### 1. Landing pública + Pricing (SEO-ready)
- `/` (substitui o redirect atual) — hero, benefícios por módulo (RH, PDI, Entrevistas, Candidatos, Ponto, Relatórios, IA), prova social, CTA "Começar grátis 14 dias".
- `/precos` — 4 cards (Free, Starter, Pro, Enterprise) com módulos inclusos, limites e botão "Assinar" / "Falar com vendas" (Enterprise).
- `/recursos` — detalhamento dos módulos.
- `/contato` — formulário simples (grava em tabela `leads`).
- Cada rota com `head()` próprio (title/description/og) para SEO.
- App atual move para `/app` (renomear `_app` → mantém rotas filhas funcionando).

### 2. Trial de 14 dias com expiração
- Adicionar `trial_ends_at` em `orgs` (default `now() + 14 days` no `orgCreateFromCnpj`).
- Função `org_is_active(org_id)` que checa: `status='active'` OU `trial_ends_at > now()`.
- Banner global no header mostrando "X dias restantes do trial" quando aplicável.
- Bloqueio progressivo: nos últimos 3 dias mostra modal de upgrade; após expirar redireciona para `/app/billing`.

### 3. Stripe (seamless, sem chave do usuário)
- Habilitar via `enable_stripe_payments`.
- Criar 3 produtos no Stripe (Starter, Pro, Enterprise) com preço mensal e anual via `batch_create_product`.
- Server fns em `src/lib/billing.functions.ts`:
  - `createCheckoutSession({ plan_code, interval })` — gera sessão Stripe e retorna URL.
  - `createBillingPortalSession()` — abre portal de gestão (cancelar, trocar cartão, ver faturas).
  - `getSubscription(org_id)` — retorna assinatura ativa.
- Server route `src/routes/api/public/stripe-webhook.ts`:
  - Verifica assinatura HMAC do Stripe.
  - Eventos `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → atualizam `org_subscriptions`.

### 4. Schema novo
```sql
ALTER TABLE orgs ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days');

CREATE TABLE org_subscriptions (
  id uuid PK,
  org_id uuid UNIQUE NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_code plan_code NOT NULL,
  status text NOT NULL,  -- active, past_due, canceled, trialing
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  created_at, updated_at
);

CREATE TABLE leads (
  id uuid PK,
  name text, email text, phone text, company text, message text,
  created_at timestamptz
);
```
Com GRANTs e RLS (subscriptions: read por membros da org; leads: insert público, read RH-only).

### 5. Limites por plano (enforcement)
Definir em `PLAN_MODULES` (em `org.functions.ts`):
```
free:       { employees: 5,   branches: 1,  storage_mb: 100 }
starter:    { employees: 25,  branches: 3,  storage_mb: 1024 }
pro:        { employees: 100, branches: 10, storage_mb: 5120 }
enterprise: { employees: -1,  branches: -1, storage_mb: -1 }   -- ilimitado
```
- Helper `assertWithinLimit(org_id, resource)` chamado em:
  - `adminUpsertEmployee` (limite de colaboradores)
  - `ptUpsertBranch` (limite de filiais)
  - Upload de arquivos (storage)
- Mensagem: "Plano X permite até N. Faça upgrade para continuar."

### 6. Gestão de assinatura self-service
- Nova página `/app/billing` (admin-only):
  - Plano atual + status + próxima cobrança
  - Botão "Gerenciar pagamento" → portal Stripe
  - Tabela de uso vs limites (X/N colaboradores, etc.)
  - Botões "Upgrade" / "Downgrade" → checkout com `mode: subscription_update`
- Item "Faturamento" no sidebar (só para admin).

### 7. Ajustes em fluxos existentes
- `/onboarding` — após criar org, redireciona para `/app/me` (não vai mais para checkout direto; usuário aproveita os 14 dias).
- Sidebar: badge "Trial" no logo da empresa quando em trial.

## Detalhamento técnico

### Arquitetura de rotas
```
src/routes/
  index.tsx              ← landing pública (novo, SSR)
  precos.tsx             ← novo
  recursos.tsx           ← novo
  contato.tsx            ← novo
  login.tsx              ← mantém
  onboarding.tsx         ← mantém (criar org com trial)
  _authenticated/        ← gate de auth (renomear de _app)
    route.tsx
    me.*, admin.*, pt.*, billing.tsx  ← rotas existentes movidas
  api/public/
    stripe-webhook.ts    ← novo
    leads.ts             ← novo (POST do formulário)
```

### Migração de dados
- Orgs existentes recebem `trial_ends_at = now() + 14 days` (grace period).
- Plano `free` continua sem cobrança.

### Out of scope (próximas iterações)
- NF-e brasileira (adiado conforme combinado)
- Cupons de desconto
- Programa de afiliados
- Multi-currency (apenas BRL inicialmente)
- Faturamento por uso (apenas assinatura flat)

## Dependências
- `enable_stripe_payments` (cria conta Stripe gerenciada)
- Webhook secret será adicionado automaticamente após enable
- Sem novas npm dependencies (Stripe SDK injetado pela integração)

## Ordem de implementação
1. Migration (trial_ends_at, org_subscriptions, leads)
2. Habilitar Stripe + criar produtos
3. Reorganização de rotas (_app → _authenticated, criar páginas públicas)
4. Landing/Pricing/Recursos/Contato com SEO
5. billing.functions.ts + webhook
6. Página `/app/billing` + portal
7. Enforcement de limites + banner de trial
8. Testes manuais do fluxo signup → trial → checkout → ativo

## Estimativa
Implementação extensa (~12-15 arquivos novos, 5-6 editados). Recomendo executar em 2 fases:
- **Fase A** (esta iteração): itens 1-4 + estrutura do billing
- **Fase B** (próxima): webhook completo, portal, enforcement, refinamento

Posso começar a Fase A agora se aprovar.