// @ts-nocheck
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import logoCuica from '@/assets/images/logo_cuica.png'

const onlyDigits = (value) => String(value || '').replace(/\D/g, '')

const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function CompleteProfile() {
  const navigate = useNavigate()
  const { profile, updateProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name || profile?.full_name || '')
  const [cpf, setCpf] = useState(profile?.cpf || '')
  const [instagram, setInstagram] = useState(profile?.instagram_handle || '')
  const [followersCount, setFollowersCount] = useState(
    profile?.followers_count !== null && profile?.followers_count !== undefined
      ? String(profile.followers_count)
      : ''
  )
  const [bio, setBio] = useState(profile?.bio || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalizedInstagram = useMemo(() => {
    const clean = instagram.trim().replace(/^@+/, '')
    return clean ? `@${clean}` : ''
  }, [instagram])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const trimmedName = displayName.trim()
    const cpfDigits = onlyDigits(cpf)
    const followers = Number(followersCount)

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

    setLoading(true)

    try {
      await updateProfile({
        full_name: trimmedName,
        display_name: trimmedName,
        cpf: formatCpf(cpfDigits),
        instagram_handle: normalizedInstagram,
        followers_count: followers,
        bio: bio.trim() || null,
      })

      navigate('/', { replace: true })
    } catch (submitError) {
      console.error('Erro ao completar cadastro:', submitError)
      setError('Não foi possível salvar os dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f5] py-10 px-4 forum-typography">
      <div className="max-w-xl mx-auto">
        <h1 className="text-4xl font-semibold text-slate-900 mb-6">Cadastro</h1>

        <div className="rounded-xl bg-white border border-slate-200 shadow-[0_15px_35px_rgba(15,23,42,0.08)] p-6">
          <div className="text-center mb-6">
            <img src={logoCuica} alt="LabEcoar" className="w-16 h-16 mx-auto mb-3 object-contain" />
            <h2 className="text-3xl font-bold text-[#3c0b14]">Bem-vindo ao Cuíca Lab!</h2>
            <p className="text-sm text-slate-500 mt-1">Complete seu cadastro para começar</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700 mb-4">Informações do Perfil</p>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 border border-red-200 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome de Exibição *</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#13203f]"
                  placeholder="Seu nome"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">CPF *</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#13203f]"
                  placeholder="000.000.000-00"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-slate-400 mt-1">Necessário para pagamentos futuros</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Instagram *</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#13203f]"
                  placeholder="@seuusuario"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Número de Seguidores *</label>
                <input
                  type="number"
                  min="0"
                  value={followersCount}
                  onChange={(e) => setFollowersCount(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#13203f]"
                  placeholder="Ex: 1500"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Bio (opcional)</label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#13203f]"
                  placeholder="Conte um pouco sobre você..."
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md bg-[#08b141] text-white font-semibold hover:bg-[#0a9a3b] transition-colors disabled:opacity-60"
              >
                {loading ? 'Salvando...' : 'Completar Cadastro'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            Ao continuar, você concorda com os termos de uso da plataforma
          </p>
        </div>
      </div>
    </div>
  )
}
