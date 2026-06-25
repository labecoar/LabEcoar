import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Instagram, Lock, Mail, Users } from 'lucide-react'
import cuicaLogin from '@/assets/images/cuica_login.png'
import iconGoogle from '@/assets/images/icon_google.png'
import imageLogin from '@/assets/images/image_login.png'
import { C, heading, body } from '@/lib/theme'
import { buildSignupProfilePayload, formatCpf } from '@/lib/profile-utils'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_SECONDS = 60

const isValidEmail = (value) => EMAIL_REGEX.test(value.trim())

const isExistingEmailSignupResponse = (data) => {
  const identities = data?.user?.identities
  return Array.isArray(identities) && identities.length === 0
}

const isEmailAlreadyInUseError = (message) => {
  const normalized = String(message || '').toLowerCase()
  return normalized.includes('already registered')
    || normalized.includes('email already')
    || normalized.includes('email_exists')
    || normalized.includes('user already registered')
}

export default function Login() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [bio, setBio] = useState('')
  const [instagram, setInstagram] = useState('')
  const [followersCount, setFollowersCount] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotInfo, setForgotInfo] = useState('')
  const [forgotCooldown, setForgotCooldown] = useState(0)
  const [showResendButton, setShowResendButton] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signInWithGoogle, signUp, resetPassword } = useAuth()
  const routeMessage = location.state?.message || ''
  const routeTone = location.state?.tone || 'info'

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
    setName('')
    setCpf('')
    setBio('')
    setInstagram('')
    setFollowersCount('')
    setPassword('')
    setConfirmPassword('')
  }, [mode])

  useEffect(() => {
    if (!routeMessage) return

    if (routeTone === 'warning') {
      setError(routeMessage)
    } else {
      setInfo(routeMessage)
    }

    window.history.replaceState(null, '', window.location.pathname)
  }, [routeMessage, routeTone])

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
      const { authService } = await import('@/services/auth.service')
      await authService.resendSignupConfirmation(normalizedEmail)
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

      setTimeout(() => {
        setShowForgotModal(false)
      }, 2500)
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
        navigate('/')
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

      const {
        payload: profilePayload,
        trimmedName,
        cpfDigits,
        normalizedInstagram,
        followers,
      } = buildSignupProfilePayload({
        displayName: name,
        cpf,
        bio,
        instagram,
        followersCount,
      })

      if (!trimmedName) {
        setError('Informe o nome de exibição.')
        return
      }

      if (cpfDigits.length !== 11) {
        setError('Informe um CPF válido com 11 dígitos.')
        return
      }

      if (!normalizedInstagram) {
        setError('Informe seu Instagram.')
        return
      }

      if (Number.isNaN(followers) || followers < 0) {
        setError('Informe um número de seguidores válido.')
        return
      }

      const data = await signUp(email, password, profilePayload)

      if (isExistingEmailSignupResponse(data)) {
        setError('Este email ja esta em uso. Entre com Google se essa conta foi criada por la, ou use "Esqueci minha senha".')
        return
      }

      if (data?.session) {
        navigate('/')
      } else {
        setInfo('Conta criada. Verifique seu email para confirmar o cadastro.')
      }
    } catch (err) {
      console.error('Erro na autenticacao:', err)

      const errorMessage = err?.message?.toLowerCase?.() || ''

      if (err?.code === 'account_inactive' || errorMessage.includes('conta foi inativada')) {
        setError('Sua conta foi inativada pelo administrador. Entre em contato com a equipe para reativação.')
        return
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('rate_limit')) {
        setError('Muitas tentativas de email. Aguarde alguns minutos e tente novamente.')
        return
      }

      if (isEmailAlreadyInUseError(err?.message)) {
        setError('Este email ja esta em uso. Entre com Google se essa conta foi criada por lá, ou use "Esqueci minha senha".')
      } else if (err.message?.includes('Email not confirmed')) {
        // Verificar se o erro é de email não confirmado
        setError('Email não confirmado. Verifique sua caixa de entrada ou clique em reenviar.')
        setShowResendButton(true)
      } else {
        setError('Nao foi possivel concluir. Verifique os dados e tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setInfo('')
    setLoading(true)

    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Erro no login com Google:', err)
      setError('Não foi possível entrar com Google. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'flex items-center pl-4 pr-1 h-[50px] rounded-xl bg-white'
  const inputStyle = { border: `1.5px solid ${error ? '#FF2255' : '#d9d9d6'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
  const labelStyle = { ...body, fontSize: 11, fontWeight: 700,  color: C.black, letterSpacing: '0.05em' }
  const textInputStyle = { ...body, fontSize: 14, color: C.black }

  const PasswordToggle = ({ visible, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      style={{ color: '#353535', opacity: 0.45 }}
      className="hover:opacity-80 transition-opacity"
    >
      {visible ? <Eye size={16} /> : <EyeOff size={16} />}
    </button>
  )

  return (
    <div className="min-h-screen flex">
      <div className="relative flex w-full min-h-screen overflow-hidden" style={{ backgroundColor: C.black }}>
        <div className="absolute left-0 top-0 right-0 h-1.5 z-50 pointer-events-none" style={{ background: `linear-gradient(90deg, ${C.lime} 0%, ${C.lime}00 100%)` }} />
        <div className="relative flex-1 h-full min-h-screen overflow-hidden hidden md:block" style={{ minWidth: 0 }}>
          <img
            src={imageLogin}
            alt="CuícaLab"
            className="absolute inset-0 h-full w-full object-cover grayscale brightness-[.55]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(7,38,23,0.333)] to-[#1D1D1B]/80" />
          <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: `linear-gradient(180deg, ${C.blue} 0%, ${C.blue}00 100%)` }} />
          <div className="absolute inset-0 flex items-center justify-center pb-16">
            <img src={cuicaLogin} alt="CuícaLab logo" className="w-80 aspect-[288/312] object-contain drop-shadow-2xl" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center" style={{ backgroundColor: C.lime, height: 72 }}>
            <span style={{ ...heading, fontSize: 26, fontWeight: 800, color: C.black, letterSpacing: "-0.01em" }}>
              Conecte. Influencie. Cresça.
            </span>
          </div>
        </div>
        <div className={`relative flex flex-col h-full min-h-screen shrink-0 overflow-y-auto w-full md:w-1/2 ${mode === 'signup' ? 'justify-start' : 'items-center justify-center'}`} style={{ maxWidth: 680, backgroundColor: C.cream }}>
          <div className={`flex flex-col w-full px-6 py-10 ${mode === 'signup' ? 'gap-6 max-w-[440px] mx-auto' : 'gap-7 max-w-[400px]'}`}>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg border border-red-200 text-sm">
                {error}
              </div>
            )}

            {info && (
              <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg border border-emerald-200 text-sm">
                {info}
              </div>
            )}

            {mode === 'login' ? (
              <>
                <div className="flex flex-col gap-2">
                  <h1 style={{ ...heading, fontWeight: 800, fontSize: 34, color: C.black, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                    Que bom ter você aqui!
                  </h1>
                  <p style={{ ...body, fontSize: 14, color: '#6b6b69' }}>Entre na sua conta para continuar.</p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="flex items-center justify-center gap-2.5 w-full h-[50px] rounded-xl bg-white transition-all hover:shadow-md disabled:opacity-50"
                  style={{ border: '1.5px solid #c7c7c4', boxShadow: '0px 2px 8px rgba(0,0,0,0.06)', borderRadius: 16, height: 38 }}
                >
                  <img src={iconGoogle} alt="Google" className="w-4 h-4 object-contain hidden" />
                  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
                    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.000 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
                    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
                    <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
                  </svg>
                  <span style={{ ...body, fontSize: 14, fontWeight: 500, color: '#2e2e2b' }}>
                    {loading ? 'Conectando...' : 'Continuar com o Google'}
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ backgroundColor: '#c7c7c2' }} />
                  <span style={{ ...body, fontSize: 11, color: '#999996' }}>ou entre com e-mail</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#c7c7c2' }} />
                </div>

                {showResendButton && (
                  <div>
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendLoading || resendCooldown > 0}
                      className="w-full bg-amber-500 text-white py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {resendLoading
                        ? 'Reenviando...'
                        : resendCooldown > 0
                          ? `Aguarde (${resendCooldown}s)`
                          : 'Reenviar email de confirmação'}
                    </button>
                    <p className="mt-2 text-xs text-amber-700 text-center">
                      Não recebeu? Confira o spam ou tente reenviar.
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label style={labelStyle}>E-MAIL</label>
                    <div className={inputCls} style={inputStyle}>
                      <Mail className="w-4 h-4 text-slate-400 mr-2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError('') }}
                        placeholder="voce@exemplo.com"
                        className="flex-1 bg-transparent outline-none"
                        style={textInputStyle}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label style={labelStyle}>SENHA</label>
                      <button
                        type="button"
                        onClick={handleOpenForgotModal}
                        disabled={forgotLoading || loading || forgotCooldown > 0}
                        style={{ ...body, fontSize: 11, fontWeight: 500, color: C.blue }}
                        className="hover:underline disabled:opacity-50"
                      >
                        {forgotCooldown > 0 ? `Esqueceu a senha? (${forgotCooldown}s)` : 'Esqueceu a senha?'}
                      </button>
                    </div>
                    <div className={inputCls} style={inputStyle}>
                      <Lock className="w-4 h-4 text-slate-400 mr-2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError('') }}
                        placeholder="••••••••"
                        className="flex-1 bg-transparent outline-none"
                        style={textInputStyle}
                        disabled={loading}
                        required
                      />
                      <PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center w-full h-[54px] rounded-xl transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    style={{ ...heading, backgroundColor: C.blue, boxShadow: `0 4px 20px ${C.blue}44`, color: C.cream, fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', height: 38 }}
                  >
                    {loading ? 'Aguarde...' : 'Entrar'}
                  </button>
                </form>

                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <span style={{ ...body, fontSize: 13, color: '#737370' }}>Ainda não tem conta?</span>
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    style={{ ...body, fontSize: 13, fontWeight: 700, color: C.darkGreen, textDecoration: 'underline' }}
                    className="hover:opacity-80 transition-opacity"
                  >
                    Cadastre-se
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <h1 style={{ ...heading, fontWeight: 800, fontSize: 32, color: C.black, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                    Crie sua conta
                  </h1>
                  <p style={{ ...body, fontSize: 14, color: '#6b6b69' }}>Junte-se à rede de influenciadores CuícaLab.</p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="flex items-center justify-center gap-2.5 w-full h-[50px] rounded-xl bg-white transition-all hover:shadow-md disabled:opacity-50"
                  style={{ border: '1.5px solid #c7c7c4', boxShadow: '0px 2px 8px rgba(0,0,0,0.06)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
                    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.000 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
                    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
                    <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
                  </svg>
                  <span style={{ ...body, fontSize: 14, fontWeight: 500, color: '#2e2e2b' }}>
                    {loading ? 'Conectando...' : 'Continuar com o Google'}
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ backgroundColor: '#c7c7c2' }} />
                  <span style={{ ...body, fontSize: 11, color: '#999996' }}>ou cadastre com e-mail</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#c7c7c2' }} />
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label style={labelStyle}>NOME DE EXIBIÇÃO</label>
                      <div className={inputCls} style={inputStyle}>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => { setName(e.target.value); setError('') }}
                          placeholder="Como quer ser chamado"
                          className="flex-1 bg-transparent outline-none"
                          style={textInputStyle}
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label style={labelStyle}>CPF</label>
                      <div className={inputCls} style={inputStyle}>
                        <input
                          type="text"
                          value={cpf}
                          onChange={(e) => { setCpf(formatCpf(e.target.value)); setError('') }}
                          placeholder="000.000.000-00"
                          className="flex-1 bg-transparent outline-none"
                          style={textInputStyle}
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label style={labelStyle}>E-MAIL</label>
                    <div className={inputCls} style={inputStyle}>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError('') }}
                        placeholder="voce@exemplo.com"
                        className="flex-1 bg-transparent outline-none"
                        style={textInputStyle}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label style={labelStyle}>BIOGRAFIA</label>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={(e) => { setBio(e.target.value); setError('') }}
                      placeholder="Conte um pouco sobre você e seu trabalho..."
                      className="w-full px-4 py-3 rounded-xl bg-white outline-none resize-none"
                      style={{ ...textInputStyle, border: `1.5px solid ${error ? '#FF2255' : '#d9d9d6'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                      disabled={loading}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label style={labelStyle}>INSTAGRAM</label>
                      <div className={`${inputCls} gap-2`} style={inputStyle}>
                        <Instagram size={13} style={{ color: '#E1306C', flexShrink: 0 }} />
                        <input
                          type="text"
                          value={instagram}
                          onChange={(e) => { setInstagram(e.target.value); setError('') }}
                          placeholder="@seuperfil"
                          className="flex-1 bg-transparent outline-none"
                          style={textInputStyle}
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label style={labelStyle}>Nº DE SEGUIDORES</label>
                      <div className={`${inputCls} gap-2`} style={inputStyle}>
                        <Users size={13} style={{ color: '#888885' }} />
                        <input
                          type="number"
                          min="0"
                          value={followersCount}
                          onChange={(e) => { setFollowersCount(e.target.value); setError('') }}
                          placeholder="50000"
                          className="flex-1 bg-transparent outline-none"
                          style={textInputStyle}
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label style={labelStyle}>SENHA</label>
                      <div className={inputCls} style={inputStyle}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setError('') }}
                          placeholder="••••••••"
                          className="flex-1 bg-transparent outline-none"
                          style={textInputStyle}
                          disabled={loading}
                          required
                        />
                        <PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label style={labelStyle}>CONFIRMAR SENHA</label>
                      <div className={inputCls} style={inputStyle}>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                          placeholder="••••••••"
                          className="flex-1 bg-transparent outline-none"
                          style={textInputStyle}
                          disabled={loading}
                          required
                        />
                        <PasswordToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center w-full h-[54px] rounded-xl transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ ...heading, backgroundColor: C.blue, boxShadow: `0 4px 20px ${C.blue}44`, color: C.cream, fontSize: 15, fontWeight: 700, letterSpacing: '0.04em' }}
                  >
                    {loading ? 'Aguarde...' : 'Criar conta'}
                  </button>
                </form>

                <div className="flex items-center justify-center gap-1.5">
                  <span style={{ ...body, fontSize: 13, color: '#737370' }}>Já tem uma conta?</span>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    style={{ ...body, fontSize: 13, fontWeight: 700, color: C.darkGreen, textDecoration: 'underline' }}
                    className="hover:opacity-80 transition-opacity"
                  >
                    Entre aqui
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6">
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Recuperar senha</h3>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#13203f] focus:border-transparent"
                placeholder="seu@email.com"
                disabled={forgotLoading}
              />

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotLoading || forgotCooldown > 0}
                  className="flex-1 bg-[#0f1833] text-white py-2 rounded-lg font-medium hover:bg-[#1a274f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>

  )
}
