-- Copia os dados de cadastro salvos no user_metadata para a tabela profiles
-- ao criar a conta (inclui cadastro por e-mail com confirmação posterior).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_followers INTEGER;
BEGIN
  v_followers := NULL;

  IF NEW.raw_user_meta_data ? 'followers_count'
    AND NEW.raw_user_meta_data->>'followers_count' ~ '^-?\d+$' THEN
    v_followers := (NEW.raw_user_meta_data->>'followers_count')::INTEGER;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    cpf,
    bio,
    instagram_handle,
    followers_count,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      NEW.email
    ),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'cpf'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'bio'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'instagram_handle'), ''),
    v_followers,
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
