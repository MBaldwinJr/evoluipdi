## Visão geral

Plataforma corporativa de gestão de pessoas que conecta cargos (RCF), avaliações, feedback contínuo e PDI em um ciclo vivo, com IA apoiando análise de gaps e construção de planos. Identidade visual corporativa clean (azul/cinza, tipografia sóbria, foco em clareza). Acesso restrito: apenas RH cria usuários e atribui papéis (Colaborador, Gestor, RH/Admin).

## Papéis e permissões

- **RH/Admin**: cria usuários, define cargos/RCF, configura roteiros de entrevista, monitora consistência, vê todos os dados e relatórios estratégicos.
- **Gestor**: vê sua equipe, conduz entrevistas, registra feedbacks, valida PDIs, acompanha evolução.
- **Colaborador**: vê seu próprio perfil, propõe PDI, registra aprendizados, acompanha sua timeline e feedbacks recebidos.

Login por e-mail/senha. Sem auto-cadastro. RH envia convite com senha provisória.

## Módulos (entregues juntos na v1)

### 1. Cargos e RCF
- CRUD de cargos vinculados a setores.
- Cada cargo tem: responsabilidades, competências técnicas, competências comportamentais e indicadores esperados (cada item com nível esperado de 1–5).
- Base usada por avaliações, entrevistas e detecção de gaps.

### 2. Colaboradores
- Cadastro com setor, cargo atual, gestor direto, data de admissão.
- Perfil exibe timeline única: histórico de cargos, avaliações, feedbacks, PDIs e aprendizados.
- Objetivos de carreira declarados pelo próprio colaborador.

### 3. Entrevistas (inicial, periódica, de avaliação)
- Roteiros configuráveis pelo RH por tipo de entrevista e cargo, gerados dinamicamente a partir do RCF.
- Registro de respostas, observações e classificação automática preliminar (Abaixo / Dentro / Acima do esperado) por competência.
- Histórico completo no perfil.

### 4. Avaliação de desempenho
- Comparativo visual: nível esperado do cargo × nível observado, por competência.
- Classificação geral e por competência.
- Campo de feedback estruturado obrigatório com prompts: "Fato observado", "Impacto", "Próximo passo" — para evitar feedback genérico.

### 5. Feedback contínuo
- Registro rápido de feedback informal (1-clique a partir do perfil do liderado).
- Feedback formal estruturado seguindo regra Intenção / Clareza / Compromisso.
- Linha do tempo de feedbacks por colaborador, com filtros (dado por mim, recebido, formal/informal).

### 6. Análise de gaps automatizada (com IA)
- A IA cruza RCF do cargo × resultados de avaliação × feedbacks recentes.
- Gera lista priorizada de gaps com justificativa em linguagem natural.
- Aplica lógica dos "5 porquês" para sugerir causa-raiz de cada gap principal.

### 7. PDI estruturado em 4 etapas
- Etapa 1: definição de objetivo (curto/médio/longo prazo).
- Etapa 2: seleção de gaps (sugeridos pela IA + edição manual).
- Etapa 3: transformação em pontos de desenvolvimento mensuráveis (com critério de sucesso e prazo).
- Etapa 4: plano de ação prático.
- Fluxo de validação: colaborador propõe → gestor revisa/aprova → RH acompanha.

### 8. Modelo 70-20-10
- Para cada ponto de desenvolvimento do PDI, IA sugere automaticamente ações distribuídas em:
  - 70% Prática (desafios reais no trabalho)
  - 20% Troca (mentoria, shadowing, pares)
  - 10% Formal (cursos, leituras, treinamentos)
- Visualização do PDI em barra de proporção 70-20-10 para garantir equilíbrio.

### 9. Motor de sugestões inteligentes
- Botão "Sugerir com IA" disponível em: feedback (estruturar texto bruto em Fato/Impacto/Próximo passo), gaps, ações de PDI 70-20-10 e melhorias comportamentais.
- Sempre editável pelo humano antes de salvar — IA é apoio, não substituição.

### 10. Acompanhamento e check-ins
- Dashboard por colaborador: status do PDI, % de ações concluídas, próximos check-ins, últimos feedbacks.
- Check-ins periódicos agendáveis (mensal/trimestral) com lembretes.
- Alertas para gestores: PDI parado há X dias, feedback não dado há Y semanas, check-in atrasado.

