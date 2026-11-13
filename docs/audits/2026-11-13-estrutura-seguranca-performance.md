# Evolui PDI — Auditoria inicial de estrutura, segurança e desempenho
Data: 2026-11-13
Repositório: MBaldwinJr/evoluipdi
Referência auditada: main (commit 5e334c649a9e65b47a95bd1a3434a741325cfcc7)
Escopo: análise estática do código e de documentos do GitHub. Não houve acesso ao banco em execução nem testes funcionais nesta rodada.

## Arquitetura confirmada
- Interface: React 19, TypeScript, Tailwind CSS 4 e TanStack Router/Start.
- Build/dev: Vite 7 com @lovable.dev/vite-tanstack-config. O arquivo vite.config.ts alerta contra duplicar plugins injetados.
- Backend: handlers TanStack Start + Supabase Auth/PostgREST/RPC.
- Autenticação: middleware server-side valida Bearer com Supabase getClaims e utiliza cliente autenticado.
- Controle multiempresa: orgs, org_members, org_plans e verificação de papéis por organização.
- Integração Lovable: README indica preview https://evoluipdi.lovable.app e editor https://lovable.dev/projects/65866daf-b226-46bc-ab61-5edb8d363586; sincronização atual não foi testada.

## Módulos e cobertura
- Confirmados no código: administração de organizações e planos, convites, autenticação, autorização por organização, testes de segurança.
- Indicados pela matriz de módulos em src/lib/org.functions.ts: rh, pdi, entrevistas, candidatos, ponto, relatorios, jornada-avancada e ia-assistente.
- Outros recursos descritos no README (cargos/RCF, feedback, avaliações, gaps, 70-20-10, acompanhamento) são objetivos de produto; sua implementação integral NÃO foi verificada nesta rodada.
- Não atribuir status 'funcional' a qualquer módulo sem inspeção da rota, service, RLS e teste real.

## Achados prioritários
### P0 — antes de declarar o SaaS seguro
1. Migração de hardening versionada: security/migrations/20261022122600_security_hardening.sql está descrita como artefato de revisão, não como aplicada. Validar live RLS/grants/triggers antes de qualquer implantação; o estado do banco NÃO foi verificado.
2. security/README.md aponta permissões legadas globais (assertRH), alterações por ID sem escopo org em alguns endpoints e leitura global de configurações. Cada endpoint deve exigir membership org antes de qualquer leitura privilegiada ou gravação.
3. O mesmo relatório aponta política de escrita de respostas de entrevista que permite condutor sem comprovação explícita de membership no banco; corrigir com migração revisada, nunca apenas bloqueio no frontend.
4. Fluxos de criação/aceitação de convite/alteração de plano dependem de RPCs transacionais. Ausência da migração é deliberadamente fail-closed (src/lib/hardening-rpc.server.ts); não adicionar fallback inseguro.

### P1 — confiabilidade e integridade
5. Criação de colaborador envolve Auth + PostgreSQL: compensação pode falhar, sem transação única. Projetar fluxo idempotente e fila de reconciliação.
6. Salvamento de avaliações semanais em múltiplos itens não é transacional. Propor RPC única com checagem de concorrência/versão.
7. Papéis globais usados em navegação/listagens de gestores podem não refletir papéis multiempresa. Migrar menus e consultas para permissões escopadas por org com testes de regressão.
8. As consultas de CNPJ usam fontes externas e retries; observar latência, timeout, erros e limites antes de modificar retry/cache.

### P2 — desempenho e manutenção
9. Medir requisições duplicadas de membership/super_admin e tempo de resposta do carregamento inicial; implementar cache por usuário+organização somente após garantir invalidação ao alterar papéis.
10. Medir tamanho do bundle, waterfalls, consultas N+1, páginas pesadas, renderizações de dashboards e índices de filtros usados (org_id, employee_id, created_at); otimizar com métricas antes/depois.
11. Lint global historicamente não passava (segundo security/README.md). Habilitar verificação incremental por arquivos tocados e separar saneamento amplo de mudanças de negócio.
12. A suíte existente inclui bun run test:security e bun run test:security:sql. Confirmar execução atual em CI, mais npm run build, verificações de tipos e smoke tests de rotas.

## Sequência proposta (sem quebrar funcionalidades)
1. Congelar baseline e matriz rota → handler → tabela/RLS → papel permitido → caso de teste.
2. Auditar RLS real em modo leitura; comparar com migração proposta; gerar plano reversível e backup.
3. Corrigir P0 por pequenas PRs e adicionar testes de negação entre organizações, gestor/colaborador e acesso direto via Data API.
4. Testar fluxos PDI, entrevistas, convites, equipes, relatórios e ponto nos perfis admin/RH/gestor/colaborador.
5. Coletar p50/p95, número de queries, taxa de erro e peso de páginas; otimizar os três gargalos demonstrados.
6. Sincronizar branch revisada com Lovable para preview, somente depois da validação e sem publicar em produção automaticamente.

## Preservação
- Nenhuma migração foi executada.
- Nenhum dado de produção foi alterado.
- Nenhuma funcionalidade foi removida nem reescrita.
- Nenhum teste/build foi executado nesta rodada: a inspeção foi pela API do GitHub.
- Este relatório NÃO representa aprovação de segurança ou prontidão para produção.

## Correção incremental aplicada na branch (2026-11-13)

- Arquivo: `src/lib/admin.functions.ts`, handler `listOrgChartFn`.
- Removida uma segunda consulta de `org_members` após a resolução e autorização do `orgId`.
- Consulta a `employees` passou a usar explicitamente o mesmo `orgId` já autorizado.
- Benefício esperado: uma requisição de banco a menos por carregamento de organograma e escopo consistente da organização.
- Sem alteração de contratos de resposta, permissões, migrations ou dados.
- Validação pendente: executar suíte de segurança, lint, build e teste de organograma (admin/RH em uma e múltiplas empresas). Nenhum ganho de latência foi medido nesta etapa.
- Não sincronizar/publicar na main até passar nesses testes e revisar o preview Lovable.
