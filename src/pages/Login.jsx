import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResendButton, setShowResendButton] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp } = useAuth()

  useEffect(() => {
    setShowResendButton(false)
    setError('')
    setInfo('')
  }, [mode])

  // Verificar erros na URL (ex: link de confirmação expirado)
  useEffect(() => {
    const hash = location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1))
      const errorCode = params.get('error_code')
      const errorDesc = params.get('error_description')
      
      if (errorCode === 'otp_expired') {
        setError('Link de confirmação expirado. Crie uma nova conta ou solicite novo link.')
      } else if (errorDesc) {
        setError(decodeURIComponent(errorDesc))
      }
      
      // Limpar hash da URL
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [location])

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Informe o email para reenviar a confirmacao.')
      return
    }
    setResendLoading(true)
    setError('')
    setInfo('')
    
    try {
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })
      
      if (error) throw error
      setInfo('Email de confirmação reenviado! Verifique sua caixa de entrada.')
      setShowResendButton(false)
    } catch (err) {
      console.error('Erro ao reenviar email:', err)
      setError('Não foi possível reenviar o email. Tente novamente.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setShowResendButton(false)
    setLoading(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/Dashboard')
        return
      }

      if (password !== confirmPassword) {
        setError('As senhas nao conferem')
        return
      }

      const data = await signUp(email, password, { full_name: name })
      if (data?.session) {
        navigate('/Dashboard')
      } else {
        setInfo('Conta criada. Verifique seu email para confirmar o cadastro.')
      }
    } catch (err) {
      console.error('Erro na autenticacao:', err)
      
      // Verificar se o erro é de email não confirmado
      if (err.message?.includes('Email not confirmed')) {
        setError('Email não confirmado. Verifique sua caixa de entrada ou clique em reenviar.')
        setShowResendButton(true)
      } else {
        setError('Nao foi possivel concluir. Verifique os dados e tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🌿</div>
          <h1 className="text-3xl font-bold text-emerald-700">LabEcoar</h1>
          {/* <p className="text-gray-600 mt-2">Plataforma de Gamificacao</p> */}
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-emerald-700 text-center">
            {mode === 'login' ? '' : 'Criar conta'}
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 border border-red-200">
            {error}
          </div>
        )}

        {info && (
          <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg mb-4 border border-emerald-200">
            {info}
          </div>
        )}

        {mode === 'login' && showResendButton && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading}
              className="w-full bg-amber-500 text-white py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendLoading ? 'Reenviando...' : '📧 Reenviar email de confirmação'}
            </button>
            <p className="mt-2 text-xs text-amber-700 text-center">
              Não recebeu? Confira o spam ou tente reenviar.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Seu nome"
                required
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="seu@email.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => setMode('signup')}
              className="text-emerald-700 hover:text-emerald-800 font-medium"
            >
              Não tem conta? <span className="text-amber-600">Cadastre-se</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-emerald-700 hover:text-emerald-800 font-medium"
            >
              Já tem conta? Entrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
