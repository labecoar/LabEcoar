# LabEcoar - Plataforma de Gamificação

Plataforma web profissional para gamificação e gestão de tarefas com sistema de pontuação, rankings e validação de provas.

## 🚀 Tecnologias

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deploy:** Vercel

## ✨ Funcionalidades

### Área do Usuário (Ecoante)
- ✅ Visualizar tarefas disponíveis
- ✅ Enviar provas (imagens, PDFs, links)
- ✅ Histórico de tarefas realizadas
- ✅ Pontuação acumulada e rankings
- ✅ Sistema de gamificação com categorias

### Área Administrativa
- ✅ Criar e gerenciar tarefas
- ✅ Validar provas enviadas
- ✅ Controlar pontuação dos usuários
- ✅ Gerenciar categorias e rankings
- ✅ Gerar relatórios trimestrais (CSV, PDF)
- ✅ Dashboard com métricas

## 🔐 Sistema de Permissões

O projeto implementa um sistema robusto de autenticação e autorização:

- **Row Level Security (RLS)** no Supabase
- **Protected Routes** no frontend
- **Context API** para gerenciamento de estado de autenticação
- **Separação clara** entre roles (admin/user)

## 📦 Instalação

1. **Clone o repositório:**
```bash
git clone <seu-repositorio>
cd LabEcoar
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**

Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais do Supabase:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

4. **Configure o banco de dados:**

No painel do Supabase (SQL Editor), execute o script `supabase-schema.sql` para criar:
- Tabelas (profiles, tasks, submissions, user_scores)
- Políticas de RLS
- Functions e Triggers
- Storage buckets

5. **Crie o primeiro admin:**

No Supabase Authentication, crie um usuário e depois execute no SQL Editor:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

## 🏃 Executando o Projeto

**Modo desenvolvimento:**
```bash
npm run dev
```

O projeto estará disponível em `http://localhost:3000`

**Build para produção:**
```bash
npm run build
```

**Preview da build:**
```bash
npm run preview
```

## 📁 Estrutura do Projeto

```
LabEcoar/
├── src/
│   ├── components/
│   │   └── ProtectedRoute.jsx    # Componente para rotas protegidas
│   ├── contexts/
│   │   └── AuthContext.jsx       # Context de autenticação e permissões
│   ├── lib/
│   │   └── supabase.js           # Cliente Supabase configurado
│   ├── pages/
│   │   ├── Login.jsx             # Página de login
│   │   ├── UserDashboard.jsx     # Dashboard do usuário
│   │   └── AdminDashboard.jsx    # Dashboard administrativo
│   ├── App.jsx                   # Configuração de rotas
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Estilos globais Tailwind
├── supabase-schema.sql           # Schema do banco de dados
├── .env.example                  # Exemplo de variáveis de ambiente
└── package.json
```

## 🔒 Segurança

- **Row Level Security (RLS)** ativado em todas as tabelas
- **Validação de roles** no backend (Supabase Policies)
- **Protected Routes** no frontend
- **Storage com controle de acesso** por usuário
- **Tokens JWT** gerenciados pelo Supabase Auth

## 📝 Próximos Passos

- [ ] Implementar CRUD completo de tarefas
- [ ] Sistema de upload e validação de provas
- [ ] Cálculo automático de pontuação
- [ ] Rankings dinâmicos (geral e por categoria)
- [ ] Geração de relatórios trimestrais
- [ ] Dashboard com gráficos e métricas
- [ ] Sistema de notificações
- [ ] Automação de limpeza trimestral

## 🤝 Contribuindo

Este é um projeto profissional sob contrato. Alterações devem ser aprovadas pela contratante.

## 📄 Licença

Código-fonte é propriedade da contratante conforme cláusula 2.2.1 do contrato.