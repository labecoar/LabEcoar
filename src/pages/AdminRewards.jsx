// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminRewards, useCreateReward, useDeleteReward, useUpdateReward } from '@/hooks/useRewards'
import { useUploadFile } from '@/hooks/useStorage'
import { Gift, Plus, Save, ToggleLeft, ToggleRight, Trash2, XCircle } from 'lucide-react'
import { notifyError, notifySuccess, notifyWarning } from '@/lib/toast'
import { C, heading, body } from '@/lib/theme'
import { PageHeader, PageHeaderLabel } from "@/components/layout/PageShell";
import { usePageTheme, AdminAccessDenied, AdminEmptyState } from '@/components/admin/AdminPageHelpers';

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
  const {
    textColor, mutedColor, subColor, faintColor, cardBorder,
    surfaceBg, surfaceBgAlt, labelColor, inputStyle, selectStyle, optionStyle,
    pageTitleStyle, pageSubtitleStyle,
  } = usePageTheme()

  const formInputStyle = {
    ...inputStyle,
    borderRadius: 12,
    padding: '10px 16px',
    outline: 'none',
    width: '100%',
  }

  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: labelColor,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  }
  const [formData, setFormData] = useState(DEFAULT_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [editById, setEditById] = useState({})

  const { data: rewards = [], isLoading, error } = useAdminRewards()
  const createReward = useCreateReward(user?.id)
  const updateReward = useUpdateReward()
  const deleteReward = useDeleteReward()
  const uploadFile = useUploadFile()

  const totalActive = useMemo(() => rewards.filter((r) => Boolean(r.is_active)).length, [rewards])

  const startEditingRow = (reward) => {
    setEditById((prev) => {
      if (prev[reward.id]) return prev
      return {
        ...prev,
        [reward.id]: {
          points_required: String(reward.points_required || ''),
          quantity_available: reward.quantity_available == null ? '' : String(reward.quantity_available),
        },
      }
    })
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    const pointsRequired = Number(formData.points_required)
    const quantityAvailable = formData.quantity_available === '' ? null : Number(formData.quantity_available)
    if (!formData.title.trim()) { notifyWarning('Informe o nome da recompensa.'); return }
    if (!Number.isFinite(pointsRequired) || pointsRequired <= 0) { notifyWarning('Informe uma pontuacao valida (maior que 0).'); return }
    if (quantityAvailable !== null && (!Number.isFinite(quantityAvailable) || quantityAvailable < 0)) { notifyWarning('A quantidade deve ser zero ou maior.'); return }
    if (!imageFile) { notifyWarning('Anexe uma imagem do item.'); return }
    try {
      const { url: uploadedImageUrl } = await uploadFile.mutateAsync({ file: imageFile, userId: user?.id })
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
      setFileInputKey((prev) => prev + 1)
      notifySuccess('Recompensa cadastrada com sucesso.')
    } catch (submitError) {
      console.error('Erro ao cadastrar recompensa:', submitError)
      notifyError(submitError?.message || 'Nao foi possivel cadastrar a recompensa.')
    }
  }

  const handleSaveRow = async (reward) => {
    const rowEdit = editById[reward.id]
    if (!rowEdit) return
    const pointsRequired = Number(rowEdit.points_required)
    const quantityAvailable = rowEdit.quantity_available === '' ? null : Number(rowEdit.quantity_available)
    if (!Number.isFinite(pointsRequired) || pointsRequired <= 0) { notifyWarning('Pontuacao invalida para este item.'); return }
    if (quantityAvailable !== null && (!Number.isFinite(quantityAvailable) || quantityAvailable < 0)) { notifyWarning('Quantidade invalida para este item.'); return }
    try {
      await updateReward.mutateAsync({ rewardId: reward.id, payload: { points_required: pointsRequired, quantity_available: quantityAvailable } })
      setEditById((prev) => { const s = { ...prev }; delete s[reward.id]; return s })
      notifySuccess('Item atualizado com sucesso.')
    } catch (updateError) {
      console.error('Erro ao atualizar recompensa:', updateError)
      notifyError(updateError?.message || 'Nao foi possivel salvar este item.')
    }
  }

  const handleToggleActive = async (reward) => {
    try {
      await updateReward.mutateAsync({ rewardId: reward.id, payload: { is_active: !reward.is_active } })
    } catch (updateError) {
      console.error('Erro ao alterar status:', updateError)
      notifyError(updateError?.message || 'Nao foi possivel alterar o status do item.')
    }
  }

  const handleDeleteReward = async (reward) => {
    const confirmed = window.confirm(`Excluir item "${reward.title}"? Esta acao nao pode ser desfeita.`)
    if (!confirmed) return
    try {
      await deleteReward.mutateAsync(reward.id)
      notifySuccess('Item excluido com sucesso.')
    } catch (deleteError) {
      console.error('Erro ao excluir recompensa:', deleteError)
      notifyError(deleteError?.message || 'Nao foi possivel excluir este item.')
    }
  }

  if (profile?.role !== 'admin') {
    return <AdminAccessDenied message="Apenas administradores podem gerenciar recompensas." icon={XCircle} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <PageHeader>
        <PageHeaderLabel icon={Gift}>Loja de Recompensas</PageHeaderLabel>
      </PageHeader>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0 space-y-6 md:space-y-8">

        {/* Hero */}
        <div>
          <h1 style={{ ...pageTitleStyle, fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Loja de Recompensas
          </h1>
          <p style={pageSubtitleStyle}>
            Cadastro simples: imagem, nome, pontuacao e quantidade.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
          {[
            { label: 'Itens cadastrados', value: rewards.length, color: textColor },
            { label: 'Itens ativos', value: totalActive, color: C.lime },
            { label: 'Itens inativos', value: Math.max(0, rewards.length - totalActive), color: subColor },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-4 p-5 rounded-2xl"
              style={{ backgroundColor: surfaceBg, border: `1px solid ${cardBorder}` }}>
              <div>
                <div style={{ ...heading, fontSize: 28, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ fontSize: 11, color: mutedColor, marginTop: 4 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Formulário de cadastro */}
        <div className="p-6 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid ${cardBorder}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Plus size={15} style={{ color: C.lime }} />
            <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>Cadastrar novo item</span>
          </div>

          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label style={labelStyle}>Nome do item</label>
                <input
                  style={formInputStyle}
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex.: Voucher de Alimentacao"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Imagem do item</label>
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  style={{ ...formInputStyle, padding: '8px 16px' }}
                  required
                />
                <p style={{ fontSize: 10, color: faintColor, marginTop: 4 }}>Máx. 5MB</p>
              </div>

              <div>
                <label style={labelStyle}>Pontuacao para resgate</label>
                <input
                  type="number"
                  min="1"
                  style={formInputStyle}
                  value={formData.points_required}
                  onChange={(e) => setFormData((prev) => ({ ...prev, points_required: e.target.value }))}
                  placeholder="100"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Quantidade disponivel</label>
                <input
                  type="number"
                  min="0"
                  style={formInputStyle}
                  value={formData.quantity_available}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantity_available: e.target.value }))}
                  placeholder="Deixe vazio para ilimitado"
                />
              </div>

              <div>
                <label style={labelStyle}>Categoria</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  style={{ ...selectStyle, borderRadius: 12, padding: '10px 16px', width: '100%' }}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} style={optionStyle}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  id="reward-active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                  style={{ accentColor: C.lime, width: 16, height: 16 }}
                />
                <label htmlFor="reward-active" style={{ fontSize: 13, color: subColor }}>Cadastrar como ativo</label>
              </div>
            </div>

            <button
              type="submit"
              disabled={createReward.isPending || uploadFile.isPending}
              className="flex items-center gap-2 px-6 h-11 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
            >
              <Plus size={15} />
              {(createReward.isPending || uploadFile.isPending) ? 'Salvando...' : 'Cadastrar item'}
            </button>
          </form>
        </div>

        {/* Lista de itens */}
        <div className="p-6 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid ${cardBorder}` }}>
          <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor, display: 'block', marginBottom: 20 }}>
            Itens cadastrados
          </span>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4" style={{ borderColor: C.lime }} />
                <p style={{ color: mutedColor }}>Carregando itens...</p>
              </div>
            </div>
          ) : error ? (
            <p style={{ color: '#f87171', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
              {error?.message || 'Erro ao carregar recompensas.'}
            </p>
          ) : rewards.length === 0 ? (
            <AdminEmptyState icon={Gift} title="Nenhum item cadastrado" />
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
                  <div key={reward.id} className="p-4 rounded-xl"
                    style={{ backgroundColor: surfaceBg, border: `1px solid ${cardBorder}` }}>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

                      {/* Info do item */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {reward.image_url ? (
                          <img src={reward.image_url} alt={reward.title}
                            className="w-16 h-16 rounded-xl object-cover shrink-0"
                            style={{ border: `1px solid ${cardBorder}` }} />
                        ) : (
                          <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                            <Gift size={20} style={{ color: faintColor }} />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p style={{ ...heading, fontSize: 14, fontWeight: 700, color: textColor }} className="truncate">{reward.title}</p>
                          <p style={{ fontSize: 11, color: faintColor, marginTop: 2 }}>Disponivel: {quantityLeft}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: surfaceBgAlt, color: subColor }}>
                              {CATEGORY_LABELS[reward.category] || 'Outros'}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: reward.is_active ? C.lime_back : surfaceBgAlt, color: reward.is_active ? C.lime : C.orange }}>
                              {reward.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: C.orange_back, color: C.orange }}>
                              {reward.points_required} pts
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controles */}
                      <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-72">
                        <div className="flex gap-2">
                          <div className="flex items-center gap-2 flex-1 px-3 h-10 rounded-xl"
                            style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: mutedColor, whiteSpace: 'nowrap' }}>Pts</span>
                            <input
                              type="number"
                              min="1"
                              style={{ backgroundColor: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: 13, width: '100%', ...body }}
                              value={rowEdit.points_required}
                              onFocus={() => startEditingRow(reward)}
                              onChange={(e) => setEditById((prev) => ({
                                ...prev,
                                [reward.id]: {
                                  ...(prev[reward.id] || { points_required: String(reward.points_required || ''), quantity_available: reward.quantity_available == null ? '' : String(reward.quantity_available) }),
                                  points_required: e.target.value,
                                },
                              }))}
                              placeholder="100"
                            />
                          </div>

                          <div className="flex items-center gap-2 flex-1 px-3 h-10 rounded-xl"
                            style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: mutedColor, whiteSpace: 'nowrap' }}>Qtd</span>
                            <input
                              type="number"
                              min="0"
                              style={{ backgroundColor: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: 13, width: '100%', ...body }}
                              value={rowEdit.quantity_available}
                              onFocus={() => startEditingRow(reward)}
                              onChange={(e) => setEditById((prev) => ({
                                ...prev,
                                [reward.id]: {
                                  ...(prev[reward.id] || { points_required: String(reward.points_required || ''), quantity_available: reward.quantity_available == null ? '' : String(reward.quantity_available) }),
                                  quantity_available: e.target.value,
                                },
                              }))}
                              placeholder="∞"
                            />
                          </div>
                        </div>


                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(reward)}
                            disabled={updateReward.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ border: `1px solid ${C.orange}40`, 
                            backgroundColor: reward.is_active ? C.orange_back : C.lime_back,
                            color: reward.is_active ? C.orange : "white", ...heading, fontWeight: 600, fontSize: 12 }}
                          >
                            {reward.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                            {reward.is_active ? 'Inativar' : 'Ativar'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveRow(reward)}
                            disabled={updateReward.isPending || deleteReward.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ border: `1px solid ${C.lime}40`, backgroundColor: C.lime_back, color: C.lime, ...heading, fontWeight: 600, fontSize: 12 }}
                          >
                            <Save size={13} />Salvar
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteReward(reward)}
                            disabled={deleteReward.isPending || updateReward.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ border: '1px solid rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.08)', color: '#f87171', ...heading, fontWeight: 600, fontSize: 12 }}
                          >
                            <Trash2 size={13} />Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}