-- Barra de progresso grupal: meta com 15% de folga (1500 × ecoantes × 0,85)
-- collective_points continua sendo a soma bruta de submissões aprovadas (resgates não descontam)

CREATE OR REPLACE FUNCTION public.get_group_progress_stats(p_quarter_key TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_q INTEGER;
  v_year INTEGER;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_active_ecoantes INTEGER;
  v_collective BIGINT;
  v_active_in_quarter INTEGER;
  v_target BIGINT;
  v_pct NUMERIC;
BEGIN
  v_key := COALESCE(NULLIF(TRIM(p_quarter_key), ''), public.current_quarter_label());

  IF v_key !~ '^Q[1-4]-[0-9]{4}$' THEN
    v_key := public.current_quarter_label();
  END IF;

  v_q := SUBSTRING(v_key FROM 2 FOR 1)::INTEGER;
  v_year := SUBSTRING(v_key FROM 4)::INTEGER;
  v_start := make_timestamptz(v_year, (v_q - 1) * 3 + 1, 1, 0, 0, 0, 'UTC');
  v_end := v_start + INTERVAL '3 months';

  SELECT COUNT(*)::INTEGER
  INTO v_active_ecoantes
  FROM profiles
  WHERE is_active IS NOT FALSE
    AND COALESCE(role, 'user') <> 'admin'
    AND deleted_at IS NULL;

  SELECT
    COALESCE(SUM(s.points_awarded), 0)::BIGINT,
    COUNT(DISTINCT s.user_id)::INTEGER
  INTO v_collective, v_active_in_quarter
  FROM submissions s
  INNER JOIN profiles p ON p.id = s.user_id
  WHERE s.status = 'approved'
    AND s.validated_at IS NOT NULL
    AND s.validated_at >= v_start
    AND s.validated_at < v_end
    AND p.is_active IS NOT FALSE
    AND COALESCE(p.role, 'user') <> 'admin'
    AND p.deleted_at IS NULL;

  v_target := ROUND(v_active_ecoantes * 1500 * 0.85)::BIGINT;
  v_pct := CASE
    WHEN v_target > 0 THEN LEAST(v_collective::NUMERIC / v_target * 100, 100)
    ELSE 0
  END;

  RETURN json_build_object(
    'quarter_key', v_key,
    'active_ecoantes', v_active_ecoantes,
    'active_in_quarter', v_active_in_quarter,
    'collective_points', v_collective,
    'target_points', v_target,
    'progress_percentage', v_pct
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_progress_stats(TEXT) TO authenticated;
