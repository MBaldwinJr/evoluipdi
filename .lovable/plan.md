# Plano: corrigir lista de colaboradores e dropdown de gestor

## Causa raiz
As queries em `_app.admin.people.tsx` e `_app.team.index.tsx` fazem embed `profile:profiles(full_name, email)` a partir de `employees`. O PostgREST exige uma foreign key entre as duas tabelas para resolver o embed, mas hoje:

- `employees.user_id` → `auth.users(id)`
- `profiles.id` → `auth.users(id)`

Não há FK direta entre `employees` e `profiles`, então o embed retorna erro, `.data` vira `null`, e o código (`?? []`) mostra a tela vazia. Por isso o gestor cadastrado some da lista de Colaboradores e do dropdown "Gestor direto".

## Correção
Adicionar uma FK de `employees.user_id` para `profiles.id` (ambos são o mesmo uuid do auth user, e `handle_new_user` garante que todo novo usuário tem profile). Isso habilita o embed sem mudar nenhuma linha de dado.

```sql
ALTER TABLE public.employees
  ADD CONSTRAINT employees_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

Após a migration, os selects existentes (`profile:profiles(full_name, email)`) passam a resolver e:
- A lista de Colaboradores mostra o Mauro (gestor) e qualquer outro cadastro futuro.
- O dropdown "Gestor direto" passa a listar gestores cadastrados.

## Sem mudanças de código
Nenhuma alteração em `.tsx` é necessária — só a migration.
