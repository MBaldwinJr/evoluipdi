
# Ecossistema multiempresa unificado + planos por módulo

Hoje o sistema tem dois mundos paralelos: o Evolui original (RH/PDI/Entrevistas/Candidatos) é **monoempresa** (tabelas `employees`, `roles_catalog`, `departments`, `company_settings` sem `company_id`, RLS por `auth.uid()` e role global), e o módulo Ponto é **multiempresa** (tabelas `pt_*` com `company_id` + `pt_company_members`). Isso quebra a promessa de SaaS: cada cliente vê todos os colaboradores de todos os clientes no RH.

Este plano unifica os dois em um único tenant (`org`), com cadastro de empresa validado na Receita, entitlements por plano e migração dos dados existentes.

## 1. Modelo de tenancy único

Nova tabela `orgs` substitui logicamente `company_settings` e `pt_companies` como **fonte única de verdade da empresa**:

```text
orgs
  id, legal_name, trade_name, cnpj (unique), cnae_code, cnae_description,
  segment, status (active|trial|suspended), receita_validated_at,
  receita_payload jsonb, timezone, created_by, created_at, updated_at

org_members (substitui pt_company_members + user_roles global)
  id, org_id, user_id, role: admin|rh|gestor|supervisor|colaborador|auditor,
  unique(org_id, user_id, role)

org_plans
  id, org_id, plan_code (free|starter|pro|enterprise|custom),
  modules text[] (ex: ['rh','pdi','entrevistas','candidatos','ponto','relatorios']),
  limits jsonb (ex: {max_employees:50, max_branches:3}),
  valid_from, valid_to, active

org_module_entitlements (opcional, override fino por módulo)
  org_id, module_key, enabled, limits jsonb
```

Funções SECURITY DEFINER novas:
- `current_org_id()` — lê de `app.current_org` (setado via `set_config` por server fn na entrada da request) ou cai no único `org_member` do user.
- `has_org_role(_user, _org, _role[])`.
- `is_org_member(_user, _org)`.
- `org_has_module(_org, _module)` — usado em RLS para travar tabelas conforme plano.

## 2. Migração das tabelas existentes para multi-tenancy

Todas as tabelas de domínio recebem `org_id uuid not null` (com default temporário durante backfill) e novas policies:

- **Backfill**: cria 1 `org` "Default" usando dados de `company_settings` + 1 `org_members` admin para cada `user_roles.role='rh'`. Todas as linhas existentes de `employees`, `departments`, `roles_catalog`, `rcf_items`, `role_processes`, `interview_templates`, `interviews`, `interview_answers`, `evaluations`, `evaluation_scores`, `feedbacks`, `gaps`, `pdis`, `pdi_development_points`, `pdi_actions`, `checkins`, `learning_logs`, `candidate_invites` recebem esse `org_id`.
- **RLS reescrito**: substitui `has_role(auth.uid(),'rh')` por `has_org_role(auth.uid(), org_id, ARRAY['rh','admin'])` e `is_self_emp`/`is_manager_of_emp` por versões scoped no `org_id` da linha.
- **Ponto**: `pt_companies` vira view de compatibilidade sobre `orgs`; `pt_company_members` é deprecated em favor de `org_members` (mantém durante transição com trigger de sincronização). Tabelas `pt_branches`, `pt_employees`, etc. passam a referenciar `org_id` direto.
- **Unificação de colaboradores**: `pt_employees` e `employees` ficam unificadas em **uma** tabela `employees` com `org_id`. Campos do ponto (`weekly_hours`, `schedule_id`, `branch_id`, `contract_type`, `cpf`, `registration`) entram em `employees`. Punches/escalas continuam em tabelas próprias mas referenciam `employees.id`.

> Cuidado: `employees` hoje exige `user_id NOT NULL`. Vamos relaxar para `user_id NULL` (colaborador pode existir antes de ter login), igual ao Ponto faz.

## 3. Validação na Receita Federal

Server fn `validateCnpj` em `src/lib/org.functions.ts`:

