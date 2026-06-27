import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock } from 'lucide-react'
import logoCuica from '@/assets/images/cuica_login.png'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const isRecoveryHash = () => {
  const hash = window.location.hash?.substring(1) || ''
  if (!hash) return false
  return new URLSearchParams(hash).get('type') === 'recovery'
}

export default function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isPasswordRecovery, clearPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Captura erros do hash (link expirado, etc.)
  useEffect(() => {
    const hash = location.hash || ''
    if (!hash.includes('error=')) return

    const params = new URLSearchParams(hash.substring(1))
    const errorCode = params.get('error_code')
    const errorDesc = params.get('error_description')

    if (errorCode === 'otp_expired') {
      setError('Link de recuperação expirado. Solicite um novo email de recuperação.')
    } else if (errorDesc) {
      setError(decodeURIComponent(errorDesc))
    }

    window.history.replaceState(null, '', window.location.pathname)
  }, [location])

  // Aguarda o Supabase confirmar a sessão de recovery
  useEffect(() => {
    if (isPasswordRecovery || isRecoveryHash()) {
      setSessionReady(true)
      setError('')
      return undefined
    }

    let cancelled = false

    const verifyRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      if (session?.user && isRecoveryHash()) {
        setSessionReady(true)
        setError('')
      }
    }

    verifyRecoverySession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
        setError('')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [isPasswordRecovery])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')

    if (password.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setInfo('Senha atualizada com sucesso. Redirecionando para o login...')
      clearPasswordRecovery()
      await supabase.auth.signOut()

      setTimeout(() => {
        navigate('/Login', { replace: true })
      }, 2500)
    } catch (submitError) {
      const message = String(submitError?.message || '').toLowerCase()
      if (message.includes('session') || message.includes('jwt') || message.includes('token')) {
        setError('Sessão de recuperação inválida. Abra novamente o link enviado por email.')
      } else {
        setError('Não foi possível atualizar a senha. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f5] p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-[0_15px_35px_rgba(15,23,42,0.08)] p-7 sm:p-8">
        <div className="text-center mb-6">
          <img src={logoCuica} alt="CuicaLab" className="w-48 h-48 mx-auto mb-2 object-contain" />
          <h1 className="text-3xl font-bold text-slate-900">Redefinir senha</h1>
          <p className="text-sm text-slate-500 mt-1">Digite sua nova senha para concluir</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 border border-red-200 text-sm">
            {error}
          </div>
        )}

        {info && (
          <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg mb-4 border border-emerald-200 text-sm">
            {info}
          </div>
        )}

        {/* Aguardando validação do token */}
        {!sessionReady && !error && (
          <div className="text-center text-slate-400 text-sm py-6">
            Validando link de recuperação...
          </div>
        )}

        {/* Form só aparece com sessão válida */}
        {sessionReady && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nova senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 h-11 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13203f] focus:border-transparent"
                  placeholder="Digite a nova senha"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar nova senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-10 h-11 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13203f] focus:border-transparent"
                  placeholder="Confirme a nova senha"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#0f1833] text-white rounded-lg font-semibold hover:bg-[#1a274f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>

            <button
              type="button"
              onClick={() => {
                clearPasswordRecovery()
                navigate('/Login')
              }}
              className="w-full h-11 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Voltar ao login
            </button>
          </form>
        )}

        {/* Botão de voltar quando há erro e sem sessão */}
        {error && !sessionReady && (
          <button
            type="button"
            onClick={() => {
              clearPasswordRecovery()
              navigate('/Login')
            }}
            className="w-full mt-4 h-11 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Voltar ao login
          </button>
        )}
      </div>
    </div>
  )
}