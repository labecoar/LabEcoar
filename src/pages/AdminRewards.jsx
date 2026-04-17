// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminRewards, useCreateReward, useDeleteReward, useUpdateReward } from '@/hooks/useRewards'
import { useUploadFile } from '@/hooks/useStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Gift, Plus, Save, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'

const CATEGORY_OPTIONS = [
  { value: 'alimentacao', label: 'Alimentacao' },
  { value: 'educacao', label: 'Educacao' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'bem_estar', label: 'Bem-Estar' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'outros', label: 'Outros' },
]

const CATEGORY_LABELS = {
  alimentacao: 'Alimentacao',
  educacao: 'Educacao',
  cultura: 'Cultura',
  bem_estar: 'Bem-Estar',
  tecnologia: 'Tecnologia',
  outros: 'Outros',
}

const DEFAULT_FORM = {
  title: '',
  points_required: '',
  quantity_available: '',
  category: 'outros',
  is_active: true,
}

export default function AdminRewards() {
  const { user, profile } = useAuth()
  const [formData, setFormData] = useState(DEFAULT_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [editById, setEditById] = useState({})

  const { data: rewards = [], isLoading, error } = useAdminRewards()
  const createReward = useCreateReward(user?.id)
  const updateReward = useUpdateReward()
  const deleteReward = useDeleteReward()
  const uploadFile = useUploadFile()

  const totalActive = useMemo(
    () => rewards.filter((reward) => Boolean(reward.is_active)).length,
    [rewards]
  )

  const startEditingRow = (reward) => {
    setEditById((previous) => ({
      ...previous,
      [reward.id]: {
        points_required: String(reward.points_required || ''),
        quantity_available: reward.quantity_available == null ? '' : String(reward.quantity_available),
      },
    }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()

    const pointsRequired = Number(formData.points_required)
    const quantityAvailable = formData.quantity_available === '' ? null : Number(formData.quantity_available)

    if (!formData.title.trim()) {
      alert('Informe o nome da recompensa.')
      return
    }

    if (!Number.isFinite(pointsRequired) || pointsRequired <= 0) {
      alert('Informe uma pontuacao valida (maior que 0).')
      return
    }

    if (quantityAvailable !== null && (!Number.isFinite(quantityAvailable) || quantityAvailable < 0)) {
      alert('A quantidade deve ser zero ou maior.')
      return
    }

    if (!imageFile) {
      alert('Anexe uma imagem do item.')
      return
    }

    try {
      const { url: uploadedImageUrl } = await uploadFile.mutateAsync({
        file: imageFile,
        userId: user?.id,
      })

      await createReward.mutateAsync({
        title: formData.title.trim(),
        image_url: uploadedImageUrl,
        points_required: pointsRequired,
        quantity_available: quantityAvailable,
        category: formData.category,
        is_active: formData.is_active,
      })

      setFormData(DEFAULT_FORM)
      setImageFile(null)
      setFileInputKey((previous) => previous + 1)
      alert('Recompensa cadastrada com sucesso.')
    } catch (submitError) {
      console.error('Erro ao cadastrar recompensa:', submitError)
      alert(submitError?.message || 'Nao foi possivel cadastrar a recompensa.')
    }
  }

  const handleSaveRow = async (reward) => {
    const rowEdit = editById[reward.id]
    if (!rowEdit) return

    const pointsRequired = Number(rowEdit.points_required)
    const quantityAvailable = rowEdit.quantity_available === '' ? null : Number(rowEdit.quantity_available)

    if (!Number.isFinite(pointsRequired) || pointsRequired <= 0) {
      alert('Pontuacao invalida para este item.')
      return
    }

    if (quantityAvailable !== null && (!Number.isFinite(quantityAvailable) || quantityAvailable < 0)) {
      alert('Quantidade invalida para este item.')
      return
    }

    try {
      await updateReward.mutateAsync({
        rewardId: reward.id,
        payload: {
          points_required: pointsRequired,
          quantity_available: quantityAvailable,
        },
      })

      alert('Item atualizado com sucesso.')
    } catch (updateError) {
      console.error('Erro ao atualizar recompensa:', updateError)
      alert(updateError?.message || 'Nao foi possivel salvar este item.')
    }
  }

  const handleToggleActive = async (reward) => {
    try {
      await updateReward.mutateAsync({
        rewardId: reward.id,
        payload: {
          is_active: !reward.is_active,
        },
      })
    } catch (updateError) {
      console.error('Erro ao alterar status da recompensa:', updateError)
      alert(updateError?.message || 'Nao foi possivel alterar o status do item.')
    }
  }

  const handleDeleteReward = async (reward) => {
    const confirmed = window.confirm(`Excluir item "${reward.title}"? Esta acao nao pode ser desfeita.`)
    if (!confirmed) return

    try {
      await deleteReward.mutateAsync(reward.id)
      alert('Item excluido com sucesso.')
    } catch (deleteError) {
      console.error('Erro ao excluir recompensa:', deleteError)
      alert(deleteError?.message || 'Nao foi possivel excluir este item.')
    }
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso negado</h1>
          <p className="text-gray-600">Apenas administradores podem gerenciar recompensas.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700 mb-2 inline-flex items-center gap-2">
            Loja de Recompensas
            <Gift className="w-7 h-7" />
          </h1>
          <p className="text-gray-600">Cadastro simples: imagem, nome, pontuacao e quantidade.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Itens cadastrados</p>
              <p className="text-3xl font-bold text-gray-900">{rewards.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Itens ativos</p>
              <p className="text-3xl font-bold text-emerald-700">{totalActive}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Itens inativos</p>
              <p className="text-3xl font-bold text-gray-700">{Math.max(0, rewards.length - totalActive)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-emerald-100">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Cadastrar novo item
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nome do item</label>
                  <Input
                    value={formData.title}
                    onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Ex.: Voucher de Alimentacao"
                    required
                  />
                </div>

                <div className="rounded-md ">
                  <label className="text-sm font-medium text-emerald-700">Imagem do item</label>
                  <Input
                    key={fileInputKey}
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                    className="bg-white file:bg-emerald-100 file:text-emerald-700 file:border-0 file:rounded-md file:px-3 file:py-1.5 hover:file:bg-emerald-200"
                    required
                  />
                  <p className="text-[8px] text-gray-500 mt-1">5MB</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Pontuacao para resgate</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.points_required}
                    onChange={(event) => setFormData((prev) => ({ ...prev, points_required: event.target.value }))}
                    placeholder="100"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Quantidade disponivel</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.quantity_available}
                    onChange={(event) => setFormData((prev) => ({ ...prev, quantity_available: event.target.value }))}
                    placeholder="Deixe vazio para ilimitado"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="reward-active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(event) => setFormData((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <label htmlFor="reward-active" className="text-sm font-medium text-gray-700">Cadastrar como ativo</label>
                </div>
              </div>

              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={createReward.isPending || uploadFile.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                {(createReward.isPending || uploadFile.isPending) ? 'Salvando...' : 'Cadastrar item'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-emerald-100">
          <CardHeader>
            <CardTitle>Itens cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10 text-gray-500">Carregando itens...</div>
            ) : error ? (
              <div className="text-center py-10 text-red-600">{error?.message || 'Erro ao carregar recompensas.'}</div>
            ) : rewards.length === 0 ? (
              <div className="text-center py-10 text-gray-500">Nenhum item cadastrado.</div>
            ) : (
              <div className="space-y-4">
                {rewards.map((reward) => {
                  const rowEdit = editById[reward.id] || {
                    points_required: String(reward.points_required || ''),
                    quantity_available: reward.quantity_available == null ? '' : String(reward.quantity_available),
                  }
                  const quantityLeft = reward.quantity_available == null
                    ? 'Ilimitado'
                    : String(Math.max(0, Number(reward.quantity_available || 0) - Number(reward.quantity_claimed || 0)))

                  return (
                    <div key={reward.id} className="rounded-lg border border-gray-200 p-4 bg-white overflow-hidden">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 w-full">
                          {reward.image_url ? (
                            <img
                              src={reward.image_url}
                              alt={reward.title}
                              className="w-16 h-16 rounded-md object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                              <Gift className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{reward.title}</p>
                            <p className="text-xs text-gray-500 mt-1">Disponivel: {quantityLeft}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="outline">{CATEGORY_LABELS[reward.category] || 'Outros'}</Badge>
                              <Badge className={reward.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-700 border-gray-200'}>
                                {reward.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                              <Badge variant="outline">{reward.points_required} pts</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto lg:min-w-[320px]">
                          <Input
                            type="number"
                            min="1"
                            value={rowEdit.points_required}
                            onFocus={() => startEditingRow(reward)}
                            onChange={(event) => {
                              startEditingRow(reward)
                              setEditById((prev) => ({
                                ...prev,
                                [reward.id]: {
                                  ...rowEdit,
                                  points_required: event.target.value,
                                },
                              }))
                            }}
                            placeholder="Pontuacao"
                          />
                          <Input
                            type="number"
                            min="0"
                            value={rowEdit.quantity_available}
                            onFocus={() => startEditingRow(reward)}
                            onChange={(event) => {
                              startEditingRow(reward)
                              setEditById((prev) => ({
                                ...prev,
                                [reward.id]: {
                                  ...rowEdit,
                                  quantity_available: event.target.value,
                                },
                              }))
                            }}
                            placeholder="Quantidade"
                          />

                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => handleToggleActive(reward)}
                            disabled={updateReward.isPending}
                          >
                            {reward.is_active ? <ToggleRight className="w-4 h-4 mr-2" /> : <ToggleLeft className="w-4 h-4 mr-2" />}
                            {reward.is_active ? 'Desativar' : 'Ativar'}
                          </Button>

                          <Button
                            type="button"
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleSaveRow(reward)}
                            disabled={updateReward.isPending || deleteReward.isPending}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Salvar ajustes
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-red-300 text-red-700 hover:bg-red-50 sm:col-span-2"
                            onClick={() => handleDeleteReward(reward)}
                            disabled={deleteReward.isPending || updateReward.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir item
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
