-- ===================================
-- SCHEMA DO BANCO DE DADOS - LabEcoar
-- Plataforma de Gamificação
-- ===================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================
-- FUNÇÃO: Trimestre atual automático (Q1-AAAA / Q2-AAAA / Q3-AAAA / Q4-AAAA)
-- ===================================
CREATE OR REPLACE FUNCTION public.current_quarter_label()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN EXTRACT(MONTH FROM NOW()) <= 3
      THEN 'Q1-' || EXTRACT(YEAR FROM NOW())::TEXT
    WHEN EXTRACT(MONTH FROM NOW()) <= 6
      THEN 'Q2-' || EXTRACT(YEAR FROM NOW())::TEXT
    WHEN EXTRACT(MONTH FROM NOW()) <= 9
      THEN 'Q3-' || EXTRACT(YEAR FROM NOW())::TEXT
    ELSE 'Q4-' || EXTRACT(YEAR FROM NOW())::TEXT
  END;
$$;

-- ===================================
-- TABELA: profiles
-- Perfis dos usuários
-- ===================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  display_name TEXT,
  cpf TEXT,
  bio TEXT,
  instagram_handle TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  
  -- Dados de gamificação
  followers_count INTEGER DEFAULT 0,
  current_category TEXT DEFAULT 'voz_e_violao',
  current_quarter TEXT DEFAULT public.current_quarter_label(),
  campaigns_participated INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas de perfil adicionais em bases já existentes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE profiles ALTER COLUMN current_quarter SET DEFAULT public.current_quarter_label();

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
  folhetim_type TEXT,
  content_formats TEXT[] DEFAULT '{}',
  content_type_other TEXT,
  expiration_value INTEGER DEFAULT 1,
  expiration_unit TEXT DEFAULT 'days' CHECK (expiration_unit IN ('hours', 'days', 'weeks')),
  posting_deadline TIMESTAMPTZ,
  delivery_deadline DATE,
  campaign_type TEXT DEFAULT 'comum',
  requires_application BOOLEAN DEFAULT false,
  profile_requirements TEXT,
  target_audience TEXT,
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
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS folhetim_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_formats TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_type_other TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expiration_value INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expiration_unit TEXT DEFAULT 'days';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS posting_deadline TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delivery_deadline DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'comum';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_application BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS profile_requirements TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_audience TEXT;

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
-- TABELA: payment_info
-- Dados bancários do usuário
-- ===================================
CREATE TABLE IF NOT EXISTS payment_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL DEFAULT 'corrente' CHECK (account_type IN ('corrente', 'poupanca')),
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  agency TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_digit TEXT NOT NULL,
  cpf TEXT NOT NULL,
  full_name TEXT NOT NULL,
  pix_key TEXT,
  pix_type TEXT DEFAULT 'cpf' CHECK (pix_type IN ('cpf', 'email', 'telefone', 'aleatoria')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'corrente';
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS bank_code TEXT;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS agency TEXT;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS account_digit TEXT;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS pix_type TEXT DEFAULT 'cpf';
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE payment_info ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_info_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE payment_info ADD CONSTRAINT payment_info_user_id_key UNIQUE (user_id);
    EXCEPTION
      WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ===================================
-- TABELA: payments
-- Histórico de pagamentos do usuário
-- ===================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metrics_submission_id UUID,
  quarter TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'voz_e_violao',
  points INTEGER NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'pago', 'erro')),
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metrics_submission_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS quarter TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'voz_e_violao';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pendente', 'processando', 'pago', 'erro'));

-- ===================================
-- TABELA: rewards
-- Catálogo de recompensas
-- ===================================
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'outros' CHECK (category IN ('alimentacao', 'educacao', 'cultura', 'bem_estar', 'tecnologia', 'outros')),
  points_required INTEGER NOT NULL CHECK (points_required > 0),
  partner_name TEXT,
  image_url TEXT,
  terms TEXT,
  validity_months INTEGER,
  quantity_available INTEGER,
  quantity_claimed INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'outros';
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS points_required INTEGER;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS validity_months INTEGER;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS quantity_available INTEGER;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS quantity_claimed INTEGER DEFAULT 0;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_category_check;
ALTER TABLE rewards
  ADD CONSTRAINT rewards_category_check
  CHECK (category IN ('alimentacao', 'educacao', 'cultura', 'bem_estar', 'tecnologia', 'outros'));

