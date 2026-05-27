# Módulo Ponto — MVP enterprise dentro do Evolui

Novo módulo "Ponto" acessível por uma nova seção no menu lateral, com tenancy próprio (multiempresa/multifilial), motor de jornada por escala, registro web/PWA com GPS + selfie + geofence, banco de horas, aprovações, dashboards e IA (detecção de anomalias + assistente).

> Escopo: **só o módulo de Ponto é multiempresa**. As tabelas existentes do Evolui (employees, pdis, evaluations…) permanecem monoempresa nesta fase. Uma fase 2 unifica.

## 1. Modelo de dados (nova migration)

Novas tabelas (todas com `company_id`, RLS por empresa + papel):

- `pt_companies` — empresas/tenants do módulo. (RH global cria; vincula a `auth.users` via `pt_company_members`).
- `pt_company_members(user_id, company_id, role)` — papéis: `admin`, `rh`, `gestor`, `supervisor`, `funcionario`, `auditor`. Único por (user, company).
- `pt_branches(company_id, name, address, lat, lng, geofence_radius_m)` — filiais com cerca virtual.
- `pt_departments(company_id, branch_id, name)`.
- `pt_employees(company_id, branch_id, department_id, user_id?, full_name, cpf, registration, role_title, hire_date, contract_type, weekly_hours, schedule_id, manager_id, active)` — pode existir sem `auth.users` (RH convida depois).
- `pt_schedules(company_id, name, kind: fixa|5x2|6x1|12x36|flex, weekly_pattern jsonb, tolerance_min, night_shift_start, night_shift_end, interjornada_min, intrajornada_min)` — regras configuráveis por escala.
- `pt_schedule_assignments(employee_id, schedule_id, valid_from, valid_to)` — histórico de jornada.
- `pt_holidays(company_id|branch_id, date, name)`.
- `pt_punches(company_id, employee_id, ts, kind: entrada|saida|inicio_intervalo|fim_intervalo, source: web|pwa|adjustment, lat, lng, accuracy_m, inside_geofence, branch_id, selfie_path, device_info jsonb, ip, status: ok|pendente|ajustada|rejeitada, anomaly_flags text[])`.
- `pt_punch_adjustments(punch_id?, employee_id, requested_ts, requested_kind, reason, attachment_path, status, approver_id, decided_at, decision_notes)`.
- `pt_justifications(employee_id, date_from, date_to, type: atestado|folga|ferias|outro, reason, attachment_path, status, approver_id)`.
- `pt_day_summary(employee_id, work_date, worked_min, expected_min, late_min, extra_min_50, extra_min_100, night_min, balance_min, computed_at)` — fechamento diário (gerado pelo motor).
- `pt_bank_hours(employee_id, period_start, period_end, opening_min, accrued_min, used_min, expires_at, balance_min)`.
- `pt_approvals(target_type: ajuste|justificativa|hora_extra, target_id, level, approver_role, approver_id, status, decided_at)`.
- `pt_audit_log(company_id, actor_id, action, target_table, target_id, before jsonb, after jsonb, ip, ua, ts)` — append-only, sem UPDATE/DELETE.
- `pt_anomalies(punch_id, kind, severity, details jsonb, resolved)` — saída da IA.
- `pt_assistant_threads(user_id, company_id, title)` + `pt_assistant_messages(thread_id, role, parts jsonb)`.

Bucket Storage: `pt-selfies` (privado) e `pt-attachments` (privado), policies escopadas a `{company_id}/{employee_id}/...`.

Funções SECURITY DEFINER:
- `pt_has_role(_user, _company, _role app_role_pt) → bool`
- `pt_is_member(_user, _company) → bool`
- `pt_can_manage_employee(_user, _employee_id)` (RH da empresa ou gestor na linha hierárquica).

RLS padrão de todas as tabelas `pt_*`: leitura exige `pt_is_member`; escrita exige role apropriado; `pt_audit_log` só INSERT por trigger.

## 2. Motor de jornada (`src/lib/pt-engine.server.ts`)

Funções puras testáveis:
- `computeDay({ punches, schedule, holidays, date }) → DaySummary` — calcula trabalhado, esperado, atrasos, h.extras 50%/100%, adicional noturno, saldo banco horas, conflitos (interjornada/intrajornada).
- Suporte a turnos cruzando meia-noite, 12x36, escalas semanais via `weekly_pattern`.
- `recomputeEmployee(employeeId, range)` — server fn que regrava `pt_day_summary` e atualiza `pt_bank_hours`.
- Gatilho: após inserir/alterar punch ou justificativa, enfileira recomputação do dia.

## 3. Server functions (`src/lib/pt-*.functions.ts`)

Todas com `requireSupabaseAuth` + verificação de membership/role:
- `ptCreateCompany`, `ptInviteMember`, `ptSetRole`.
- `ptListBranches/Departments/Employees`, `ptUpsertEmployee`, `ptAssignSchedule`.
- `ptCreateSchedule/Holiday`.
- `ptRegisterPunch({ kind, lat, lng, accuracy, selfieBase64 })` — valida geofence, salva selfie no Storage, grava punch, retorna confirmação.
- `ptRequestAdjustment`, `ptDecideApproval`.
- `ptSubmitJustification`.
- `ptGetMyMirror(month)` — espelho de ponto do colaborador.
- `ptGetTeamSnapshot(branchId)` — painel operacional.
- `ptGetDashboardKpis(filters)`.
- `ptRunAnomalyScan(date)` — chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com lote de punches do dia, retorna `pt_anomalies` (selfie igual sequência, punch fora de cerca, sequência impossível, excesso de extras).
- `ptAssistantTools` — tools AI SDK: `query_attendance`, `list_late_today`, `summarize_extras(period, scope)`, `who_is_working_now`. Servidas via rota `/api/pt/chat` com `streamText` + `useChat`.

