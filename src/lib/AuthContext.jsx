import React, { createContext, useState, useContext, useEffect } from 'react'
import { supabase } from '@/api/base44Client'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    checkUserAuth()

    // Listen untuk auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
          setIsAuthenticated(true)
        } else {
          setUser(null)
          setProfile(null)
          setIsAuthenticated(false)
        }
        setIsLoadingAuth(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setProfile(data)
    } catch (error) {
      console.error('Erro ao buscar perfil:', error)
      setProfile(null)
    }
  }

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
        setIsAuthenticated(true)
        setAuthError(null)
      } else {
        setIsAuthenticated(false)
        setAuthError({
          type: 'auth_required',
          message: 'Autenticação necessária'
        })
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error)
      setAuthError({
        type: 'unknown',
        message: error.message || 'Erro ao verificar autenticação'
      })
    } finally {
      setIsLoadingAuth(false)
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setIsAuthenticated(false)
      // Redirecionar para login
      window.location.href = '/login'
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  const navigateToLogin = () => {
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false, // Para compatibilidade
      authError,
      appPublicSettings: null, // Para compatibilidade
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
