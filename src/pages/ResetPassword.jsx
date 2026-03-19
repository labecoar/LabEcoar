import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock } from 'lucide-react'
import logoCuica from '@/assets/images/logo_cuica.png'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')

    if (password.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas nao conferem.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setInfo('Senha atualizada com sucesso. Faça login com a nova senha.')
      await supabase.auth.signOut()
      setTimeout(() => {
        navigate('/Login', { replace: true })
      }, 800)
    } catch (submitError) {
      const message = String(submitError?.message || '').toLowerCase()
      if (message.includes('session') || message.includes('jwt') || message.includes('token')) {
        setError('Sessão de recuperação inválida. Abra novamente o link enviado por email.')
      } else {
        setError('Nao foi possivel atualizar a senha. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f5] p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-[0_15px_35px_rgba(15,23,42,0.08)] p-7 sm:p-8">
        <div className="text-center mb-6">
          <img src={logoCuica} alt="LabEcoar" className="w-16 h-16 mx-auto mb-3 object-contain" />
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
                onClick={() => setShowPassword((value) => !value)}
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
                onClick={() => setShowConfirmPassword((value) => !value)}
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
            onClick={() => navigate('/Login')}
            className="w-full h-11 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Voltar ao login
          </button>
        </form>
      </div>
    </div>
  )
}