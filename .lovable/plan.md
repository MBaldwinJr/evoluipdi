
## Objetivo

Três frentes integradas no mesmo ecossistema multi-tenant (org_id):

1. **Ponto = Colaboradores** — eliminar cadastro duplicado em `pt_employees`. Todo funcionário do módulo Ponto passa a ser um registro de `employees` da organização ativa, com campos específicos do Ponto (filial, escala, jornada semanal, matrícula, CPF) anexados ao mesmo registro.
2. **Organograma editável** em RH › Colaboradores — visualização hierárquica (manager_id) com drag-and-drop para reassociar gestor, criar/editar nó inline, expandir/recolher.
3. **Fluxograma por processo** em RH › Processos por cargo — cada `role_processes` ganha um diagrama de etapas (nós + conexões) editável, com layout profissional e exportável.

---

## 1. Unificar Funcionários do Ponto com Colaboradores

### Banco
- Adicionar a `employees` os campos que hoje vivem em `pt_employees`:
  - `cpf text`, `registration text`, `branch_id uuid` (→ pt_branches), `schedule_id uuid` (→ pt_schedules), `weekly_hours numeric default 44`, `contract_type text default 'CLT'`.
- Migrar dados existentes de `pt_employees` para `employees` (match por `user_id` + `org_id`; quando não houver, criar `employees` correspondente).
- Substituir FKs de `pt_punches.employee_id`, `pt_anomalies.employee_id` para apontarem para `employees.id`.
- Manter `pt_employees` como **view** somente-leitura sobre `employees` (compatibilidade temporária) ou remover após migração das funções.
- Trigger: ao inserir em `org_members` com role colaborador/gestor/rh/admin, garantir registro em `employees` (já existe sync parcial; estender para preencher defaults do Ponto).

### Server functions
- Atualizar `pt.functions.ts`:
  - `ptListEmployees` → consulta `employees` + join `profiles` (nome) + `pt_branches` + `pt_schedules`, filtrado por `org_id` ativo.
  - `ptUpsertEmployee` → grava em `employees` (campos do ponto) em vez de `pt_employees`.
  - `ptGetMirror`, `ptPunch` etc → resolver employee via `employees.user_id = auth.uid()`.
- Remover tela "Funcionários" duplicada do Ponto ou transformá-la em **visão filtrada** de Colaboradores com edição apenas dos campos do Ponto (filial, escala, horas).

### UI
- `/pt/funcionarios` passa a listar `employees` da org. Botão "Novo" redireciona para `/admin/people` (cadastro completo). Edição inline só dos campos do Ponto.
- `/admin/people` ganha aba/seção "Ponto" no diálogo de edição com filial, escala, jornada semanal, matrícula, CPF.

---

## 2. Organograma editável (RH › Colaboradores)

### Tecnologia
- Biblioteca: **@xyflow/react** (React Flow) — padrão de mercado para diagramas, suporta drag-and-drop, layout automático, custom nodes.
- Layout hierárquico automático via **dagre** (ou `elkjs`) para posicionar nós a partir de `manager_id`.

### Funcionalidades
- Nova aba/rota: `/admin/people/organograma` (ou toggle "Lista | Organograma" em `/admin/people`).
- Cada nó = card com foto/iniciais, nome, cargo, departamento.
- Arrastar nó sobre outro → reassocia `manager_id` (confirmação + chamada server `updateEmployeeFn`).
- Botão "+" em cada nó → cria subordinado direto (abre diálogo já existente com `manager_id` pré-preenchido).
- Clique no nó → painel lateral com detalhes e ações (editar, excluir, ver perfil).
- Expand/collapse de ramos, zoom, mini-mapa, exportar PNG.
- Filtros: por departamento, por nível hierárquico.

### Server
- Reusar `list_team_directory` (já retorna manager_id) — adicionar campo `avatar_url` do profile.
- Nova função `setEmployeeManager({ employeeId, managerId })` com validação anti-ciclo.

---

## 3. Fluxograma por Processo (RH › Processos por cargo)

### Modelo
- `role_processes.steps` já é `jsonb`. Evoluir o schema do JSON para:
  ```
  { nodes: [{id, type:'start'|'task'|'decision'|'end', label, description, owner}],
    edges: [{id, source, target, label?, condition?}] }
  ```
- Manter retrocompat: se `steps` for array simples (formato atual), converter para nodes lineares na leitura.

### UI — editor visual
- Componente `<ProcessFlowEditor processId>` com **@xyflow/react**:
  - Paleta lateral: Início, Tarefa, Decisão, Fim.
  - Arrastar para o canvas, conectar com handles, editar label/descrição/responsável no painel lateral.
  - Auto-layout (dagre) com botão "Organizar".
  - Validações: 1 início, ≥1 fim, sem nós órfãos.
  - Salvar (debounced) via `processes.functions.ts`.
- Visualização read-only para gestores/colaboradores (mesmo canvas, sem edição).
- Exportar PNG/SVG.

### Server
- Estender `processes.functions.ts`:
  - `getProcessFlow({ processId })`
  - `saveProcessFlow({ processId, nodes, edges })` (RH only).

### Onde aparece
- Em `/admin/processes` lista de processos → botão "Fluxograma" abre o editor em modal grande ou rota dedicada `/admin/processes/$id/flow`.
- Em `/me/processes/$id` (visão colaborador): fluxograma read-only.

---

## Detalhes técnicos

### Dependências novas
- `@xyflow/react` (React Flow v12)
- `dagre` ou `@dagrejs/dagre` para layout hierárquico
- `html-to-image` para exportar PNG (opcional)

### Migrations (ordem)
1. ALTER `employees` ADD COLUMN cpf, registration, branch_id, schedule_id, weekly_hours, contract_type.
2. Backfill: `INSERT/UPDATE employees FROM pt_employees` por (user_id, org_id).
3. ALTER `pt_punches`, `pt_anomalies`: trocar FK para `employees(id)` (com mapping table temporária).
4. DROP `pt_employees` (ou converter em view).
5. Atualizar `pt_companies` sync trigger se necessário.

### Riscos
- Migração de `pt_employees → employees` precisa preservar IDs referenciados em `pt_punches`. Estratégia: criar coluna `employees.legacy_pt_id` temporária para mapeamento, depois atualizar FKs e dropar.
- React Flow adiciona ~150kb gz; aceitável.

### Fora de escopo desta iteração
- Versionamento histórico do organograma e dos fluxogramas (snapshots).
- Importar/exportar BPMN.
- Aprovação multi-step de mudanças no organograma.

---

## Entregáveis

1. Migration unificando employees + Ponto, backfill, atualização de FKs.
2. Server functions do Ponto reescritas para usar `employees`.
3. Tela `/pt/funcionarios` simplificada (visão filtrada) + diálogo do colaborador com seção Ponto em `/admin/people`.
4. Rota/aba `/admin/people` com toggle Lista ↔ Organograma usando React Flow + dagre, drag-and-drop reassociando gestor.
5. Editor de fluxograma em `/admin/processes/$id/flow` (RH edita, demais visualizam), persistindo em `role_processes.steps`.