-- ===================================
-- TABELA: reward_claims
-- Resgates de recompensas dos usuários
-- ===================================
CREATE TABLE IF NOT EXISTS reward_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_title TEXT,
  user_email TEXT,
  user_name TEXT,
  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'entregue', 'cancelado', 'erro')),
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS reward_id UUID REFERENCES rewards(id) ON DELETE RESTRICT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS reward_title TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS points_spent INTEGER;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE reward_claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE reward_claims DROP CONSTRAINT IF EXISTS reward_claims_status_check;
ALTER TABLE reward_claims
  ADD CONSTRAINT reward_claims_status_check
  CHECK (status IN ('pendente', 'processando', 'entregue', 'cancelado', 'erro'));

-- ===================================
-- TABELA: forum_topics
-- Tópicos do fórum
-- ===================================
CREATE TABLE IF NOT EXISTS forum_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  is_pinned BOOLEAN DEFAULT false,
  views INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT,
  author_email TEXT,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS total_posts INTEGER DEFAULT 0;
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ===================================
-- TABELA: forum_posts
-- Respostas dos tópicos do fórum
-- ===================================
CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT,
  author_email TEXT,
  likes INTEGER DEFAULT 0,
  liked_by TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES forum_topics(id) ON DELETE CASCADE;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS liked_by TEXT[] DEFAULT '{}';
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ===================================
-- TABELA: metrics_submissions
-- Submissões de métricas das campanhas
-- ===================================
CREATE TABLE IF NOT EXISTS metrics_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_title TEXT,
  user_email TEXT,
  user_name TEXT,
  metrics_file_url TEXT,
  invoice_file_url TEXT,
  invoice_number TEXT,
  metrics_link TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  quarter TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas em bases já existentes
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS task_title TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS metrics_file_url TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS invoice_file_url TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS metrics_link TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS quarter TEXT;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE metrics_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Constraint de status para bases antigas
ALTER TABLE metrics_submissions DROP CONSTRAINT IF EXISTS metrics_submissions_status_check;
ALTER TABLE metrics_submissions
  ADD CONSTRAINT metrics_submissions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Constraint de rejeição com motivo
ALTER TABLE metrics_submissions DROP CONSTRAINT IF EXISTS metrics_submissions_rejection_reason_required;
ALTER TABLE metrics_submissions
  ADD CONSTRAINT metrics_submissions_rejection_reason_required
  CHECK (status <> 'rejected' OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0));

