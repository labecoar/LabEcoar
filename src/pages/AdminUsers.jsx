// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { adminUsersService } from '@/services/admin-users.service'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Shield, Users, Search, Pencil, Power, PowerOff, Trash2, Save, UserRound, ChevronDown } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/toast'
import { C, heading, body } from '@/lib/theme'

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
const aInputStyle = (C, body) => ({
  border: `1px solid rgba(var(--ink),0.12)`,
  backgroundColor: 'rgba(var(--ink),0.04)',
  color: C.cream,
  fontSize: 13,
  ...body,
})
const aSelectStyle = (C, body) => ({
  ...aInputStyle(C, body),
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23FFFFDE' stroke-width='2' stroke-opacity='0.4'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
})
const labelStyle = (C, body) => ({
  fontSize: 11, fontWeight: 700, color: `${C.cream}60`,
  display: 'block', marginBottom: 6, letterSpacing: '0.05em', ...body,
})

export default function AdminUsers() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
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

  const iStyle = aInputStyle(C, body)
  const sStyle = aSelectStyle(C, body)
  const lStyle = labelStyle(C, body)

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
        <div className="max-w-md p-8 rounded-2xl text-center" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.08)` }}>
          <Shield size={36} style={{ color: '#f87171', margin: '0 auto 16px' }} />
          <h2 style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream }} className="mb-2">Acesso Negado</h2>
          <p style={{ color: `${C.cream}60`, fontSize: 14 }}>Apenas administradores podem controlar usuários.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <div className="hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10"
        style={{ backgroundColor: `${C.black}F5`, backdropFilter: 'blur(16px)', borderBottom: `1px solid rgba(var(--ink),0.05)` }}>
        <div className="flex items-center gap-3">
          <Users size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Controle de Usuários
          </span>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0 space-y-6 md:space-y-8">

        {/* Hero */}
        <div>
          <h1 style={{ ...heading, fontSize: 40, fontWeight: 900, color: C.cream, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Usuários
          </h1>
          <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>
            Veja todos os perfis, edite dados e inative usuários quando precisar.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: totals.total, color: C.cream },
            { label: 'Ativos', value: totals.active, color: C.lime },
            { label: 'Inativos', value: totals.inactive, color: `${C.cream}50` },
            { label: 'Admins', value: totals.admins, color: C.orange },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-5 rounded-2xl" style={{ backgroundColor: 'rgba(var(--ink),0.03)', border: `1px solid rgba(var(--ink),0.06)` }}>
              <div style={{ fontSize: 11, color: `${C.cream}50`, marginBottom: 6 }}>{label}</div>
              <div style={{ ...heading, fontSize: 32, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tabela */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(var(--ink),0.02)', border: `1px solid rgba(var(--ink),0.07)` }}>

          {/* Card header + busca */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4"
            style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
              <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Lista de Usuários</span>
              <span style={{ fontSize: 12, color: `${C.cream}40` }}>{filteredUsers.length} exibido(s)</span>
            </div>
            <div className="relative max-w-sm w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${C.cream}40` }} />
              <input
                className={aInputCls}
                style={{ ...iStyle, paddingLeft: 34 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email, CPF..."
              />
            </div>
          </div>

          {/* Conteúdo */}
          <div className="p-0">
            {isLoading ? (
              <div className="py-16 text-center" style={{ color: `${C.cream}50` }}>Carregando usuários...</div>
            ) : error ? (
              <div className="py-12 text-center mx-6 my-6 rounded-xl" style={{ color: '#f87171', backgroundColor: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                Não foi possível carregar os usuários.
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Users size={32} style={{ color: `${C.cream}20` }} />
                <p style={{ ...heading, fontSize: 16, color: `${C.cream}40` }}>Nenhum usuário encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid rgba(var(--ink),0.06)` }}>
                      {['Usuário', 'Email', 'Função', 'Status', 'Criado em', ''].map((h) => (
                        <th key={h} className="text-left px-5 py-3" style={{ fontSize: 10, fontWeight: 700, color: `${C.cream}40`, letterSpacing: '0.08em' }}>
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
                          backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(var(--ink),0.015)',
                          borderBottom: `1px solid rgba(var(--ink),0.04)`,
                        }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                              style={{ backgroundColor: C.orange, color: C.cream }}>
                              {(user.full_name || user.display_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: C.cream, fontSize: 13 }}>
                              {user.full_name || user.display_name || 'Sem nome'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3" style={{ color: `${C.cream}60`, fontSize: 13 }}>{user.email}</td>
                        <td className="px-5 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{
                            backgroundColor: user.role === 'admin' ? `${C.orange}18` : `${C.lime}18`,
                            color: user.role === 'admin' ? C.orange : C.lime,
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
                              style={{ backgroundColor: `${C.lime}18`, color: C.lime }}
                            >
                              Ativo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3" style={{ color: `${C.cream}40`, fontSize: 12 }}>{formatDate(user.created_at)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(user)}
                              className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                              style={{ border: `1px solid rgba(var(--ink),0.12)`, backgroundColor: 'transparent', color: `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                            >
                              <Pencil size={12} /> Editar
                            </button>
                            <button
                              onClick={() => handleToggleActive(user)}
                              className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                              style={{
                                border: `1px solid ${user.is_active === false ? 'rgba(180,255,0,0.3)' : 'rgba(255,100,0,0.3)'}`,
                                backgroundColor: 'transparent',
                                color: user.is_active === false ? C.lime : C.orange,
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
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.1)` }}>
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
              <UserRound size={15} style={{ color: C.lime }} />
              <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>Editar Usuário</span>
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
                      style={iStyle}
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
                    style={{ ...iStyle, resize: 'vertical' }}
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
                      style={sStyle}
                      value={key === 'is_active' ? String(formData.is_active) : formData[key]}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        [key]: key === 'is_active' ? e.target.value === 'true' : e.target.value,
                      }))}
                    >
                      {options.map((o) => (
                        <option key={o.value} value={o.value} style={{ backgroundColor: C.card }}>{o.label}</option>
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
                      style={iStyle}
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
                  style={{ backgroundColor: 'rgba(var(--ink),0.04)', border: `1px solid rgba(var(--ink),0.07)`, color: `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}
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
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.1)` }}>
            <div className="px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
              <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>Status do Usuário</span>
            </div>
            {selectedInactiveUser && (
              <div className="p-6 flex flex-col gap-3">
                {[
                  { label: 'Nome', value: selectedInactiveUser.full_name || selectedInactiveUser.display_name || 'Sem nome' },
                  { label: 'Status', value: 'Inativo' },
                  { label: 'Inativado em', value: formatDate(selectedInactiveUser.deleted_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid rgba(var(--ink),0.05)` }}>
                    <span style={{ fontSize: 12, color: `${C.cream}50` }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.cream }}>{value}</span>
                  </div>
                ))}
                <button
                  onClick={() => setSelectedInactiveUser(null)}
                  className="w-full h-11 rounded-xl transition-all hover:brightness-110 mt-2"
                  style={{ backgroundColor: 'rgba(var(--ink),0.04)', border: `1px solid rgba(var(--ink),0.07)`, color: `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}
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