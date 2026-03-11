// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useUploadFile } from '@/hooks/useStorage'
import { useUserScore } from '@/hooks/useScores'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { User, Instagram, Save, Trophy, Award, Star, Camera, Pencil, Users } from 'lucide-react'

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

export default function Profile() {
  const queryClient = useQueryClient()
  const { user, profile, updateProfile, refreshProfile } = useAuth()
  const { data: userScore } = useUserScore(user?.id)
  const uploadFileMutation = useUploadFile()

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState(getProfileFormData(profile))

  const initialFormData = useMemo(() => getProfileFormData(profile), [profile])
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

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      return updateProfile(data)
    },
    onSuccess: (updatedProfile) => {
      setFormData(getProfileFormData(updatedProfile))
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      alert('Perfil atualizado com sucesso! ✅')
    },
    onError: (error) => {
      console.error('Erro ao atualizar perfil:', error)
      const message = error?.message ? `\n\nDetalhes: ${error.message}` : ''
      alert(`Erro ao atualizar perfil. Tente novamente.${message}`)
    },
  })

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !user?.id || !isEditing) return

    try {
      const result = await uploadFileMutation.mutateAsync({
        file,
        userId: user.id,
      })

      setFormData((previous) => ({
        ...previous,
        avatar_url: result.url,
      }))
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error)
      alert('Erro ao fazer upload da imagem.')
    }
  }

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
  const totalEarnings = Number(profile?.total_earnings || 0)

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Meu Perfil
          </h1>
          <p className="text-gray-600 mt-2">Gerencie suas informações como Ecoante</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center border-b border-emerald-100">
              <div className="relative w-24 h-24 mx-auto mb-4">
                {formData.avatar_url ? (
                  <img
                    src={formData.avatar_url}
                    alt={profile?.full_name || 'Avatar'}
                    className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white text-4xl font-bold">
                      {(displayName?.charAt(0) || 'E').toUpperCase()}
                    </span>
                  </div>
                )}

                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-all duration-200"
                >
                  <Camera className="w-4 h-4" />
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
                <p className="text-sm text-emerald-600 mb-2">Enviando imagem...</p>
              )}

              <CardTitle className="text-xl">{displayName}</CardTitle>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm font-medium">Categoria</span>
                  </div>
                  <span className="font-bold text-yellow-700">{categoryLabel}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium">Pontos</span>
                  </div>
                  <span className="font-bold text-purple-700">{totalPoints}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium">Ganhos</span>
                  </div>
                  <span className="font-bold text-green-700">R$ {totalEarnings.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b border-emerald-100">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  Informações do Ecoante
                </CardTitle>
                <Button
                  type="button"
                  variant={isEditing ? 'outline' : 'default'}
                  onClick={() => {
                    if (isEditing) {
                      setFormData(initialFormData)
                      setIsEditing(false)
                      return
                    }
                    setIsEditing(true)
                  }}
                  disabled={updateProfileMutation.isPending || isUploadingAvatar}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  {isEditing ? 'Cancelar edição' : 'Editar perfil'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Nome de Exibição</Label>
                    <Input
                      id="display_name"
                      placeholder="Seu nome ou apelido"
                      value={formData.display_name}
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50' : ''}
                      onChange={(event) => setFormData((previous) => ({ ...previous, display_name: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50' : ''}
                      onChange={(event) => setFormData((previous) => ({ ...previous, cpf: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Biografia</Label>
                  <Textarea
                    id="bio"
                    placeholder="Conte um pouco sobre você e seu trabalho com sustentabilidade..."
                    value={formData.bio}
                    disabled={!isEditing}
                    className={`h-24 ${!isEditing ? 'bg-gray-50' : ''}`}
                    onChange={(event) => setFormData((previous) => ({ ...previous, bio: event.target.value }))}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="instagram_handle" className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-pink-500" />
                      Instagram
                    </Label>
                    <Input
                      id="instagram_handle"
                      placeholder="@seuusuario"
                      value={formData.instagram_handle}
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50' : ''}
                      onChange={(event) => setFormData((previous) => ({ ...previous, instagram_handle: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="followers_count" className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      Número de Seguidores
                    </Label>
                    <Input
                      id="followers_count"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.followers_count}
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50' : ''}
                      onChange={(event) => {
                        const parsedValue = parseInt(event.target.value, 10)
                        setFormData((previous) => ({
                          ...previous,
                          followers_count: Number.isNaN(parsedValue) ? 0 : parsedValue,
                        }))
                      }}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  disabled={!isEditing || !hasChanges || updateProfileMutation.isPending || isUploadingAvatar}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
