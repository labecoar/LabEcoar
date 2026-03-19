# Refatoracao - LabEcoar

## O que foi consolidado

- Arquitetura de dados e autenticacao centralizada no Supabase.
- Camada de servicos separada por dominio (`auth`, `tasks`, `submissions`, `scores`, `storage`, `forum`).
- Hooks com React Query para leitura, mutacao e invalidacao de cache.
- Rotas protegidas por perfil com fluxo administrativo separado.
- Schema SQL unificado com RLS, triggers e funcoes auxiliares.

## Estrutura de referencia

```text
src/
  services/   -> regras de acesso a dados
  hooks/      -> integracao React Query
  contexts/   -> estado global de autenticacao
  pages/      -> telas da aplicacao
  components/ -> UI reutilizavel
  lib/        -> cliente Supabase e utilitarios
```

## Padrao recomendado para novas features

1. Criar/atualizar tabela e policy no `supabase-schema.sql`.
2. Adicionar metodos no servico de dominio (`src/services/*`).
3. Expor hooks em `src/hooks/*` para queries e mutations.
4. Usar os hooks na pagina/componente.
5. Validar invalidacao de cache das chaves afetadas.

## Seguranca

- RLS ativo nas tabelas sensiveis.
- Validacao de perfil admin no frontend e no banco.
- Storage com regras de acesso por usuario.

## Checklist operacional

- Executar schema atualizado no Supabase SQL Editor.
- Garantir variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente.
- Validar fluxos: login, tarefas, submissao, aprovacao admin, forum e ranking.

---

**Refatoração concluída em**: 11 de Fevereiro de 2026  
**Autor**: GitHub Copilot  
**Stack**: React 18 + Supabase + React Query + Tailwind CSS
