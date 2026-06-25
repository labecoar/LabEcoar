// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useUploadFile } from '@/hooks/useStorage'
import { useUserScore } from '@/hooks/useScores'
import { useMySubmissions } from '@/hooks/useSubmissions'
import { useMyPayments } from '@/hooks/usePayments'
import { storageService } from '@/services/storage.service'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { User, Instagram, Trophy, Award, Star, Users, Upload, Check, XCircle, Edit3 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/toast'
import { C, heading, body } from '@/lib/theme'

const CATEGORY_LABELS = {
  voz_e_violao: 'Voz e Violão',
  dueto: 'Dueto',
  fanfarra: 'Fanfarra',
  carnaval: 'Carnaval',
}

const getProfileFormData = (profile) => ({
  display_name: profile?.display_name || profile?.full_name || '',
  cpf: profile?.cpf || '',
  bio: profile?.bio || profile?.biography || '',
  instagram_handle: profile?.instagram_handle || profile?.instagram || '',
  followers_count: profile?.followers_count ?? 0,
  avatar_url: profile?.avatar_url || '',
})

const normalizeFormData = (data) => ({
  display_name: (data?.display_name || '').trim(),
  cpf: (data?.cpf || '').trim(),
  bio: (data?.bio || '').trim(),
  instagram_handle: (data?.instagram_handle || '').trim(),
  followers_count: Number(data?.followers_count || 0),
  avatar_url: (data?.avatar_url || '').trim(),
})

const normalizeSubmissionStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'aprovada' || normalized === 'aprovado') return 'approved'
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'rejected'
  if (normalized === 'pendente') return 'pending'
  return normalized
}

const AVATAR_CROP_FRAME_SIZE = 280
const AVATAR_CROP_CIRCLE_RATIO = 0.94
const AVATAR_CROP_MIN_ZOOM = 0
const AVATAR_CROP_MAX_ZOOM = 2

const clampAvatarZoom = (value) => {
  const numeric = Number(value || 0)
  if (Number.isNaN(numeric)) return 0
  return Math.min(AVATAR_CROP_MAX_ZOOM, Math.max(AVATAR_CROP_MIN_ZOOM, numeric))
}

const createAvatarFileFromCrop = ({ imageUrl, originalFileName, zoom, offsetX, offsetY }) => {
  if (!imageUrl) {
    return Promise.reject(new Error('Imagem invalida para recorte.'))
  }

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth || image.width
        const sourceHeight = image.naturalHeight || image.height
        const frameSize = AVATAR_CROP_FRAME_SIZE
        const circleSize = frameSize * AVATAR_CROP_CIRCLE_RATIO
        const baseScale = Math.max(circleSize / sourceWidth, circleSize / sourceHeight)
        const zoomLevel = clampAvatarZoom(zoom)
        const effectiveScale = baseScale * (1 + zoomLevel)
        const drawWidth = sourceWidth * effectiveScale
        const drawHeight = sourceHeight * effectiveScale

        const drawX = ((frameSize - drawWidth) / 2) + Number(offsetX || 0)
        const drawY = ((frameSize - drawHeight) / 2) + Number(offsetY || 0)

        const outputSize = 600
        const canvas = document.createElement('canvas')
        canvas.width = outputSize
        canvas.height = outputSize

        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Nao foi possivel preparar o canvas de recorte.'))
          return
        }

        context.clearRect(0, 0, outputSize, outputSize)

        const scaleToOutput = outputSize / frameSize
        context.drawImage(
          image,
          drawX * scaleToOutput,
          drawY * scaleToOutput,
          drawWidth * scaleToOutput,
          drawHeight * scaleToOutput,
        )

        const baseName = String(originalFileName || 'avatar').replace(/\.[^.]+$/, '')
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Nao foi possivel gerar a imagem recortada.'))
              return
            }

            const croppedFile = new File([blob], `${baseName}-avatar.jpg`, { type: 'image/jpeg' })
            resolve(croppedFile)
          },
          'image/jpeg',
          0.92,
        )
      } catch (error) {
        reject(error)
      }
    }

    image.onerror = () => {
      reject(new Error('Nao foi possivel processar a imagem selecionada.'))
    }

    image.src = imageUrl
  })
}

