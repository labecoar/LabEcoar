import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authService } from '@/services/auth.service'

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  isProfileComplete: false,
  signIn: async (_email, _password) => null,
  signInWithGoogle: async () => null,
  signUp: async (_email, _password, _userData) => null,
  resetPassword: async (_email) => null,
  signOut: async () => null,
  updateProfile: async (_updates) => null,
  refreshProfile: async () => null,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Buscar perfil do usuário
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Erro ao buscar perfil:', error)
      setProfile(null)
    }
  }

  // Inicializar autenticação
  useEffect(() => {
    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsAuthenticated(!!session?.user)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
    }).catch((err) => {
      console.error('[AuthContext] Erro ao verificar sessão:', err)
    }).finally(() => {
      setLoading(false)
    })

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setIsAuthenticated(!!session?.user)

        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Função de login
  const signIn = async (email, password) => {
    const data = await authService.signIn(email, password)
    return data
  }

  // Função de registro
  const signUp = async (email, password, userData) => {
    const data = await authService.signUp(email, password, userData)
    return data
  }

  // Função de login com Google
  const signInWithGoogle = async () => {
    const data = await authService.signInWithGoogle()
    return data
  }

  // Recuperação de senha
  const resetPassword = async (email) => {
    const data = await authService.resetPassword(email)
    return data
  }

  // Função de logout
  const signOut = async () => {
    await authService.signOut()
    setUser(null)
    setProfile(null)
    setIsAuthenticated(false)
  }

  // Atualizar perfil
  const updateProfile = async (updates) => {
    if (!user) throw new Error('Usuário não autenticado')
    const data = await authService.updateProfile(user.id, user.email, updates)
    setProfile(data)
    return data
  }

  // Verificar se é admin
  const isAdmin = profile?.role === 'admin'
  const isProfileComplete = Boolean(
    profile
    && (profile.display_name || profile.full_name)
    && String(profile.cpf || '').trim()
    && String(profile.instagram_handle || '').trim()
    && profile.followers_count !== null
    && profile.followers_count !== undefined
  )

  const value = {
    user,
    profile,
    loading,
    isAuthenticated,
    isAdmin,
    isProfileComplete,
    signIn,
    signInWithGoogle,
    signUp,
    resetPassword,
    signOut,
    updateProfile,
    refreshProfile: () => user ? fetchProfile(user.id) : null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
