## Problema

Ao cadastrar colaborador em `/admin/people`, a tela fica em branco com `Error: [object Response]`. O toast "Colaborador criado" aparece, mas em seguida o app quebra.

**Causa raiz** (confirmada pelo session replay): o usuário clicou no botão "Criar" **duas vezes em sequência rápida** (eventos 750022 e 750103, ~80ms de diferença). O `disabled={busy}` ainda não tinha sido aplicado quando o segundo clique disparou. Resultado:

1. 1ª chamada: `createUserAndEmployee` cria o usuário no Supabase Auth → sucesso → toast "Colaborador criado".
2. 2ª chamada: tenta criar o **mesmo e-mail** → `supabaseAdmin.auth.admin.createUser` retorna erro "User already registered" → o handler faz `throw new Error(...)`, mas como o server fn TanStack envelopa em `Response`, o erro chega no cliente como `[object Response]` e dispara o errorComponent → tela em branco.

Há também um agravante: como `setState(busy=true)` é assíncrono, dois cliques quase simultâneos passam ambos pela checagem inicial de `busy`.

## Correção

### 1. `src/routes/_app.admin.people.tsx` — `NewPersonDialog`

- Trocar o estado `busy` por um **`useRef<boolean>`** (`submittingRef`) que bloqueia reentrância de forma síncrona, mantendo `busy` apenas para feedback visual.
- No `submit`: se `submittingRef.current === true`, retornar imediatamente.
- Envolver o `submit` em try/catch que sempre reseta `submittingRef.current = false` no finally.
- Capturar o erro vindo do server fn de forma robusta: se `e instanceof Response`, ler `await e.text()` para mostrar mensagem útil; senão `e.message ?? "Erro ao criar"`.

### 2. `src/server/admin.functions.ts` — `createUserAndEmployee`

- Antes de chamar `supabaseAdmin.auth.admin.createUser`, fazer um `select` em `profiles` por e-mail; se já existir, lançar `new Error("E-mail já cadastrado")` com mensagem amigável.
- Garantir que toda mensagem de erro seja `throw new Error("string legível")` (nunca um `Response` cru), para que o cliente receba texto utilizável.

### 3. (Opcional, defensivo) `src/components/interview-wizard.tsx` ou outros formulários com submit

- Não alterar agora; apenas o de `people` é o caminho que reproduz o bug.

## Resultado esperado

- Clique duplo no "Criar" não quebra mais a tela.
- Se o e-mail já existir, aparece toast "E-mail já cadastrado" em vez de tela branca.
- O fluxo normal continua funcionando.
