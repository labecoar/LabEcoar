-- ===================================
-- SCHEMA DO BANCO DE DADOS - LabEcoar
-- Plataforma de Gamificação
-- ===================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================
-- TABELA: profiles
-- Perfis dos usuários
-- ===================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  display_name TEXT,
  bio TEXT,
  instagram_handle TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  
  -- Dados de gamificação
  followers_count INTEGER DEFAULT 0,
  current_category TEXT DEFAULT 'voz_e_violao',
  current_quarter TEXT DEFAULT 'Q1-2025',
  campaigns_participated INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas de perfil adicionais em bases já existentes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

-- ===================================
-- TABELA: tasks
-- Tarefas disponíveis
-- ===================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('campanha', 'resposta_rapida', 'oficina', 'folhetim', 'compartilhar_ecoante')),
  points INTEGER NOT NULL DEFAULT 0,
  offered_value NUMERIC(12,2),
  proof_type TEXT DEFAULT 'link' CHECK (proof_type IN ('link', 'imagem', 'video', 'arquivo')),
  content_formats TEXT[] DEFAULT '{}',
  expiration_value INTEGER DEFAULT 1,
  expiration_unit TEXT DEFAULT 'days' CHECK (expiration_unit IN ('hours', 'days', 'weeks')),
  delivery_deadline DATE,
  campaign_type TEXT DEFAULT 'comum',
  requires_application BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  
  -- Requisitos
  min_followers INTEGER DEFAULT 0,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  
  -- Datas
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas adicionais de tarefas em bases já existentes
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS offered_value NUMERIC(12,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proof_type TEXT DEFAULT 'link';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_formats TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expiration_value INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expiration_unit TEXT DEFAULT 'days';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delivery_deadline DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'comum';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_application BOOLEAN DEFAULT false;

-- ===================================
-- TABELA: submissions
-- Submissões de tarefas
-- ===================================
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Conteúdo
  description TEXT,
  proof_url TEXT,
  
  -- Status e validação
  status TEXT DEFAULT 'application_pending' CHECK (status IN ('application_pending', 'application_approved', 'application_rejected', 'proof_pending', 'approved', 'rejected', 'pending')),
  points_awarded INTEGER DEFAULT 0,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir compatibilidade de status em bases existentes
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('application_pending', 'application_approved', 'application_rejected', 'proof_pending', 'approved', 'rejected', 'pending'));

-- Índice para evitar duplicidade de workflow por usuário/tarefa
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_user_task_unique
  ON submissions(user_id, task_id);

-- ===================================
-- TABELA: user_scores
-- Pontuação acumulada dos usuários
-- ===================================
CREATE TABLE IF NOT EXISTS user_scores (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================
-- STORAGE BUCKET: submissions
-- Armazenamento de comprovantes
-- ===================================

-- Criar bucket (executar apenas se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true)
ON CONFLICT (id) DO NOTHING;

-- ===================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================

-- Ativar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scores ENABLE ROW LEVEL SECURITY;

-- ===================================
-- POLICIES: profiles
-- ===================================

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins podem ver todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Permitir insert ao criar conta (via trigger do Supabase Auth)
CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ===================================
-- POLICIES: tasks
-- ===================================

-- Todos usuários autenticados podem ver tarefas ativas
CREATE POLICY "Users can view active tasks"
  ON tasks FOR SELECT
  USING (status = 'active' OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- Apenas admins podem criar tarefas
CREATE POLICY "Admins can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Apenas admins podem atualizar tarefas
CREATE POLICY "Admins can update tasks"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Apenas admins podem deletar tarefas
CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ===================================
-- POLICIES: submissions
-- ===================================

-- Usuários podem ver suas próprias submissões
CREATE POLICY "Users can view own submissions"
  ON submissions FOR SELECT
  USING (user_id = auth.uid());

-- Admins podem ver todas as submissões
CREATE POLICY "Admins can view all submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Usuários podem criar submissões
CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Usuários podem atualizar apenas suas submissões aprovadas para enviar prova
CREATE POLICY "Users can submit proof on approved applications"
  ON submissions FOR UPDATE
  USING (user_id = auth.uid() AND status = 'application_approved')
  WITH CHECK (user_id = auth.uid() AND status = 'proof_pending');

-- Apenas admins podem atualizar submissões (aprovar/rejeitar)
CREATE POLICY "Admins can update submissions"
  ON submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ===================================
-- POLICIES: user_scores
-- ===================================

-- Usuários podem ver sua própria pontuação
CREATE POLICY "Users can view own score"
  ON user_scores FOR SELECT
  USING (user_id = auth.uid());

-- Todos podem ver o ranking (para leaderboard)
CREATE POLICY "All users can view leaderboard"
  ON user_scores FOR SELECT
  USING (true);

-- Permitir insert/update para sistema de pontos
CREATE POLICY "System can manage scores"
  ON user_scores FOR ALL
  USING (true)
  WITH CHECK (true);

-- ===================================
-- POLICIES: Storage (submissions bucket)
-- ===================================

-- Permitir upload para usuários autenticados
CREATE POLICY "Users can upload own submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submissions' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Permitir leitura pública (para admins validarem)
CREATE POLICY "Public can view submissions"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'submissions');

-- Permitir delete apenas do próprio arquivo
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'submissions' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ===================================
-- TRIGGERS: Atualização automática de timestamps
-- ===================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para tasks
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para submissions
DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para user_scores
DROP TRIGGER IF EXISTS update_user_scores_updated_at ON user_scores;
CREATE TRIGGER update_user_scores_updated_at
  BEFORE UPDATE ON user_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- TRIGGER: Criar perfil automaticamente ao registrar
-- ===================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ===================================
-- DADOS INICIAIS (SEED)
-- ===================================

-- Criar usuário admin de exemplo (OPCIONAL - somente para desenvolvimento)
-- NOTA: Primeiro crie um usuário via Supabase Auth, depois atualize o role
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@labecoar.com';

-- ===================================
-- ÍNDICES para Performance
-- ===================================

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_id ON submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_user_scores_points ON user_scores(total_points DESC);

-- ===================================
-- FIM DO SCHEMA
-- ===================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Schema LabEcoar criado com sucesso!';
  RAISE NOTICE '📋 Tabelas: profiles, tasks, submissions, user_scores';
  RAISE NOTICE '🔒 RLS policies ativadas';
  RAISE NOTICE '📁 Storage bucket: submissions';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Próximos passos:';
  RAISE NOTICE '1. Criar usuário via signup';
  RAISE NOTICE '2. Atualizar role para admin: UPDATE profiles SET role = ''admin'' WHERE email = ''seu@email.com'';';
  RAISE NOTICE '3. Testar a aplicação!';
END $$;
