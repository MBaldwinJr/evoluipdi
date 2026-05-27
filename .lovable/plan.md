# Correção da impressão + recrutamento ampliado

## 1. Corrigir layout de impressão (causa do print cortado)

O conteúdo do diálogo do candidato/entrevista é cortado na impressão porque o Radix Dialog usa um wrapper com `transform: translate(-50%, -50%)` e `max-width` fixo. As regras atuais em `src/styles.css` (`#interview-print-area { position: absolute; left: 0 }`) não vencem o `transform` do ancestral, então o conteúdo fica deslocado e clipado.

Ajustes em `src/styles.css` `@media print`:
- Neutralizar `transform`, `position`, `max-height`, `overflow` e `padding` em todos os ancestrais do `#interview-print-area` (`[data-radix-popper-content-wrapper]`, `[role="dialog"]`, `[data-state="open"]`).
- Fixar `@page { size: A4; margin: 14mm }`.
- `#interview-print-area`: `position: static !important`, `transform: none !important`, `width: 100% !important`, `max-height: none`, `overflow: visible`, `box-shadow/border: 0`, `color: #000`, `background: #fff`.
- Forçar quebra suave nas respostas: `.print-block { break-inside: avoid }` e aplicar nos cards de pergunta em candidatos e entrevistas.
- Esconder o overlay `[data-radix-dialog-overlay]` na impressão.

Aplicar a mesma classe/id (`interview-print-area` + `print-block`) onde já existe (entrevistas, candidatos) — sem mexer no comportamento de tela.

## 2. Recrutamento ampliado

### 2.1 Banco (migration)

Acrescentar à `candidate_invites`:
- `cv_path text` — caminho no Storage.
- `cv_uploaded_at timestamptz`.
- `cv_analysis jsonb` — análise de IA do currículo.
- `presential_done boolean default false`, `presential_at timestamptz`, `presential_notes text`.
- `hire_status text default 'em_processo'` — valores: `em_processo | aprovado | contratado | reprovado | desistiu`.
- `hired_at timestamptz`, `hired_employee_id uuid references employees(id)`.

Atualizar lista de status no `CHECK`/labels da UI; manter `status` (do questionário) separado de `hire_status` (do processo seletivo).

Criar bucket Storage `candidate-cvs` (privado) com políticas:
- INSERT/SELECT/DELETE: RH ou `created_by = auth.uid()` (path `{invite_id}/...`).
- Upload público pelo candidato via endpoint serverless (sem expor service role).

### 2.2 Upload do currículo

- **Pelo RH/gestor**: input de arquivo no `CandidateDetailDialog` e no `NewCandidateDialog`. Usa `supabase.storage` direto.
- **Pelo candidato**: na página `/candidato/$token`, novo campo "Anexe seu currículo (PDF, DOC, DOCX, até 8 MB)". O upload vai por POST multipart para `src/routes/api/public/candidate.$token.ts` (existente) — handler valida token, mime e tamanho, salva via `supabaseAdmin.storage` e grava `cv_path` no invite.

### 2.3 Análise de IA do currículo

- Novo `analyzeCandidateCvFn` em `src/lib/candidates.functions.ts` (com `requireSupabaseAuth` + autorização RH/criador).
- No server: baixa o arquivo do Storage, extrai texto (PDF via `pdf-parse` puro JS; DOCX via `mammoth`), chama Lovable AI Gateway com prompt focado em: aderência ao cargo/RCF, experiência, formação, lacunas, perguntas sugeridas, score 0–100, recomendação.
- Resultado salvo em `cv_analysis`. UI mostra ao lado da análise das respostas (abas "Respostas" / "Currículo" / "Consolidado").

### 2.4 Tags e status no kanban

Em `_app.admin.candidates.tsx`:
- Badges adicionais por card: "Currículo ✓/—", "Entrevista presencial ✓", "Contratado".
- Filtro por `hire_status` (chips no topo).
- No `CandidateDetailDialog`: seção "Processo seletivo" com:
  - Switch "Entrevista presencial realizada" + data + notas.
  - Select `hire_status`.
  - Quando `hire_status = contratado`: botão **"Converter em colaborador"** que abre mini-form (departamento, gestor, data de admissão) e cria registro em `employees` + `profiles` provisório (sem `auth.users` — RH convida depois), gravando `hired_employee_id` e `hired_at`.

### 2.5 Correções de segurança pendentes (do scan)

Já que estamos mexendo nesses arquivos, aplicar de uma vez:
- `requireSupabaseAuth` + checagem RH/dono em `analyzeCandidateFn`, `analyzeInterviewFn`, `structureFeedback`, `suggestPdiActions`, `suggestGapsFromEmployee`, `lookupCnpjFn`.
- Remover duplicação `src/server/ai.functions.ts` vs `src/lib/ai.functions.ts` (manter apenas `src/lib/`).

## 3. Detalhes técnicos

- Dependências novas: `pdf-parse`, `mammoth` (ambos puro JS, compatíveis com Workers).
- Bucket privado + URLs assinadas (`createSignedUrl`, validade 5 min) para download/preview pelo RH.
- `src/routes/candidato.$token.tsx`: input file + barra de progresso + validação client-side.
- `src/routes/api/public/candidate.$token.ts`: nova action `PUT /cv` (multipart) com validação Zod do header `content-type`, limite 8 MB, lista branca de mime.
- Tipos do Supabase serão regenerados após a migration.

## 4. Arquivos afetados

- `src/styles.css` (print rules)
- `supabase/migrations/<nova>.sql`
- `src/lib/candidates.functions.ts`, `src/lib/candidates.server.ts`
- `src/lib/ai.functions.ts`, `src/lib/cnpj.functions.ts`, `src/lib/interview-analysis.functions.ts` (auth fix)
- `src/server/ai.functions.ts` (remover)
- `src/routes/_app.admin.candidates.tsx` (UI ampliada)
- `src/routes/candidato.$token.tsx` (upload de CV)
- `src/routes/api/public/candidate.$token.ts` (handler de upload)

## Perguntas

1. **Conversão em colaborador**: ao marcar como contratado, devo criar imediatamente o registro em `employees` (sem login ainda) ou apenas marcar `hire_status=contratado` e o RH cria manualmente na tela de Pessoas?
2. **Currículo obrigatório** para o candidato no formulário público, ou opcional?
