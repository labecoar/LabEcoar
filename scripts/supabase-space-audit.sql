-- Auditoria de espaco LabEcoar (somente leitura)
-- Execute no Supabase SQL Editor

-- 1) Tamanho total do banco
SELECT
  pg_size_pretty(pg_database_size(current_database())) AS db_total,
  pg_database_size(current_database()) AS db_total_bytes;

-- 2) Tabelas mais pesadas (dados + indices)
SELECT
  schemaname,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || relname)) AS data_size,
  pg_size_pretty(pg_indexes_size(schemaname || '.' || relname)) AS index_size,
  pg_total_relation_size(schemaname || '.' || relname) AS total_bytes
FROM pg_stat_user_tables
ORDER BY total_bytes DESC;

-- 3) Tamanho do bucket submissions
SELECT
  bucket_id,
  COUNT(*) AS files,
  pg_size_pretty(COALESCE(SUM((metadata->>'size')::bigint), 0)) AS bucket_size,
  COALESCE(SUM((metadata->>'size')::bigint), 0) AS bucket_size_bytes
FROM storage.objects
WHERE bucket_id = 'submissions'
GROUP BY bucket_id;

-- 4) Top 30 maiores arquivos
SELECT
  name,
  pg_size_pretty((metadata->>'size')::bigint) AS file_size,
  (metadata->>'size')::bigint AS file_size_bytes,
  created_at
FROM storage.objects
WHERE bucket_id = 'submissions'
ORDER BY (metadata->>'size')::bigint DESC NULLS LAST
LIMIT 30;

-- 5) Arquivos sem referencia (orfaos)
WITH referenced_paths AS (
  SELECT split_part(regexp_replace(proof_url, '^.*?/storage/v1/object/public/submissions/', ''), '?', 1) AS path
  FROM public.submissions
  WHERE proof_url IS NOT NULL AND length(trim(proof_url)) > 0

  UNION

  SELECT split_part(regexp_replace(metrics_file_url, '^.*?/storage/v1/object/public/submissions/', ''), '?', 1) AS path
  FROM public.metrics_submissions
  WHERE metrics_file_url IS NOT NULL AND length(trim(metrics_file_url)) > 0

  UNION

  SELECT split_part(regexp_replace(invoice_file_url, '^.*?/storage/v1/object/public/submissions/', ''), '?', 1) AS path
  FROM public.metrics_submissions
  WHERE invoice_file_url IS NOT NULL AND length(trim(invoice_file_url)) > 0

  UNION

  SELECT split_part(regexp_replace(avatar_url, '^.*?/storage/v1/object/public/submissions/', ''), '?', 1) AS path
  FROM public.profiles
  WHERE avatar_url IS NOT NULL AND length(trim(avatar_url)) > 0
)
SELECT
  o.name AS orphan_path,
  pg_size_pretty((o.metadata->>'size')::bigint) AS orphan_size,
  (o.metadata->>'size')::bigint AS orphan_size_bytes,
  o.created_at
FROM storage.objects o
LEFT JOIN referenced_paths r ON r.path = o.name
WHERE o.bucket_id = 'submissions'
  AND (r.path IS NULL OR r.path = '')
ORDER BY orphan_size_bytes DESC NULLS LAST;