- Chama BrasilAPI público (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`) — não exige API key. Fallback secundário ReceitaWS.
- Normaliza CNPJ (só dígitos), valida DV.
- Retorna `{ legal_name, trade_name, cnae_code, cnae_description, status, address, opening_date }` e persiste em `orgs.receita_payload` + `receita_validated_at`.
- Bloqueia criação de org com CNPJ duplicado.

Já existe `src/lib/cnpj.functions.ts` — reaproveitar/expandir.

## 4. Onboarding & seleção de org

- Rota nova `/onboarding`: usuário sem nenhuma `org_members` cai aqui. Form: CNPJ → valida na Receita → confirma dados → cria `orgs` + `org_members(admin)` + plano `trial`.
- Componente global `<OrgSwitcher>` no topo do `_app` (header), sincroniza `localStorage.active_org` + cookie `org_id` (lido por server fns).
- Hook `useActiveOrg()` substitui `usePtCompany()`. Toda server fn passa a aceitar/inferir `org_id`.
- Guard no `_app.tsx`: se sem orgs → redirect para `/onboarding`.

## 5. Entitlements por plano (liberação por módulo)

- Constante `MODULES = ['rh','pdi','entrevistas','candidatos','ponto','relatorios','jornada-avancada','ia-assistente']`.
- Sidebar e rotas consultam `useEntitlements()` que chama `getOrgEntitlements()` (server fn). Itens fora do plano ficam ocultos ou com badge "Upgrade".
- Rota `/admin/billing` (admin only): mostra plano atual, módulos ativos, botão de upgrade (sem gateway de pagamento agora — apenas registro).
- Server fns checam `org_has_module(org_id, 'ponto')` antes de operar e retornam 403 amigável.
- RLS adicional em tabelas-chave: `USING (... AND org_has_module(org_id, 'ponto'))` para travar dados também no banco.

## 6. UI por módulo

- **Sidebar**: passa a renderizar grupos dinamicamente conforme entitlements + role. `OrgSwitcher` no header.
- **RH (`/admin/*`)**: já existe, recebe `org_id` filter via context. Sem grandes mudanças visuais; só a RLS muda.
- **Ponto (`/pt/*`)**: remove seletor de empresa próprio (passa a usar o global). Remove `PtCompanyProvider`.
- **Configurações** (`/admin/settings`): aba "Empresa" passa a editar `orgs` (com revalidação Receita), aba "Plano & Módulos", aba "Administradores" (CRUD `org_members` admin/rh).
- **Candidatos contratados → colaborador**: ao "contratar" cria `employees` com `org_id` ativo (já existe fluxo, só passa a respeitar o tenant).

## 7. Migração de dados (script idempotente)

Migration SQL faz nesta ordem:

1. Cria `orgs`, `org_members`, `org_plans`, `org_module_entitlements` + GRANTs + RLS + helpers.
2. Insere 1 `org` "Default" copiando de `company_settings` (ou placeholder se vazio).
3. Insere `org_members` para cada `user_roles` (mapeia `rh→rh+admin`, `gestor→gestor`, `colaborador→colaborador`).
4. `ALTER TABLE ... ADD COLUMN org_id` em todas as tabelas de domínio com default temporário = id da org Default; depois `SET NOT NULL` e remove default.
5. Funde `pt_employees` em `employees` (insere as linhas que ainda não existem, casa por `cpf`/`user_id`). Atualiza FKs em `pt_punches`, `pt_schedules`, etc.
6. Reescreve todas as policies RLS antigas para usar `has_org_role(auth.uid(), org_id, ...)`.
7. Cria view `pt_companies` apontando para `orgs` (compat com código atual durante deploy).

## 8. Fora de escopo desta iteração

- Gateway de pagamento real (Stripe) para upgrade de plano.
- Auto-provisionamento de subdomínio por org.
- Convites por e-mail (vai por link/CPF como já existe).
- Auditoria global unificada (hoje só `pt_audit_log`).

## 9. Estimativa

3 iterações grandes:

1. **Esta**: migration + helpers + onboarding + OrgSwitcher + entitlements + sidebar dinâmica + ajuste das telas do Ponto para usar org global. RH continua funcionando (RLS via org Default).
2. Reescrita das policies RH para multi-tenant real + unificação `employees` ↔ `pt_employees` + tela de billing.
3. Telas refinadas de Plano, Administradores, Auditoria unificada, validações de limite (max_employees etc.).

---

## Perguntas antes de executar

1. **Validação Receita**: posso usar **BrasilAPI** (público, sem chave)? Senão você prefere ReceitaWS pago / outro provedor?
2. **Org Default no backfill**: quero criar a org com **seu CNPJ** (você me dá) ou só "Empresa Default — atualizar depois"? Sem isso a primeira org fica com dados placeholder.
3. **Planos iniciais**: confirma estes 4 planos? `free` (RH básico), `starter` (RH+PDI+Entrevistas), `pro` (+ Ponto + Candidatos), `enterprise` (tudo + IA avançada).
4. **Compat Ponto**: posso deletar `pt_companies`/`pt_company_members` (substituídas por `orgs`/`org_members`) já nesta migration, ou prefere manter como view por 1 release para segurança?
