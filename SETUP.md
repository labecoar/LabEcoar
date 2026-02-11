#  LabEcoar - Configuração Supabase

Para o projeto funcionar corretamente, você precisa:

## 1. Configurar o Supabase

1. Vá em https://supabase.com
2. Crie um novo projeto ou use um existente
3. Copie as credenciais:
   - **URL**: Project URL
   - **Anon Key**: Public Anonymous Key

## 2. Criar o `.env` local

Copie o `.env.example`:
```bash
cp .env.example .env
```

Edite e preencha com suas credenciais:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

## 3. Criar o Schema no Supabase

No **SQL Editor** do Supabase, execute o script `supabase-schema.sql`:

```bash
- Abra o Supabase Dashboard
- Vá para SQL Editor
- Crie uma nova query
- Cole o conteúdo de `supabase-schema.sql`
- Execute (Ctrl+Enter ou cmd+Enter)
```

Isso vai criar:
- Tabelas (profiles, tasks, submissions, user_scores)
- Row Level Security (RLS)
- Policies de acesso
- Functions e Triggers

## 4. Instalar Dependências

```bash
npm install
```

## 5. Rodar o Projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

## 📝 Observações

- **Autenticação**: O projeto usa Supabase Auth
- **Permissões**: Admin vs User são controlados via RLS
- **Storage**: Arquivos são salvos em buckets do Supabase
- **Base44**: O código antigo funciona através de um adaptador (src/api/base44Adapter.js)

## 🔗 Links Úteis

- [Supabase Docs](https://supabase.com/docs)
- [Vite Docs](https://vitejs.dev)
- [React Query Docs](https://tanstack.com/query/latest)
