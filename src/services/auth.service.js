import { supabase } from '@/lib/supabase'

const getAuthRedirectUrl = () => {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL
  if (configured && String(configured).trim()) {
    return String(configured).trim().replace(/\/$/, '') + '/'
  }
  return `${window.location.origin}/`
}

/**
 * Serviço de Autenticação
 */
export const authService = {
  /**
   * Obter usuário atual com perfil
   */
  async getCurrentUser() {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Usuário não autenticado')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError)
      return { ...user, profile: null }
    }

    return {
      ...user,
      profile
    }
  },

  /**
   * Login com email e senha
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  },

  /**
   * Login com Google OAuth
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) throw error
    return data
  },

  /**
   * Registrar novo usuário
   */
  async signUp(email, password, userData = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: getAuthRedirectUrl(),
      }
    })

    if (error) throw error
    return data
  },

  /**
   * Enviar email de recuperação de senha
   */
  async resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAuthRedirectUrl()}ResetPassword`,
    })

    if (error) throw error
    return data
  },

  /**
   * Reenviar email de confirmação de cadastro
   */
  async resendSignupConfirmation(email) {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    })

    if (error) throw error
    return data
  },

  /**
   * Logout
   */
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  /**
   * Atualizar perfil do usuário
   */
  async updateProfile(userId, userEmail, updates) {
    const payload = {
      id: userId,
      email: userEmail,
      ...updates,
      updated_at: new Date().toISOString(),
    }

    // Compatibilidade com schemas antigos: se não houver display_name,
    // manter pelo menos full_name atualizado.
    if (!payload.full_name && typeof payload.display_name === 'string' && payload.display_name.trim() !== '') {
      payload.full_name = payload.display_name.trim()
    }

    let mutablePayload = { ...payload }

    while (true) {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(mutablePayload, { onConflict: 'id' })
        .select()
        .single()

      if (!error) return data

      const message = String(error.message || '')

      // Postgres error: column "x" of relation "profiles" does not exist
      const postgresMissingColumn = message.match(/column\s+"([^"]+)"\s+of\s+relation\s+"profiles"\s+does\s+not\s+exist/i)
      // PostgREST error: Could not find the 'x' column of 'profiles' in the schema cache
      const postgrestMissingColumn = message.match(/Could not find the '([^']+)' column of 'profiles'/i)
      const missingColumn = postgresMissingColumn?.[1] || postgrestMissingColumn?.[1]

      if (missingColumn && missingColumn in mutablePayload && missingColumn !== 'id') {
        delete mutablePayload[missingColumn]
        continue
      }

      throw error
    }
  }
}