### 11. Relatórios e inteligência (visão RH)
- Performance por equipe e setor.
- Top gaps recorrentes da empresa.
- Evolução agregada (antes/depois de PDI).
- Engajamento: feedbacks dados, PDIs ativos, taxa de conclusão.
- Exportação CSV.

## Telas principais

```text
/login                          Login
/                               Redireciona conforme papel
/me                             Meu perfil + minha timeline (Colaborador)
/me/pdi                         Meu PDI
/me/feedbacks                   Feedbacks recebidos/dados
/team                           Minha equipe (Gestor)
/team/:id                       Perfil do liderado
/team/:id/feedback/new          Dar feedback
/team/:id/interview/new         Nova entrevista/avaliação
/team/:id/pdi                   Validar PDI
/admin/people                   Gestão de colaboradores (RH)
/admin/roles                    Cargos e RCF (RH)
/admin/interviews               Roteiros de entrevista (RH)
/admin/reports                  Relatórios estratégicos (RH)
/admin/settings                 Configurações
```

## Arquitetura de dados (resumo)

Tabelas principais:
- `profiles` (vinculada a auth.users)
- `user_roles` (tabela separada — colaborador/gestor/rh) com função `has_role()` SECURITY DEFINER
- `departments`, `roles_catalog` (cargos), `rcf_items` (responsabilidades/competências/indicadores com nível esperado)
- `employees` (cargo, gestor, setor, objetivos de carreira)
- `interview_templates`, `interviews`, `interview_answers`
- `evaluations`, `evaluation_scores` (por competência)
- `feedbacks` (tipo, fato, impacto, próximo passo, autor, destinatário)
- `gaps` (competência, severidade, origem, justificativa)
- `pdis` (objetivo, status, validações), `pdi_development_points`, `pdi_actions` (categoria 70/20/10)
- `checkins`, `learning_logs`

RLS em todas as tabelas, escopo por papel via `has_role()`. Service role só em server functions administrativas.

## IA

Usa Lovable AI Gateway via `createServerFn` (sem chamadas diretas do cliente). Casos de uso:
- Estruturar feedback bruto em Fato/Impacto/Próximo passo.
- Priorizar gaps e gerar "5 porquês".
- Sugerir ações 70-20-10 a partir de cada gap + cargo + histórico do colaborador.
- Modelo padrão: `google/gemini-3-flash-preview`. Prompts ficam no servidor.

## Identidade visual

- Paleta: azuis profundos (#1e3a5f / oklch equivalente) + cinzas neutros + branco. Acento sutil para sucesso/alerta.
- Tipografia: Inter, hierarquia clara, peso 500/600 em títulos.
- Componentes shadcn/ui já presentes (cards, tabs, table, dialog, badge, progress, chart).
- Layout com sidebar lateral fixa por papel + topbar com perfil/notificações.
- Visual de timeline vertical no perfil do colaborador.
- Dashboards com cards de KPI + gráficos (recharts via shadcn/chart).

## Detalhes técnicos

- TanStack Start (rotas em `src/routes/`), TypeScript estrito.
- Lovable Cloud (Supabase) para auth, banco e storage.
- Roles em tabela separada `user_roles` + `has_role()` SECURITY DEFINER (nunca em `profiles`).
- Server functions (`createServerFn`) para toda lógica sensível: chamadas de IA, agregações de relatórios, validações de PDI.
- Layout protegido `_authenticated` + sub-layouts `_admin`, `_manager` por papel.
- Validação de inputs com Zod em todas as server functions.
- Seed inicial com 1 usuário RH para o primeiro acesso (credenciais mostradas após criação).

## O que NÃO entra na v1

- Integração com folha/HRIS externos.
- App mobile nativo (a versão web é responsiva).
- Vídeo/voz nas entrevistas.
- Marketplace de cursos integrado (apenas links/registro manual).

## Resultado esperado

Um sistema vivo onde o ciclo Cargo → Avaliação → Feedback → Gap → PDI → Ação → Check-in roda continuamente, com IA reduzindo o esforço de estruturar feedbacks e planos, e o RH ganhando visão estratégica real sobre desenvolvimento.
