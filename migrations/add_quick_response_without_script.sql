-- Resposta Rápida: envio de conteúdo direto após aprovação da candidatura.

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
        AND COALESCE(t.campaign_type, 'comum') <> 'resposta_rapida'
    )
  )
  WITH CHECK (user_id = auth.uid() AND status = 'script_pending');

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
            AND COALESCE(t.campaign_type, 'comum') <> 'resposta_rapida'
        )
      )
      OR (
        status IN ('application_approved', 'rejected')
        AND EXISTS (
          SELECT 1
          FROM tasks t
          WHERE t.id = submissions.task_id
            AND (
              (t.category = 'campanha' AND t.campaign_type = 'resposta_rapida')
              OR (t.category <> 'campanha' AND t.category <> 'sidequest_teste')
            )
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
