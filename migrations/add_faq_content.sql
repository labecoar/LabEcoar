-- FAQ editável pelo admin (conteúdo em JSONB)
CREATE TABLE IF NOT EXISTS faq_content (
  id TEXT PRIMARY KEY DEFAULT 'main',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE faq_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read faq content" ON faq_content;
CREATE POLICY "Authenticated users can read faq content"
  ON faq_content FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert faq content" ON faq_content;
CREATE POLICY "Admins can insert faq content"
  ON faq_content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update faq content" ON faq_content;
CREATE POLICY "Admins can update faq content"
  ON faq_content FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete faq content" ON faq_content;
CREATE POLICY "Admins can delete faq content"
  ON faq_content FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

INSERT INTO faq_content (id, sections)
VALUES ('main', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
