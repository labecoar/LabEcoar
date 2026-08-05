// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { adminUsersService } from '@/services/admin-users.service'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Shield, Users, Search, Pencil, Power, PowerOff, Trash2, Save, UserRound } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/toast'
import { C, heading, body, getModalBackground } from '@/lib/theme'
import { PageHeader, PageHeaderLabel } from "@/components/layout/PageShell";
import { usePageTheme, AdminAccessDenied, AdminEmptyState } from '@/components/admin/AdminPageHelpers';

const CATEGORY_OPTIONS = [
  { value: 'voz_e_violao', label: 'Voz e Violão' },
  { value: 'dueto', label: 'Dueto' },
  { value: 'fanfarra', label: 'Fanfarra' },
  { value: 'carnaval', label: 'Carnaval' },
]

const EMPTY_FORM = {
  full_name: '',
  display_name: '',
  email: '',
  bio: '',
  instagram_handle: '',
  cpf: '',
  avatar_url: '',
  role: 'user',
  followers_count: '',
  current_category: 'voz_e_violao',
  current_quarter: '',
  campaigns_participated: '',
  is_active: true,
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date)
}

const formatShortDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date)
}

const aInputCls = "w-full px-4 py-2.5 rounded-xl outline-none transition-all"

export default function AdminUsers() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const {
    isLight, T, mutedColor, subColor, faintColor, labelColor, textColor,
    borderColor, cardBorder, surfaceBg, itemBg,
    inputStyle, selectStyle, optionStyle, pageTitleStyle, pageSubtitleStyle,
  } = usePageTheme()
  const modalBg = getModalBackground(isLight)
  const lStyle = {
    fontSize: 11, fontWeight: 700, color: labelColor,
    display: 'block', marginBottom: 6, letterSpacing: '0.05em', ...body,
  }
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedInactiveUser, setSelectedInactiveUser] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminUsersService.listUsers(),
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, updates }) => adminUsersService.updateUser(userId, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setSelectedUser(null)
    },
  })

  const deactivateUserMutation = useMutation({
    mutationFn: (userId) => adminUsersService.deactivateUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const reactivateUserMutation = useMutation({
    mutationFn: (userId) => adminUsersService.reactivateUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) => {
      const haystack = [user.full_name, user.display_name, user.email, user.role, user.current_category, user.cpf]
        .filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [users, search])

  const totals = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.is_active !== false).length,
    inactive: users.filter((u) => u.is_active === false).length,
    admins: users.filter((u) => u.role === 'admin').length,
  }), [users])

  const openEdit = (user) => {
    setSelectedUser(user)
    setSelectedInactiveUser(null)
    setFormData({
      full_name: user.full_name || '',
      display_name: user.display_name || '',
      email: user.email || '',
      bio: user.bio || '',
      instagram_handle: user.instagram_handle || '',
      cpf: user.cpf || '',
      avatar_url: user.avatar_url || '',
      role: user.role || 'user',
      followers_count: user.followers_count ?? '',
      current_category: user.current_category || 'voz_e_violao',
      current_quarter: user.current_quarter || '',
      campaigns_participated: user.campaigns_participated ?? '',
      is_active: user.is_active !== false,
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!selectedUser) return
    try {
      await updateUserMutation.mutateAsync({ userId: selectedUser.id, updates: { ...formData, is_active: Boolean(formData.is_active) } })
      notifySuccess('Usuário atualizado com sucesso.')
    } catch (err) {
      notifyError(err?.message || 'Não foi possível salvar o usuário.')
    }
  }

  const handleToggleActive = async (user) => {
    try {
      if (user.is_active === false) {
        await reactivateUserMutation.mutateAsync(user.id)
      } else {
        await deactivateUserMutation.mutateAsync(user.id)
      }
    } catch (err) {
      notifyError(err?.message || 'Não foi possível alterar o status do usuário.')
    }
  }

  const handleDelete = async (user) => {
    if (!window.confirm('Excluir permanentemente o usuário? Isso remove o acesso e apaga os dados vinculados.')) return
    try {
      await adminUsersService.deleteUser(user.id)
      notifySuccess('Usuário excluído permanentemente.')
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (err) {
      notifyError(err?.message || 'Não foi possível excluir o usuário.')
    }
  }

  if (profile?.role !== 'admin') {
    return (
      <AdminAccessDenied
        icon={Shield}
        message="Apenas administradores podem controlar usuários."
      />
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <PageHeader>
        <PageHeaderLabel icon={Users}>Controle de Usuários</PageHeaderLabel>
      </PageHeader>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0 space-y-6 md:space-y-8">

        {/* Hero */}
        <div>
          <h1 style={{ ...pageTitleStyle, fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Usuários
          </h1>
          <p style={pageSubtitleStyle}>
            Veja todos os perfis, edite dados e inative usuários quando precisar.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: totals.total, color: textColor },
            { label: 'Ativos', value: totals.active, color: C.lime },
            { label: 'Inativos', value: totals.inactive, color: mutedColor },
            { label: 'Admins', value: totals.admins, color: C.orange },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-5 rounded-2xl" style={{ backgroundColor: surfaceBg, border: `1px solid ${cardBorder}` }}>
              <div style={{ fontSize: 11, color: mutedColor, marginBottom: 6 }}>{label}</div>
              <div style={{ ...heading, fontSize: 32, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tabela */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? C.card : 'rgba(var(--ink),0.02)', border: `1px solid ${borderColor}` }}>

          {/* Card header + busca */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4"
            style={{ borderBottom: `1px solid ${borderColor}` }}>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
              <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>Lista de Usuários</span>
              <span style={{ fontSize: 12, color: faintColor }}>{filteredUsers.length} exibido(s)</span>
            </div>
            <div className="relative max-w-sm w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: faintColor }} />
              <input
                className={`${aInputCls} ${isLight ? 'placeholder:text-[#8A8A88]' : ''}`}
                style={{ ...inputStyle, paddingLeft: 34 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email, CPF..."
              />
            </div>
          </div>

          {/* Conteúdo */}
          <div className="p-0">
            {isLoading ? (
              <div className="py-16 text-center" style={{ color: mutedColor }}>Carregando usuários...</div>
            ) : error ? (
              <div className="py-12 text-center mx-6 my-6 rounded-xl" style={{ color: '#f87171', backgroundColor: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                Não foi possível carregar os usuários.
              </div>
            ) : filteredUsers.length === 0 ? (
              <AdminEmptyState icon={Users} title="Nenhum usuário encontrado." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.06)'}` }}>
                      {['Usuário', 'Email', 'Função', 'Status', 'Criado em', ''].map((h) => (
                        <th key={h} className="text-left px-5 py-3" style={{ fontSize: 10, fontWeight: 700, color: faintColor, letterSpacing: '0.08em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, i) => (
                      <tr
                        key={user.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? 'transparent' : (isLight ? T.itemBg : 'rgba(var(--ink),0.015)'),
                          borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.04)'}`,
                        }}
                      >
                        <td className="px-5 py-3 max-w-[240px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                              style={{ backgroundColor: C.orange, color: C.cream }}>
                              {(user.full_name || user.display_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span
                              className="truncate min-w-0"
                              title={user.full_name || user.display_name || 'Sem nome'}
                              style={{ fontWeight: 600, color: textColor, fontSize: 13 }}
                            >
                              {user.full_name || user.display_name || 'Sem nome'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 max-w-[220px]">
                          <span
                            className="block truncate"
                            title={user.email || ''}
                            style={{ color: subColor, fontSize: 13 }}
                          >
                            {user.email}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{
                            backgroundColor: user.role === 'admin' ? `${C.orange}18` : `${C.lime}18`,
                            color: user.role === 'admin' ? C.orange : (isLight ? C.darkGreen : C.lime),
                          }}>
                            {user.role === 'admin' ? 'Admin' : 'Usuário'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {user.is_active === false ? (
                            <button
                              type="button"
                              onClick={() => setSelectedInactiveUser(user)}
                              className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#f87171', cursor: 'pointer' }}
                            >
                              Inativo
                            </button>
                          ) : (
                            <span
                              className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: `${C.lime}18`, color: isLight ? C.darkGreen : C.lime }}
                            >
                              Ativo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3" style={{ color: faintColor, fontSize: 12 }}>{formatDate(user.created_at)}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(user)}
                              className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                              style={{ border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`, backgroundColor: 'transparent', color: isLight ? T.textSub : `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                            >
                              <Pencil size={12} /> Editar
                            </button>
                            <button
                              onClick={() => handleToggleActive(user)}
                              className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                              style={{
                                border: `1px solid ${user.is_active === false ? 'rgba(180,255,0,0.3)' : 'rgba(255,100,0,0.3)'}`,
                                backgroundColor: 'transparent',
                                color: user.is_active === false ? (isLight ? C.darkGreen : C.lime) : C.orange,
                                fontSize: 12, fontWeight: 600, ...heading
                              }}
                            >
                              {user.is_active === false ? <><Power size={12} /> Reativar</> : <><PowerOff size={12} /> Inativar</>}
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                              style={{ border: `1px solid rgba(248,113,113,0.25)`, backgroundColor: 'transparent', color: '#f87171', fontSize: 12, fontWeight: 600, ...heading }}
                            >
                              <Trash2 size={12} /> Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal editar usuário */}
      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-2xl p-0 border-0 bg-transparent overflow-hidden shadow-none">
          <DialogTitle className="sr-only">Editar Usuário</DialogTitle>
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: modalBg, border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.1)'}` }}>
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <UserRound size={15} style={{ color: C.lime }} />
              <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: textColor }}>Editar Usuário</span>
            </div>

            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'NOME COMPLETO', key: 'full_name', placeholder: '' },
                  { label: 'NOME DE EXIBIÇÃO', key: 'display_name', placeholder: '' },
                  { label: 'EMAIL', key: 'email', placeholder: '' },
                  { label: 'CPF', key: 'cpf', placeholder: '' },
                  { label: 'INSTAGRAM', key: 'instagram_handle', placeholder: '@perfil' },
                  { label: 'AVATAR URL', key: 'avatar_url', placeholder: 'https://...' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={lStyle}>{label}</label>
                    <input
                      className={aInputCls}
                      style={inputStyle}
                      value={formData[key]}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </div>
                ))}

                <div className="md:col-span-2">
                  <label style={lStyle}>BIO</label>
                  <textarea
                    className={aInputCls}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    rows={3}
                    value={formData.bio}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                  />
                </div>

                {[
                  { label: 'FUNÇÃO', key: 'role', options: [{ value: 'user', label: 'Usuário' }, { value: 'admin', label: 'Admin' }] },
                  { label: 'STATUS', key: 'is_active', options: [{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }] },
                  { label: 'CATEGORIA ATUAL', key: 'current_category', options: CATEGORY_OPTIONS },
                ].map(({ label, key, options }) => (
                  <div key={key} className="relative">
                    <label style={lStyle}>{label}</label>
                    <select
                      className={aInputCls}
                      style={selectStyle}
                      value={key === 'is_active' ? String(formData.is_active) : formData[key]}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        [key]: key === 'is_active' ? e.target.value === 'true' : e.target.value,
                      }))}
                    >
                      {options.map((o) => (
                        <option key={o.value} value={o.value} style={optionStyle}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {[
                  { label: 'SEGUIDORES', key: 'followers_count', type: 'number' },
                  { label: 'CAMPANHAS PARTICIPADAS', key: 'campaigns_participated', type: 'number' },
                  { label: 'TRIMESTRE ATUAL', key: 'current_quarter', type: 'text', placeholder: 'Q2-2026' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label style={lStyle}>{label}</label>
                    <input
                      className={aInputCls}
                      style={inputStyle}
                      type={type}
                      min={type === 'number' ? '0' : undefined}
                      value={formData[key]}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 h-12 rounded-xl transition-all hover:brightness-110"
                  style={{ backgroundColor: itemBg, border: `1px solid ${borderColor}`, color: isLight ? T.textSub : `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="flex-1 h-12 rounded-xl transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                >
                  <Save size={15} />
                  {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal usuário inativo */}
      <Dialog open={Boolean(selectedInactiveUser)} onOpenChange={(open) => !open && setSelectedInactiveUser(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 border-0 bg-transparent overflow-hidden shadow-none">
          <DialogTitle className="sr-only">Status do Usuário</DialogTitle>
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: modalBg, border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.1)'}` }}>
            <div className="px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: textColor }}>Status do Usuário</span>
            </div>
            {selectedInactiveUser && (
              <div className="p-6 flex flex-col gap-3">
                {[
                  { label: 'Nome', value: selectedInactiveUser.full_name || selectedInactiveUser.display_name || 'Sem nome' },
                  { label: 'Status', value: 'Inativo' },
                  { label: 'Inativado em', value: formatDate(selectedInactiveUser.deleted_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.05)'}` }}>
                    <span style={{ fontSize: 12, color: mutedColor }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{value}</span>
                  </div>
                ))}
                <button
                  onClick={() => setSelectedInactiveUser(null)}
                  className="w-full h-11 rounded-xl transition-all hover:brightness-110 mt-2"
                  style={{ backgroundColor: itemBg, border: `1px solid ${borderColor}`, color: isLight ? T.textSub : `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}