-- Índice de busca por usuário/tarefa e status
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_submissions_user_task_unique
  ON metrics_submissions(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_metrics_submissions_status_submitted
  ON metrics_submissions(status, submitted_at DESC);

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
ALTER TABLE metrics_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_claims ENABLE ROW LEVEL SECURITY;

-- Função helper para checar admin sem recursão de policy em profiles
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- ===================================
-- POLICIES: profiles
-- ===================================

-- Usuários podem ver seu próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Usuários podem atualizar seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins podem ver todos os perfis
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Permitir insert ao criar conta (via trigger do Supabase Auth)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ===================================
-- POLICIES: tasks
-- ===================================

-- Todos usuários autenticados podem ver tarefas ativas
DROP POLICY IF EXISTS "Users can view active tasks" ON tasks;
CREATE POLICY "Users can view active tasks"
  ON tasks FOR SELECT
  USING (status = 'active' OR public.is_admin(auth.uid()));

-- Apenas admins podem criar tarefas
DROP POLICY IF EXISTS "Admins can create tasks" ON tasks;
CREATE POLICY "Admins can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Apenas admins podem atualizar tarefas
DROP POLICY IF EXISTS "Admins can update tasks" ON tasks;
CREATE POLICY "Admins can update tasks"
  ON tasks FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Apenas admins podem deletar tarefas
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;
CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ===================================
-- POLICIES: submissions
-- ===================================

-- Usuários podem ver suas próprias submissões
DROP POLICY IF EXISTS "Users can view own submissions" ON submissions;
CREATE POLICY "Users can view own submissions"
  ON submissions FOR SELECT
  USING (user_id = auth.uid());

-- Admins podem ver todas as submissões
DROP POLICY IF EXISTS "Admins can view all submissions" ON submissions;
CREATE POLICY "Admins can view all submissions"
  ON submissions FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Usuários podem criar submissões
DROP POLICY IF EXISTS "Users can create submissions" ON submissions;
CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Usuários podem atualizar apenas suas submissões aprovadas para enviar prova
DROP POLICY IF EXISTS "Users can submit proof on approved applications" ON submissions;
CREATE POLICY "Users can submit proof on approved applications"
  ON submissions FOR UPDATE
  USING (user_id = auth.uid() AND status = 'application_approved')
  WITH CHECK (user_id = auth.uid() AND status = 'proof_pending');

-- Apenas admins podem atualizar submissões (aprovar/rejeitar)
DROP POLICY IF EXISTS "Admins can update submissions" ON submissions;
CREATE POLICY "Admins can update submissions"
  ON submissions FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- ===================================
-- POLICIES: user_scores
-- ===================================

-- Usuários podem ver sua própria pontuação
DROP POLICY IF EXISTS "Users can view own score" ON user_scores;
CREATE POLICY "Users can view own score"
  ON user_scores FOR SELECT
  USING (user_id = auth.uid());

-- Todos podem ver o ranking (para leaderboard)
DROP POLICY IF EXISTS "All users can view leaderboard" ON user_scores;
CREATE POLICY "All users can view leaderboard"
  ON user_scores FOR SELECT
  USING (true);

-- Permitir insert/update para sistema de pontos
DROP POLICY IF EXISTS "System can manage scores" ON user_scores;
CREATE POLICY "System can manage scores"
  ON user_scores FOR ALL
  USING (true)
  WITH CHECK (true);

-- ===================================
-- POLICIES: metrics_submissions
-- ===================================

-- Usuários veem suas métricas
DROP POLICY IF EXISTS "Users can view own metrics submissions" ON metrics_submissions;
CREATE POLICY "Users can view own metrics submissions"
  ON metrics_submissions FOR SELECT
  USING (user_id = auth.uid());

-- Admins veem todas métricas
DROP POLICY IF EXISTS "Admins can view all metrics submissions" ON metrics_submissions;
CREATE POLICY "Admins can view all metrics submissions"
  ON metrics_submissions FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Usuários criam suas métricas
DROP POLICY IF EXISTS "Users can create own metrics submissions" ON metrics_submissions;
CREATE POLICY "Users can create own metrics submissions"
  ON metrics_submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Usuários atualizam suas métricas apenas quando rejeitadas (reenvio)
DROP POLICY IF EXISTS "Users can update rejected metrics submissions" ON metrics_submissions;
CREATE POLICY "Users can update rejected metrics submissions"
  ON metrics_submissions FOR UPDATE
  USING (user_id = auth.uid() AND status = 'rejected')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Admins aprovam/rejeitam métricas
DROP POLICY IF EXISTS "Admins can update metrics submissions" ON metrics_submissions;
CREATE POLICY "Admins can update metrics submissions"
  ON metrics_submissions FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- ===================================
-- POLICIES: forum_topics
-- ===================================

DROP POLICY IF EXISTS "Authenticated users can view forum topics" ON forum_topics;
CREATE POLICY "Authenticated users can view forum topics"
  ON forum_topics FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can create forum topics" ON forum_topics;
DROP POLICY IF EXISTS "Admins can create forum topics" ON forum_topics;
CREATE POLICY "Authenticated users can create forum topics"
  ON forum_topics FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can update forum topics" ON forum_topics;
CREATE POLICY "Admins can update forum topics"
  ON forum_topics FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete forum topics" ON forum_topics;
CREATE POLICY "Admins can delete forum topics"
  ON forum_topics FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ===================================
-- POLICIES: forum_posts
-- ===================================

DROP POLICY IF EXISTS "Authenticated users can view forum posts" ON forum_posts;
CREATE POLICY "Authenticated users can view forum posts"
  ON forum_posts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can create forum posts" ON forum_posts;
CREATE POLICY "Authenticated users can create forum posts"
  ON forum_posts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update forum posts" ON forum_posts;
CREATE POLICY "Authenticated users can update forum posts"
  ON forum_posts FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can delete forum posts" ON forum_posts;
CREATE POLICY "Admins can delete forum posts"
  ON forum_posts FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ===================================
-- POLICIES: payment_info
-- ===================================

DROP POLICY IF EXISTS "Users can view own payment info" ON payment_info;
CREATE POLICY "Users can view own payment info"
  ON payment_info FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own payment info" ON payment_info;
CREATE POLICY "Users can create own payment info"
  ON payment_info FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own payment info" ON payment_info;
CREATE POLICY "Users can update own payment info"
  ON payment_info FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all payment info" ON payment_info;
CREATE POLICY "Admins can view all payment info"
  ON payment_info FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ===================================
-- POLICIES: payments
-- ===================================

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can create payments" ON payments;
CREATE POLICY "Admins can create payments"
  ON payments FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update payments" ON payments;
CREATE POLICY "Admins can update payments"
  ON payments FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete payments" ON payments;
CREATE POLICY "Admins can delete payments"
  ON payments FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ===================================
-- POLICIES: rewards
-- ===================================

DROP POLICY IF EXISTS "Users can view active rewards" ON rewards;
CREATE POLICY "Users can view active rewards"
  ON rewards FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can create rewards" ON rewards;
CREATE POLICY "Admins can create rewards"
  ON rewards FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update rewards" ON rewards;
CREATE POLICY "Admins can update rewards"
  ON rewards FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete rewards" ON rewards;
CREATE POLICY "Admins can delete rewards"
  ON rewards FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ===================================
-- POLICIES: reward_claims
-- ===================================

DROP POLICY IF EXISTS "Users can view own reward claims" ON reward_claims;
CREATE POLICY "Users can view own reward claims"
  ON reward_claims FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own reward claims" ON reward_claims;
CREATE POLICY "Users can create own reward claims"
  ON reward_claims FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all reward claims" ON reward_claims;
CREATE POLICY "Admins can view all reward claims"
  ON reward_claims FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update reward claims" ON reward_claims;
CREATE POLICY "Admins can update reward claims"
  ON reward_claims FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete reward claims" ON reward_claims;
CREATE POLICY "Admins can delete reward claims"
  ON reward_claims FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ===================================
-- FUNÇÃO RPC: Resgatar recompensa
-- Atualiza claim + saldo de pontos + estoque de forma transacional
-- ===================================

CREATE OR REPLACE FUNCTION public.claim_reward(p_reward_id UUID)
RETURNS reward_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reward rewards%ROWTYPE;
  v_points INTEGER;
  v_claim reward_claims%ROWTYPE;
  v_profile profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_reward
  FROM rewards
  WHERE id = p_reward_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recompensa não encontrada ou inativa';
  END IF;

  IF v_reward.quantity_available IS NOT NULL
     AND COALESCE(v_reward.quantity_claimed, 0) >= v_reward.quantity_available THEN
    RAISE EXCEPTION 'Recompensa esgotada';
  END IF;

  INSERT INTO user_scores (user_id, total_points, tasks_completed)
  VALUES (v_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT total_points INTO v_points
  FROM user_scores
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF COALESCE(v_points, 0) < v_reward.points_required THEN
    RAISE EXCEPTION 'Pontos insuficientes';
  END IF;

  SELECT * INTO v_profile
  FROM profiles
  WHERE id = v_user_id;

  INSERT INTO reward_claims (
    reward_id,
    user_id,
    reward_title,
    user_email,
    user_name,
    points_spent,
    status,
    claimed_at
  )
  VALUES (
    v_reward.id,
    v_user_id,
    v_reward.title,
    v_profile.email,
    COALESCE(v_profile.display_name, v_profile.full_name, v_profile.email),
    v_reward.points_required,
    'pendente',
    NOW()
  )
  RETURNING * INTO v_claim;

  UPDATE user_scores
  SET
    total_points = COALESCE(total_points, 0) - v_reward.points_required,
    updated_at = NOW()
  WHERE user_id = v_user_id;

  UPDATE rewards
  SET
    quantity_claimed = COALESCE(quantity_claimed, 0) + 1,
    updated_at = NOW()
  WHERE id = v_reward.id;

  RETURN v_claim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_reward(UUID) TO authenticated;

-- ===================================
-- POLICIES: Storage (submissions bucket)
-- ===================================

-- Permitir upload para usuários autenticados
DROP POLICY IF EXISTS "Users can upload own submissions" ON storage.objects;
CREATE POLICY "Users can upload own submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submissions' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Permitir leitura pública (para admins validarem)
DROP POLICY IF EXISTS "Public can view submissions" ON storage.objects;
CREATE POLICY "Public can view submissions"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'submissions');

-- Permitir delete apenas do próprio arquivo
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
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

-- Trigger para metrics_submissions
DROP TRIGGER IF EXISTS update_metrics_submissions_updated_at ON metrics_submissions;
CREATE TRIGGER update_metrics_submissions_updated_at
  BEFORE UPDATE ON metrics_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para forum_topics
DROP TRIGGER IF EXISTS update_forum_topics_updated_at ON forum_topics;
CREATE TRIGGER update_forum_topics_updated_at
  BEFORE UPDATE ON forum_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para forum_posts
DROP TRIGGER IF EXISTS update_forum_posts_updated_at ON forum_posts;
CREATE TRIGGER update_forum_posts_updated_at
  BEFORE UPDATE ON forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para payment_info
DROP TRIGGER IF EXISTS update_payment_info_updated_at ON payment_info;
CREATE TRIGGER update_payment_info_updated_at
  BEFORE UPDATE ON payment_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para payments
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para rewards
DROP TRIGGER IF EXISTS update_rewards_updated_at ON rewards;
CREATE TRIGGER update_rewards_updated_at
  BEFORE UPDATE ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para reward_claims
DROP TRIGGER IF EXISTS update_reward_claims_updated_at ON reward_claims;
CREATE TRIGGER update_reward_claims_updated_at
  BEFORE UPDATE ON reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- TRIGGER: Atualizar contadores do tópico automaticamente
-- (SECURITY DEFINER ignora RLS — funciona para qualquer usuário)
-- ===================================

-- Função chamada ao inserir um post: incrementa total_posts e last_activity
CREATE OR REPLACE FUNCTION public.handle_forum_post_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE forum_topics
  SET
    total_posts  = COALESCE(total_posts, 0) + 1,
    last_activity = NOW()
  WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$;

-- Função chamada ao deletar um post: decrementa total_posts
CREATE OR REPLACE FUNCTION public.handle_forum_post_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE forum_topics
  SET total_posts = GREATEST(0, COALESCE(total_posts, 1) - 1)
  WHERE id = OLD.topic_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_forum_post_insert ON forum_posts;
CREATE TRIGGER on_forum_post_insert
  AFTER INSERT ON forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_forum_post_insert();

DROP TRIGGER IF EXISTS on_forum_post_delete ON forum_posts;
CREATE TRIGGER on_forum_post_delete
  AFTER DELETE ON forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_forum_post_delete();

-- ===================================
-- FUNÇÃO RPC: Incrementar visualizações do tópico
-- (SECURITY DEFINER ignora RLS — qualquer usuário autenticado pode chamar)
-- ===================================

CREATE OR REPLACE FUNCTION public.increment_forum_topic_views(p_topic_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE forum_topics
  SET views = COALESCE(views, 0) + 1
  WHERE id = p_topic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_forum_topic_views(UUID) TO authenticated;

-- ===================================
-- FUNÇÃO RPC: Incrementar contador de posts do tópico
-- ===================================

CREATE OR REPLACE FUNCTION public.increment_forum_topic_posts(p_topic_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE forum_topics
  SET
    total_posts   = COALESCE(total_posts, 0) + 1,
    last_activity = NOW()
  WHERE id = p_topic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_forum_topic_posts(UUID) TO authenticated;

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
CREATE INDEX IF NOT EXISTS idx_metrics_submissions_user_id ON metrics_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_submissions_task_id ON metrics_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_user_scores_points ON user_scores(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_forum_topics_category ON forum_topics(category);
CREATE INDEX IF NOT EXISTS idx_forum_topics_last_activity ON forum_topics(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic_id ON forum_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_info_user_id ON payment_info(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_quarter ON payments(quarter);
CREATE INDEX IF NOT EXISTS idx_rewards_active_points ON rewards(is_active, points_required DESC);
CREATE INDEX IF NOT EXISTS idx_reward_claims_user_id ON reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_status ON reward_claims(status);
CREATE INDEX IF NOT EXISTS idx_reward_claims_claimed_at ON reward_claims(claimed_at DESC);

-- ===================================
-- FIM DO SCHEMA
-- ===================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Schema LabEcoar criado com sucesso!';
  RAISE NOTICE '📋 Tabelas: profiles, tasks, submissions, metrics_submissions, forum_topics, forum_posts, user_scores, payment_info, payments, rewards, reward_claims';
  RAISE NOTICE '🔒 RLS policies ativadas';
  RAISE NOTICE '📁 Storage bucket: submissions';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Próximos passos:';
  RAISE NOTICE '1. Criar usuário via signup';
  RAISE NOTICE '2. Atualizar role para admin: UPDATE profiles SET role = ''admin'' WHERE email = ''seu@email.com'';';
  RAISE NOTICE '3. Testar a aplicação!';
END $$;
