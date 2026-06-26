-- Data/hora em que o ecoante enviou a prova (início da contagem de 5 dias para métricas)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS proof_submitted_at TIMESTAMPTZ;

-- Backfill: usar validated_at (aprovação da prova) como aproximação para submissões já aprovadas
UPDATE submissions
SET proof_submitted_at = validated_at
WHERE proof_submitted_at IS NULL
  AND status = 'approved'
  AND validated_at IS NOT NULL;
