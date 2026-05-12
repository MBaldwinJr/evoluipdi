## Problema 1 — "Cadastro pendente" no /me como RH

A rota `/me` (`_app.me.index.tsx`) busca um registro em `employees` ligado ao seu `user_id`. Usuários RH puros (criados como admin) não têm linha em `employees`, então cai no estado vazio "Cadastro pendente".

### Solução

Ajustar `_app.me.index.tsx` para detectar o papel do usuário:

- **Se `isRH`** e não houver `employee`: mostrar painel administrativo resumido em vez do estado vazio confuso. Cards com:
  - Nº de colaboradores cadastrados
  - Nº de cargos / setores
  - Nº de PDIs aguardando validação
  - Nº de entrevistas aplicadas no mês
  - Atalhos rápidos: "Cadastrar colaborador", "Gerenciar cargos", "Ver relatórios"
- **Se `isGestor`** sem registro de colaborador: mensagem orientando ir para `/team`.
- **Se colaborador comum** sem vínculo: manter mensagem atual ("procure o RH").

Também ajustar o sidebar/menu: para RH, fazer `/admin/people` (ou `/admin/reports`) ser o destino padrão ao logar, em vez de `/me`.

## Problema 2 — Tela de entrevista

A tela **já existe e está funcional**:
- Componente: `src/components/interview-wizard.tsx` (wizard pergunta-a-pergunta com progresso, salvamento de rascunho em localStorage e validação mínima de 3 caracteres).
- Acessada em: **Equipe → clicar em um colaborador → aba "Entrevistas" → botão "Nova entrevista"**.
- Mostra histórico das entrevistas aplicadas com data, tipo e template.

### Observação importante para RH

Hoje o botão "Nova entrevista" só aparece dentro de `/team/$id`, e `/team` lista apenas subordinados diretos do gestor logado. Como RH você precisa conseguir aplicar entrevista em **qualquer** colaborador.

### Melhorias propostas

1. **Lista global de colaboradores para RH em `/team`**: se `isRH`, listar todos os colaboradores ativos (não só subordinados).
2. **Atalho "Aplicar entrevista" no painel RH** (`/me` quando RH) e em `/admin/people` (ícone ao lado de cada colaborador) que abre o wizard direto.
3. **Página dedicada `/admin/interviews/aplicadas`** (opcional): tabela com todas as entrevistas aplicadas na empresa, com filtro por colaborador/tipo/data e link para ver detalhes (perguntas + respostas).

## Arquivos afetados

- `src/routes/_app.me.index.tsx` — branch RH/Gestor/Colaborador.
- `src/routes/_app.team.index.tsx` — listar todos quando RH.
- `src/routes/_app.admin.people.tsx` — botão "Aplicar entrevista" por linha.
- (opcional) `src/routes/_app.admin.interviews.aplicadas.tsx` — nova página.
- `src/components/app-sidebar.tsx` — destacar área RH ao logar.

Quer que eu implemente as 3 melhorias ou apenas a #1 + #2 (mais rápidas)?