## 4. Front-end

Novo grupo no `app-sidebar.tsx`: "Ponto" (visível só para membros de pelo menos uma `pt_company`). Switcher de empresa no topo (persistido em `localStorage` + query param).

Rotas (`src/routes/_app.pt.*`):
- `_app.pt.tsx` — layout com guard de membership e seleção de empresa ativa.
- `_app.pt.index.tsx` — **Bater ponto** (botão grande, captura GPS, abre câmera para selfie, mostra status da cerca, últimas 4 batidas do dia).
- `_app.pt.espelho.tsx` — espelho mensal do próprio colaborador.
- `_app.pt.equipe.tsx` — para gestor/supervisor: lista da equipe, status agora, atrasos, mapa.
- `_app.pt.aprovacoes.tsx` — fila de ajustes/justificativas/extras pendentes.
- `_app.pt.banco-horas.tsx` — saldos e movimentações.
- `_app.pt.escalas.tsx` — calendário (drag-and-drop simples) + CRUD de `pt_schedules` e atribuições.
- `_app.pt.funcionarios.tsx` — CRUD de funcionários do ponto.
- `_app.pt.filiais.tsx` — filiais + cerca virtual (mapa com raio editável).
- `_app.pt.dashboard.tsx` — KPIs (atrasos, absenteísmo, extras, online agora, anomalias).
- `_app.pt.auditoria.tsx` — visualização de `pt_audit_log` filtrável.
- `_app.pt.config.tsx` — regras da empresa, feriados, papéis.
- `_app.pt.assistente.tsx` — chat com `useChat` apontando para `/api/pt/chat`.

Componentes-chave: `PunchButton`, `SelfieCapture` (MediaDevices API), `GeofenceStatus`, `MirrorTable`, `ApprovalCard`, `BranchMap` (Google Maps via connector — se o usuário aceitar conectar).

## 5. PWA leve (sem service worker)

Só manifesto + `display: standalone` + ícones, para permitir "Adicionar à tela inicial" no celular. **Sem** offline real no MVP — bater ponto exige conectividade (caso contrário, complica auditoria). Modo "fila offline" fica como melhoria.

## 6. IA

- **Detecção de anomalias**: server fn agendável que processa o dia anterior. Sinaliza em `pt_anomalies` e aparece em badge no dashboard.
- **Assistente**: rota `/api/pt/chat` (AI SDK + Lovable AI Gateway), `streamText` + tools que leem `pt_*` filtrando por `company_id` do usuário e por papel. Histórico em `pt_assistant_threads`.

## 7. Segurança / LGPD

- RLS em todas as tabelas `pt_*` escopadas por `company_id` + papel.
- Audit log imutável (trigger bloqueia UPDATE/DELETE).
- Selfies e anexos privados com URLs assinadas (5 min).
- Validação Zod em todos inputs.
- Trigger registra IP/UA via `current_setting` quando disponível; demais campos via server fn.

## 8. Fora de escopo nesta fase

Mobile nativo (Flutter/RN), biometria/REP/face liveness real, integração folha/ERP, WhatsApp/SMS, gamificação, workflow builder visual, multi-tenancy do resto do Evolui, RabbitMQ/Redis/K8s. Tudo isso vira backlog.

---

## Detalhes técnicos

- Stack mantida: TanStack Start + React 19 + Tailwind v4 + Supabase (Lovable Cloud) + AI SDK + Lovable AI Gateway. Sem NestJS/Prisma/Docker/Redis/RabbitMQ.
- Selfies enviadas como base64 → server fn → `supabaseAdmin.storage.from('pt-selfies').upload(...)`. Limite 1 MB, jpeg.
- Geofence: cálculo Haversine no server, raio configurável por filial; punch fora marca `inside_geofence=false` e gera anomalia, mas **não bloqueia** (configurável por empresa).
- Mapas: usar conector Google Maps já documentado (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`); se ausente, cair para SVG/CSS no painel operacional. Pergunto antes de conectar.
- Chat com `useChat` + `DefaultChatTransport({ api: "/api/pt/chat" })`, threads persistidas, mensagens DB-backed.
- `attachSupabaseAuth` já registrado em `src/start.ts` — manter.
- Migration única (módulo isolado), com GRANTs corretos por tabela e policies RLS.
- Estimativa: **2–3 iterações grandes** para chegar ao MVP completo. Esta primeira iteração entrega: migrations + bater ponto + espelho + funcionários + filiais + escala fixa simples + dashboard mínimo. Iterações seguintes: aprovações, banco de horas avançado, IA, escalas complexas, auditoria UI.

## Perguntas

1. **Google Maps**: posso pedir para você conectar o connector Google Maps agora (para o mapa de filiais e painel operacional)? Sem ele, uso visualização simplificada.
2. **Primeira empresa**: você quer que eu pré-cadastre uma empresa de ponto vinculada ao seu usuário como admin no seed, ou prefere criar pela UI?
3. **Bloquear punch fora da cerca?** Padrão sugerido: registra mas marca como anomalia (não bloqueia). Confirma?
