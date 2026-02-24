import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_SECONDS = 60

const isValidEmail = (value) => EMAIL_REGEX.test(value.trim())

export default function Login() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotInfo, setForgotInfo] = useState('')
  const [forgotCooldown, setForgotCooldown] = useState(0)
  const [showResendButton, setShowResendButton] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, resetPassword } = useAuth()

  useEffect(() => {
    if (forgotCooldown <= 0 && resendCooldown <= 0) return

    const timer = setInterval(() => {
      setForgotCooldown((current) => (current > 0 ? current - 1 : 0))
      setResendCooldown((current) => (current > 0 ? current - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [forgotCooldown, resendCooldown])

  useEffect(() => {
    setShowResendButton(false)
    setShowForgotModal(false)
    setRecoveryEmail('')
    setForgotError('')
    setForgotInfo('')
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
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setError('Informe o email para reenviar a confirmação.')
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      setError('Digite um email válido.')
      return
    }

    if (resendCooldown > 0) {
      setError(`Aguarde ${resendCooldown}s para reenviar novamente.`)
      return
    }

    setResendLoading(true)
    setError('')
    setInfo('')

    try {
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
      })

      if (error) throw error
      setInfo('Email de confirmação reenviado! Verifique sua caixa de entrada.')
      setShowResendButton(false)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      console.error('Erro ao reenviar email:', err)
      setError('Não foi possível reenviar o email. Tente novamente.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleOpenForgotModal = () => {
    setError('')
    setInfo('')
    setForgotError('')
    setForgotInfo('')
    setRecoveryEmail(email || '')
    setShowForgotModal(true)
  }

  const handleForgotPassword = async () => {
    const normalizedEmail = recoveryEmail.trim()

    if (!normalizedEmail) {
      setForgotError('Informe seu email para recuperar a senha.')
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      setForgotError('Digite um email válido.')
      return
    }

    if (forgotCooldown > 0) {
      setForgotError(`Aguarde ${forgotCooldown}s para reenviar novamente.`)
      return
    }

    setForgotLoading(true)
    setForgotError('')
    setForgotInfo('')

    try {
      await resetPassword(normalizedEmail)
      setForgotInfo('Se o email estiver cadastrado, você receberá um link de recuperação.')
      setForgotCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      console.error('Erro ao recuperar senha:', err)
      setForgotError('Nao foi possivel enviar agora. Tente novamente em instantes.')
    } finally {
      setForgotLoading(false)
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
        if (!isValidEmail(email)) {
          setError('Digite um email válido.')
          return
        }
        await signIn(email, password)
        navigate('/Dashboard')
        return
      }

      if (!isValidEmail(email)) {
        setError('Digite um email válido.')
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

      const errorMessage = err?.message?.toLowerCase?.() || ''

      if (errorMessage.includes('rate limit') || errorMessage.includes('rate_limit')) {
        setError('Muitas tentativas de email. Aguarde alguns minutos e tente novamente.')
        return
      }

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
              disabled={resendLoading || resendCooldown > 0}
              className="w-full bg-amber-500 text-white py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendLoading
                ? 'Reenviando...'
                : resendCooldown > 0
                  ? `Aguarde (${resendCooldown}s)`
                  : '📧 Reenviar email de confirmação'}
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
          {mode === 'login' && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={handleOpenForgotModal}
                disabled={forgotLoading || loading || forgotCooldown > 0}
                className="text-sm text-black hover:text-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {forgotCooldown > 0 ? `Esqueceu a senha? (${forgotCooldown}s)` : 'Esqueceu a senha?'}
              </button>
            </div>
          )}
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

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-emerald-700 text-center mb-2">Recuperar senha</h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              Digite seu email para receber o link de recuperação.
            </p>

            {forgotError && (
              <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg mb-3 border border-red-200 text-sm">
                {forgotError}
              </div>
            )}

            {forgotInfo && (
              <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg mb-3 border border-emerald-200 text-sm">
                {forgotInfo}
              </div>
            )}

            <input
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="seu@email.com"
              disabled={forgotLoading}
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotLoading || forgotCooldown > 0}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {forgotLoading ? 'Enviando...' : forgotCooldown > 0 ? `Aguarde (${forgotCooldown}s)` : 'Enviar'}
              </button>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                disabled={forgotLoading}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
