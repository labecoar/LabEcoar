-- Aprovação de roteiro (campanhas): etapa entre seleção e envio da prova

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS script_url TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS script_description TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS script_submitted_at TIMESTAMPTZ;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_status_check
  CHECK (status IN (
    'application_pending',
    'application_approved',
    'application_rejected',
    'script_pending',
    'script_approved',
    'script_rejected',
    'proof_pending',
    'approved',
    'rejected',
    'pending'
  ));

ALTER TABLE submission_approval_history DROP CONSTRAINT IF EXISTS submission_approval_history_action_check;
ALTER TABLE submission_approval_history
  ADD CONSTRAINT submission_approval_history_action_check
  CHECK (action IN ('application_approved', 'script_approved', 'proof_approved'));

-- Ecoante envia roteiro (campanha)
DROP POLICY IF EXISTS "Users can submit script on approved applications" ON submissions;
CREATE POLICY "Users can submit script on approved applications"
  ON submissions FOR UPDATE
  USING (
    user_id = auth.uid()
    AND status IN ('application_approved', 'script_rejected')
    AND EXISTS (
      SELECT 1
      FROM tasks t
      WHERE t.id = submissions.task_id
        AND t.category = 'campanha'
    )
  )
  WITH CHECK (user_id = auth.uid() AND status = 'script_pending');

-- Ecoante envia prova
DROP POLICY IF EXISTS "Users can submit proof on approved applications" ON submissions;
CREATE POLICY "Users can submit proof on approved applications"
  ON submissions FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (
      (
        status IN ('script_approved', 'rejected')
        AND EXISTS (
          SELECT 1
          FROM tasks t
          WHERE t.id = submissions.task_id
            AND t.category = 'campanha'
        )
      )
      OR (
        status IN ('application_approved', 'rejected')
        AND EXISTS (
          SELECT 1
          FROM tasks t
          WHERE t.id = submissions.task_id
            AND t.category <> 'campanha'
            AND t.category <> 'sidequest_teste'
        )
      )
      OR (
        status IN ('application_pending', 'application_approved', 'rejected')
        AND EXISTS (
          SELECT 1
          FROM tasks t
          WHERE t.id = submissions.task_id
            AND t.category = 'sidequest_teste'
        )
      )
    )
  )
  WITH CHECK (user_id = auth.uid() AND status = 'proof_pending');
