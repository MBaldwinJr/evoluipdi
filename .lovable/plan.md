# Causa raiz

A tabela `employees.user_id` agora tem **duas** foreign keys apontando para o mesmo destino:
- `employees_user_id_fkey` → `auth.users(id)` (original)
- `employees_user_id_profiles_fkey` → `public.profiles(id)` (adicionada na última migration)

Quando o código faz `profile:profiles(full_name, email)`, o PostgREST não sabe qual relação seguir e retorna erro de **embed ambíguo** ("more than one relationship was found"). Resultado: `.data` vira `null`, o `?? []` mascara o erro, e a lista fica vazia — exatamente o sintoma do usuário.

Confirmei no banco que o Mauro existe em `employees`, com `profiles.full_name = "Mauro Balduino"` e `user_roles.role = "gestor"`. Os dados estão certos; só o select é que falha.

# Correção

Usar o **hint explícito da FK** em todas as queries que fazem embed de `profiles` a partir de `employees`. Sintaxe PostgREST: `profile:profiles!employees_user_id_profiles_fkey(...)`.

## Arquivos a alterar

1. **`src/routes/_app.admin.people.tsx`**
   - Query `admin-people`: trocar `profile:profiles(full_name, email)` por `profile:profiles!employees_user_id_profiles_fkey(full_name, email)`.
   - Query `managers-only`: mesma troca no segundo select.

2. **`src/routes/_app.team.index.tsx`**
   - Query `team`: mesma troca.

3. **`src/routes/_app.team.$id.tsx`** (verificar se também faz embed de profiles a partir de employees; se sim, aplicar a mesma correção).

# Sem mudanças de banco

A migration anterior continua válida e necessária — só falta dizer ao PostgREST qual FK usar no embed.

# Validação

Após o ajuste, recarregar `/admin/people` logado como RH deve listar o Mauro com nome e e-mail, e o dropdown "Gestor direto" no diálogo de novo colaborador também deve listá-lo.