export default function Profile() {
  const queryClient = useQueryClient()
  const { user, profile, updateProfile, refreshProfile } = useAuth()
  const { data: userScore } = useUserScore(user?.id)
  const { data: mySubmissions = [] } = useMySubmissions(user?.id)
  const { data: myPayments = [] } = useMyPayments(user?.id)
  const uploadFileMutation = useUploadFile()

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState(getProfileFormData(profile))
  const initialFormData = useMemo(() => getProfileFormData(profile), [profile])
  const [avatarCropOpen, setAvatarCropOpen] = useState(false)
  const [avatarCropSourceUrl, setAvatarCropSourceUrl] = useState('')
  const [avatarCropFileName, setAvatarCropFileName] = useState('avatar.jpg')
  const [avatarCropZoom, setAvatarCropZoom] = useState(0)
  const [avatarCropOffset, setAvatarCropOffset] = useState({ x: 0, y: 0 })
  const [avatarCropSourceSize, setAvatarCropSourceSize] = useState({ width: 0, height: 0 })
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const dragOffsetStartRef = useRef({ x: 0, y: 0 })

  const hasChanges = useMemo(() => {
    const current = normalizeFormData(formData)
    const initial = normalizeFormData(initialFormData)
    return JSON.stringify(current) !== JSON.stringify(initial)
  }, [formData, initialFormData])

  useEffect(() => {
    if (user?.id) {
      refreshProfile()
    }
  }, [user?.id])

  useEffect(() => {
    setFormData(getProfileFormData(profile))
    setIsEditing(false)
  }, [profile])

  useEffect(() => {
    return () => {
      if (avatarCropSourceUrl) {
        URL.revokeObjectURL(avatarCropSourceUrl)
      }
    }
  }, [avatarCropSourceUrl])

  useEffect(() => {
    if (!avatarCropOpen) return
    setAvatarCropOffset({ x: 0, y: 0 })
    setAvatarCropZoom(0)
  }, [avatarCropOpen])

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      return updateProfile(data)
    },
    onSuccess: (updatedProfile) => {
      setFormData(getProfileFormData(updatedProfile))
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      notifySuccess('Perfil atualizado com sucesso! ✅')
    },
    onError: (error) => {
      console.error('Erro ao atualizar perfil:', error)
      const message = error?.message ? `\n\nDetalhes: ${error.message}` : ''
      notifyError(`Erro ao atualizar perfil. Tente novamente.${message}`)
    },
  })

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !user?.id) return

    try {
      const extension = '.' + file.name.split('.').pop().toLowerCase()

      if (!ALLOWED_IMAGE_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(extension)) {
        notifyError('Formato inválido. Use JPG, PNG, WEBP ou GIF.')
        if (event?.target) event.target.value = ''
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        notifyError('Arquivo muito grande. Máximo 5MB.')
        if (event?.target) event.target.value = ''
        return
      }

      if (!String(file.type || '').startsWith('image/')) {
        throw new Error('Selecione um arquivo de imagem valido.')
      }

      if (avatarCropSourceUrl) {
        URL.revokeObjectURL(avatarCropSourceUrl)
      }

      const sourceUrl = URL.createObjectURL(file)
      setAvatarCropSourceUrl(sourceUrl)
      setAvatarCropFileName(file.name || 'avatar.jpg')
      setAvatarCropZoom(0)
      setAvatarCropOffset({ x: 0, y: 0 })
      setAvatarCropSourceSize({ width: 0, height: 0 })
      setAvatarCropOpen(true)
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error)
      notifyError(error?.message || 'Erro ao fazer upload da imagem.')
    } finally {
      if (event?.target) {
        event.target.value = ''
      }
    }
  }

  const closeAvatarCropDialog = () => {
    setAvatarCropOpen(false)
    setIsDraggingAvatar(false)
    setAvatarCropOffset({ x: 0, y: 0 })
    setAvatarCropZoom(0)

    if (avatarCropSourceUrl) {
      URL.revokeObjectURL(avatarCropSourceUrl)
      setAvatarCropSourceUrl('')
    }

    setAvatarCropSourceSize({ width: 0, height: 0 })
  }

  const handleAvatarDragStart = (event) => {
    event.preventDefault()
    const point = event.touches?.[0] || event
    dragStartRef.current = { x: point.clientX, y: point.clientY }
    dragOffsetStartRef.current = { ...avatarCropOffset }
    setIsDraggingAvatar(true)
  }

  const handleAvatarDragMove = (event) => {
    if (!isDraggingAvatar) return

    event.preventDefault()
    const point = event.touches?.[0] || event
    const deltaX = point.clientX - dragStartRef.current.x
    const deltaY = point.clientY - dragStartRef.current.y

    setAvatarCropOffset({
      x: dragOffsetStartRef.current.x + deltaX,
      y: dragOffsetStartRef.current.y + deltaY,
    })
  }

  const handleAvatarDragEnd = () => {
    setIsDraggingAvatar(false)
  }

  const handleConfirmAvatarCrop = async () => {
    if (!avatarCropSourceUrl || !user?.id) return

    try {
      const previousAvatarUrl = String(profile?.avatar_url || formData.avatar_url || '').trim()

      const croppedFile = await createAvatarFileFromCrop({
        imageUrl: avatarCropSourceUrl,
        originalFileName: avatarCropFileName,
        zoom: avatarCropZoom,
        offsetX: avatarCropOffset.x,
        offsetY: avatarCropOffset.y,
      })

      const result = await uploadFileMutation.mutateAsync({
        file: croppedFile,
        userId: user.id,
      })

      const updatedProfile = await updateProfile({ avatar_url: result.url })

      setFormData((previous) => ({
        ...previous,
        avatar_url: updatedProfile?.avatar_url || result.url,
      }))

      await refreshProfile()
      closeAvatarCropDialog()
    } catch (error) {
      console.error('Erro ao salvar foto de perfil:', error)
      notifyError(error?.message || 'Nao foi possivel salvar a foto de perfil.')
    }
  }

  const avatarPreviewScale = useMemo(() => {
    const width = Number(avatarCropSourceSize.width || 0)
    const height = Number(avatarCropSourceSize.height || 0)
    if (!width || !height) return 1

    const circleSize = AVATAR_CROP_FRAME_SIZE * AVATAR_CROP_CIRCLE_RATIO
    const baseScale = Math.max(circleSize / width, circleSize / height)
    return baseScale * (1 + clampAvatarZoom(avatarCropZoom))
  }, [avatarCropSourceSize.width, avatarCropSourceSize.height, avatarCropZoom])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!isEditing || !hasChanges) return
    updateProfileMutation.mutate({
      display_name: formData.display_name,
      cpf: formData.cpf,
      bio: formData.bio,
      biography: formData.bio,
      instagram_handle: formData.instagram_handle,
      instagram: formData.instagram_handle,
      followers_count: formData.followers_count,
      avatar_url: formData.avatar_url,
    })
  }

  const categoryLabel = useMemo(() => {
    const key = profile?.current_category
    if (!key) return 'Voz e Violão'
    return CATEGORY_LABELS[key] || key.replace(/_/g, ' ')
  }, [profile?.current_category])

  const displayName = formData.display_name || profile?.full_name || 'Ecoante'
  const isUploadingAvatar = uploadFileMutation.isPending
  const totalPoints = userScore?.total_points || 0
  const totalEarningsFromProfile = Number(profile?.total_earnings || 0)

  const campaignPotentialEarnings = useMemo(() => {
    return mySubmissions
      .filter((submission) => {
        const status = normalizeSubmissionStatus(submission?.status)
        return status === 'approved' && submission?.task?.category === 'campanha'
      })
      .reduce((sum, submission) => sum + Number(submission?.task?.offered_value || 0), 0)
  }, [mySubmissions])

  const paymentsPipelineTotal = useMemo(() => {
    return myPayments
      .filter((payment) => ['pendente', 'processando', 'pago'].includes(String(payment?.status || '').toLowerCase()))
      .reduce((sum, payment) => sum + Number(payment?.amount || 0), 0)
  }, [myPayments])

  const totalEarnings = useMemo(() => {
    return Math.max(totalEarningsFromProfile, campaignPotentialEarnings, paymentsPipelineTotal)
  }, [totalEarningsFromProfile, campaignPotentialEarnings, paymentsPipelineTotal])

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: C.black, ...body }}>
      <Dialog open={avatarCropOpen} onOpenChange={(open) => { if (!open) closeAvatarCropDialog() }}>
        <DialogContent className="sm:max-w-xl p-0 border-0 bg-transparent overflow-hidden shadow-none">
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.1)` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(255,255,222,0.07)` }}>
              <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>Ajustar foto de perfil</span>
              <button onClick={closeAvatarCropDialog} style={{ color: `${C.cream}50` }} className="hover:opacity-100 transition-opacity"><XCircle size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p style={{ fontSize: 13, color: `${C.cream}60` }}>Arraste para posicionar e use o zoom para enquadrar no círculo.</p>

              <div className="flex justify-center">
                <div
                  className="relative overflow-hidden rounded-lg bg-black/90 select-none touch-none"
                  style={{ width: `${AVATAR_CROP_FRAME_SIZE}px`, height: `${AVATAR_CROP_FRAME_SIZE}px`, border: `1px solid ${C.lime}44` }}
                  onMouseDown={handleAvatarDragStart}
                  onMouseMove={handleAvatarDragMove}
                  onMouseUp={handleAvatarDragEnd}
                  onMouseLeave={handleAvatarDragEnd}
                  onTouchStart={handleAvatarDragStart}
                  onTouchMove={handleAvatarDragMove}
                  onTouchEnd={handleAvatarDragEnd}
                >
                  {avatarCropSourceUrl && (
                    <img
                      src={avatarCropSourceUrl}
                      alt="Prévia do recorte"
                      className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                      onLoad={(event) => {
                        setAvatarCropSourceSize({
                          width: event.currentTarget.naturalWidth || 0,
                          height: event.currentTarget.naturalHeight || 0,
                        })
                      }}
                      style={{
                        transform: `translate(calc(-50% + ${avatarCropOffset.x}px), calc(-50% + ${avatarCropOffset.y}px)) scale(${avatarPreviewScale})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  )}

                  <div className="absolute inset-0 pointer-events-none bg-black/30" />
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                    style={{ width: `${AVATAR_CROP_CIRCLE_RATIO * 100}%`, height: `${AVATAR_CROP_CIRCLE_RATIO * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>ZOOM</label>
                <input
                  type="range"
                  min={String(AVATAR_CROP_MIN_ZOOM)}
                  max={String(AVATAR_CROP_MAX_ZOOM)}
                  step="0.01"
                  value={avatarCropZoom}
                  onChange={(event) => setAvatarCropZoom(clampAvatarZoom(event.target.value))}
                  className="w-full accent-lime-400"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeAvatarCropDialog} disabled={uploadFileMutation.isPending} className="flex-1 h-12 rounded-xl transition-all hover:bg-[rgba(255,255,222,0.05)]" style={{ color: `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleConfirmAvatarCrop} disabled={uploadFileMutation.isPending} className="flex-1 h-12 rounded-xl transition-all hover:brightness-110 disabled:opacity-50" style={{ backgroundColor: C.lime, color: C.black, ...heading, fontWeight: 700, fontSize: 14 }}>
                  {uploadFileMutation.isPending ? 'Salvando foto...' : 'Usar esta foto'}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Topbar */}
      <div className="flex items-center justify-between px-8 py-4 sticky top-0 z-10" style={{ backgroundColor: `${C.black}F5`, backdropFilter: "blur(16px)", borderBottom: `1px solid rgba(255,255,222,0.05)` }}>
        <div className="flex items-center gap-3">
          <User size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Perfil</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.black }}>
          <Star size={11} fill={C.black} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{totalPoints} pts</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 px-8 pt-7 pb-10 max-w-6xl mx-auto" style={{ minHeight: 0 }}>
        {/* ── LEFT: sidebar card ── */}
        <div className="shrink-0 flex flex-col gap-4 w-full md:w-[280px]">
          {/* Avatar + identity */}
          <div className="p-6 rounded-2xl flex flex-col items-center text-center gap-4" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
            <div className="relative">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt={profile?.full_name || 'Avatar'}
                  className="w-20 h-20 rounded-full object-cover object-center shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl shadow-lg" style={{ backgroundColor: C.orange, color: C.cream }}>
                  {(displayName || 'E').charAt(0).toUpperCase()}
                </div>
              )}
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: C.surface, border: `2px solid ${C.card}`, color: `${C.cream}70` }}
              >
                <Upload size={14} />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>
            {isUploadingAvatar && (
              <p style={{ fontSize: 11, color: C.lime }}>Enviando imagem...</p>
            )}
            <div>
              <div style={{ ...heading, fontSize: 18, fontWeight: 800, color: C.cream, lineHeight: 1.2 }}>{displayName}</div>
              <div style={{ fontSize: 12, color: `${C.cream}45`, marginTop: 4 }}>{user?.email}</div>
            </div>
          </div>

          {/* Stats panel */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
            {[
              { icon: Trophy, label: "Categoria", value: categoryLabel, valueColor: C.orange },
              { icon: Star, label: "Pontos", value: totalPoints, valueColor: C.lime },
              { icon: Award, label: "Ganhos", value: `R$ ${totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, valueColor: C.lime },
            ].map(({ icon: IconComponent, label, value, valueColor }, i, arr) => (
              <div key={label} className="flex items-center justify-between px-5 py-4" style={{ borderBottom: i < arr.length - 1 ? `1px solid rgba(255,255,222,0.06)` : "none" }}>
                <div className="flex items-center gap-2.5">
                  <IconComponent size={14} style={{ color: `${C.cream}40` }} />
                  <span style={{ fontSize: 13, color: `${C.cream}60` }}>{label}</span>
                </div>
                <span style={{ ...heading, fontSize: 14, fontWeight: 800, color: valueColor }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: form + social ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
            {/* Card header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(255,255,222,0.07)` }}>
              <div className="flex items-center gap-2.5">
                <User size={15} style={{ color: C.lime }} />
                <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Informações do Ecoante</span>
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={updateProfileMutation.isPending || isUploadingAvatar}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: C.darkGreen, color: C.lime, ...heading, fontWeight: 700, fontSize: 12 }}
                >
                  <Edit3 size={12} /> Editar perfil
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(initialFormData);
                    setIsEditing(false);
                  }}
                  disabled={updateProfileMutation.isPending || isUploadingAvatar}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: "rgba(255,255,222,0.07)", color: `${C.cream}70`, ...body, fontSize: 12 }}
                >
                  <XCircle size={12} /> Cancelar
                </button>
              )}
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}55`, letterSpacing: "0.06em", display: "block", marginBottom: 7 }}>NOME DE EXIBIÇÃO</label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                      readOnly={!isEditing}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{
                        backgroundColor: "rgba(255,255,222,0.04)",
                        border: `1px solid ${isEditing ? "rgba(255,255,222,0.14)" : "rgba(255,255,222,0.07)"}`,
                        color: isEditing ? C.cream : `${C.cream}80`,
                        ...body, fontSize: 13
                      }}
                      placeholder="Seu nome de exibição"
                    />
                  </div>
                  <div>
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}55`, letterSpacing: "0.06em", display: "block", marginBottom: 7 }}>CPF</label>
                    <input
                      type="text"
                      value={formData.cpf}
                      readOnly
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{
                        backgroundColor: "rgba(255,255,222,0.04)",
                        border: "1px solid rgba(255,255,222,0.07)",
                        color: `${C.cream}60`,
                        ...body,
                        fontSize: 13
                      }}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}55`, letterSpacing: "0.06em", display: "block", marginBottom: 7 }}>EMAIL</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{ backgroundColor: "rgba(255,255,222,0.04)", border: "1px solid rgba(255,255,222,0.07)", color: `${C.cream}60`, ...body, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}55`, letterSpacing: "0.06em", display: "block", marginBottom: 7 }}>BIOGRAFIA</label>
                  <textarea
                    placeholder="Conte um pouco sobre você e seu trabalho com sustentabilidade..."
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    readOnly={!isEditing}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      backgroundColor: "rgba(255,255,222,0.04)",
                      border: `1px solid ${isEditing ? "rgba(255,255,222,0.14)" : "rgba(255,255,222,0.07)"}`,
                      color: isEditing ? C.cream : `${C.cream}80`,
                      resize: isEditing ? "vertical" : "none",
                      ...body, fontSize: 13
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}55`, letterSpacing: "0.06em", display: "block", marginBottom: 7 }}>INSTAGRAM</label>
                    <div className="relative flex items-center">
                      <Instagram size={13} style={{ position: "absolute", left: 14, color: isEditing ? "#E1306C" : `${C.cream}35`, pointerEvents: "none" }} />
                      <input
                        type="text"
                        value={formData.instagram_handle}
                        onChange={e => setFormData({ ...formData, instagram_handle: e.target.value })}
                        readOnly={!isEditing}
                        className="w-full py-3 pr-4 rounded-xl outline-none"
                        style={{
                          paddingLeft: 36,
                          backgroundColor: "rgba(255,255,222,0.04)",
                          border: `1px solid ${isEditing ? "rgba(255,255,222,0.14)" : "rgba(255,255,222,0.07)"}`,
                          color: isEditing ? C.cream : `${C.cream}80`,
                          ...body, fontSize: 13
                        }}
                        placeholder="@seuperfil"
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}55`, letterSpacing: "0.06em", display: "block", marginBottom: 7 }}>NÚMERO DE SEGUIDORES</label>
                    <div className="relative flex items-center">
                      <Users size={13} style={{ position: "absolute", left: 14, color: isEditing ? C.lime : `${C.cream}35`, pointerEvents: "none" }} />
                      <input
                        type="number"
                        min="0"
                        value={formData.followers_count}
                        onChange={(e) => {
                          const parsedValue = parseInt(e.target.value, 10);
                          setFormData((prev) => ({
                            ...prev,
                            followers_count: Number.isNaN(parsedValue) ? 0 : parsedValue,
                          }));
                        }}
                        readOnly={!isEditing}
                        className="w-full py-3 pr-4 rounded-xl outline-none"
                        style={{
                          paddingLeft: 36,
                          backgroundColor: "rgba(255,255,222,0.04)",
                          border: `1px solid ${isEditing ? "rgba(255,255,222,0.14)" : "rgba(255,255,222,0.07)"}`,
                          color: isEditing ? C.cream : `${C.cream}80`,
                          ...body, fontSize: 13
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <button
                    type="submit"
                    disabled={!hasChanges || updateProfileMutation.isPending || isUploadingAvatar}
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl transition-all hover:brightness-110 disabled:opacity-50 mt-2"
                    style={{ backgroundColor: C.lime, color: C.black, ...heading, fontWeight: 700, fontSize: 14 }}
                  >
                    <Check size={15} /> {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Redes Sociais */}
          <div className="p-5 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
            <span style={{ ...heading, fontSize: 13, fontWeight: 700, color: C.cream, display: "block", marginBottom: 14 }}>Redes Sociais</span>
            <div className="flex flex-col gap-3">
              {[
                { Icon: Instagram, label: formData.instagram_handle || 'Não informado', platform: "Instagram", color: "#E1306C" },
              ].map(({ Icon: SocialIcon, label, platform, color }) => (
                <div key={platform} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: C.surface, border: `1px solid rgba(255,255,222,0.07)` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18`, color }}>
                    <SocialIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 10, color: `${C.cream}40`, marginBottom: 1 }}>{platform}</div>
                    <div style={{ fontSize: 13, color: C.cream, fontWeight: 500 }} className="truncate">{label}</div>
                  </div>
                  {isEditing && platform === "Instagram" && (
                    <div style={{ color: `${C.cream}30` }}>
                      <Edit3 size={13} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
