# 📖 Guia de Desenvolvimento - LabEcoar

## 🚀 Como começar

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Já existe um arquivo `.env` configurado com:
```
VITE_SUPABASE_URL=https://ynvtwsdvzaksqxuocrbh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

### 3. Executar schema no Supabase
1. Acesse https://supabase.com/dashboard
2. Vá em SQL Editor
3. Copie todo o conteúdo de `supabase-schema.sql`
4. Execute

### 4. Iniciar aplicação
```bash
npm run dev
```

---

## 🏗️ Arquitetura do projeto

### Services (Camada de dados)
Os services são responsáveis por comunicação com Supabase:
- `auth.service.js` - Login, registro, perfil
- `tasks.service.js` - CRUD de tarefas
- `submissions.service.js` - Submissões e validações
- `scores.service.js` - Pontuação e ranking
- `storage.service.js` - Upload de arquivos

### Hooks (Camada de estado)
Hooks customizados com React Query:
- Cache automático
- Refetch inteligente
- Loading/Error states
- Mutations otimistas

### Context (Estado global)
`AuthContext` - Gerencia autenticação e perfil do usuário.

---

## 📝 Padrões de código

### Importar serviços
```javascript
import { tasksService } from '@/services/tasks.service'
```

### Usar hooks
```javascript
import { useTasks } from '@/hooks/useTasks'

function MyComponent() {
  const { data: tasks, isLoading, error } = useTasks()
  
  if (isLoading) return <Loading />
  if (error) return <Error message={error.message} />
  
  return <TaskList tasks={tasks} />
}
```

### Mutations
```javascript
import { useCreateTask } from '@/hooks/useTasks'

function CreateTaskForm() {
  const createTask = useCreateTask()

  const handleSubmit = async (formData) => {
    try {
      await createTask.mutateAsync(formData)
      alert('Tarefa criada!')
    } catch (error) {
      alert('Erro: ' + error.message)
    }
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

---

## 🔒 Autenticação e Permissões

### Verificar autenticação
```javascript
import { useAuth } from '@/contexts/AuthContext'

function MyComponent() {
  const { user, profile, isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated) return <LoginPrompt />
  if (!isAdmin) return <AccessDenied />
  
  return <AdminPanel />
}
```

### Proteger rotas
```javascript
import { ProtectedRoute } from '@/components/ProtectedRoute'

<Route path="/admin" element={
  <ProtectedRoute>
    <AdminPage />
  </ProtectedRoute>
} />
```

---

## 📚 Componentes UI

Usamos **shadcn/ui** para componentes:
```javascript
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
```

---

## 🎨 Estilização

### Paleta de cores
```css
Primária: #096e4c (emerald-700)
Secundária: #00c331 (green-500)
Accent: #f6c835 (amber-400)
```

### Gradientes
```jsx
className="bg-gradient-to-br from-emerald-50 via-white to-green-50"
```

---

## 🗄️ Estrutura do banco de dados

### Tabelas principais
- `profiles` - Dados dos usuários
- `tasks` - Tarefas disponíveis
- `submissions` - Submissões dos usuários
- `user_scores` - Pontuação acumulada

### Row Level Security (RLS)
Todas as tabelas têm policies:
- Users só veem seus dados
- Admins veem tudo
- Insert/Update protegidos

---

## 🐛 Debug

### Ver queries do React Query
```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Em App.jsx
<ReactQueryDevtools initialIsOpen={false} />
```

### Ver logs do Supabase
```javascript
import { supabase } from '@/lib/supabase'

// Ativar logs
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session)
})
```

---

## 📦 Upload de arquivos

### Exemplo completo
```javascript
import { useUploadFile } from '@/hooks/useStorage'

function UploadForm() {
  const uploadFile = useUploadFile()

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    
    try {
      const { url, path } = await uploadFile.mutateAsync({
        file,
        userId: user.id
      })
      
      console.log('File uploaded:', url)
    } catch (error) {
      console.error('Upload error:', error)
    }
  }

  return <input type="file" onChange={handleFileChange} />
}
```

---

## ✅ Checklist antes de commit

- [ ] Código sem erros no console
- [ ] Imports organizados
- [ ] Sem código comentado
- [ ] Componentes com nomes descritivos
- [ ] Loading states implementados
- [ ] Error handling presente

---

## 🚨 Troubleshooting

### Erro: "User not authenticated"
- Verificar se `.env` está configurado
- Fazer login novamente
- Verificar RLS policies no Supabase

### Erro: "Cannot read property of undefined"
- Adicionar optional chaining: `user?.profile?.name`
- Verificar se dados foram carregados: `if (!data) return null`

### Página em branco
- Abrir console do navegador (F12)
- Verificar erros de import
- Verificar se schema SQL foi executado

---

## 📧 Contato

Dúvidas? Fale com o time no email: labecoar@gmail.com

---

**Última atualização**: 11 de Fevereiro de 2026
