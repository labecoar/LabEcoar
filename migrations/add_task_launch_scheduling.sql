-- Agendamento de lançamento de tarefas
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS launch_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS launch_email_sent BOOLEAN NOT NULL DEFAULT false;

-- Campanhas já existentes não devem receber e-mail duplicado ao ativar o cron
UPDATE tasks
SET launch_email_sent = true
WHERE category = 'campanha'
  AND launch_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_launch_at ON tasks(launch_at)
  WHERE launch_at IS NOT NULL;

COMMENT ON COLUMN tasks.launch_at IS 'Data/hora em que a tarefa fica disponível para participação';
COMMENT ON COLUMN tasks.launch_email_sent IS 'Indica se o e-mail de nova campanha já foi enviado';
