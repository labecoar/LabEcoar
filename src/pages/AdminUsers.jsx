// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { adminUsersService } from '@/services/admin-users.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Shield, Users, Search, Pencil, Power, PowerOff, Trash2, Save, UserRound } from 'lucide-react'

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
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

const formatShortDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

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
      const haystack = [
        user.full_name,
        user.display_name,
        user.email,
        user.role,
        user.current_category,
        user.cpf,
      ].filter(Boolean).join(' ').toLowerCase()

      return haystack.includes(term)
    })
  }, [users, search])

  const totals = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.is_active !== false).length,
    inactive: users.filter((user) => user.is_active === false).length,
    admins: users.filter((user) => user.role === 'admin').length,
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

  const handleSave = async (event) => {
    event.preventDefault()
    if (!selectedUser) return

    try {
      await updateUserMutation.mutateAsync({
        userId: selectedUser.id,
        updates: {
          ...formData,
          is_active: Boolean(formData.is_active),
        },
      })
      alert('Usuário atualizado com sucesso.')
    } catch (saveError) {
      console.error('Erro ao atualizar usuário:', saveError)
      alert(saveError?.message || 'Não foi possível salvar o usuário.')
    }
  }

  const handleToggleActive = async (user) => {
    try {
      if (user.is_active === false) {
        await reactivateUserMutation.mutateAsync(user.id)
      } else {
        await deactivateUserMutation.mutateAsync(user.id)
      }
    } catch (toggleError) {
      console.error('Erro ao alterar status do usuário:', toggleError)
      alert(toggleError?.message || 'Não foi possível alterar o status do usuário.')
    }
  }

  const handleDelete = async (user) => {
    const confirmed = window.confirm(`Excluir permanentemente o usuário? Isso remove o acesso e apaga os dados vinculados.`)
    if (!confirmed) return

    try {
      await adminUsersService.deleteUser(user.id)
      alert('Usuário excluído permanentemente com sucesso.')
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (deleteError) {
      console.error('Erro ao excluir usuário:', deleteError)
      alert(deleteError?.message || 'Não foi possível excluir o usuário.')
    }
  }

  const handleInactiveClick = (user) => {
    if (user.is_active === false) {
      setSelectedInactiveUser(user)
    }
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <h1 className="text-xl font-bold mb-2">Acesso negado</h1>
            <p className="text-gray-600">Apenas administradores podem controlar usuários.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700 mb-2 inline-flex items-center gap-2">
            Controle de Usuários
            <Users className="w-7 h-7" />
          </h1>
          <p className="text-gray-600">Veja todos os perfis, edite dados e inative usuários quando precisar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Total</p><p className="text-3xl font-bold text-gray-900">{totals.total}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Ativos</p><p className="text-3xl font-bold text-emerald-700">{totals.active}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Inativos</p><p className="text-3xl font-bold text-gray-700">{totals.inactive}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Admins</p><p className="text-3xl font-bold text-amber-700">{totals.admins}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Search className="w-5 h-5 text-emerald-600" />
              Lista de usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, email, CPF, categoria ou função"
                />
              </div>
              <div className="flex items-center justify-end text-sm text-gray-500">
                {filteredUsers.length} usuário(s) exibido(s)
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-gray-600">Carregando usuários...</div>
            ) : error ? (
              <div className="py-12 text-center text-red-600 bg-red-50 border border-red-200 rounded-lg">
                Não foi possível carregar os usuários.
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-gray-500">Nenhum usuário encontrado.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Usuário</th>
                      <th className="text-left px-4 py-3 font-medium">Contato</th>
                      <th className="text-left px-4 py-3 font-medium">Perfil</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Criado em</th>
                      <th className="text-right px-4 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-t">
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-gray-900">{user.full_name || user.display_name || 'Sem nome'}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="text-gray-900 break-all">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 align-top space-y-1">
                          <Badge className={user.role === 'admin' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}>
                            {user.role === 'admin' ? 'Admin' : 'Usuário'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {user.is_active === false ? (
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleInactiveClick(user)}
                                    className="inline-flex items-center"
                                    aria-label="Ver data de inativação"
                                  >
                                    <Badge className="cursor-pointer bg-red-100 text-red-700 border-red-200 hover:bg-red-200 transition-colors">
                                      Inativo
                                    </Badge>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {user.deleted_at
                                      ? `Inativado em ${formatShortDate(user.deleted_at)}`
                                      : 'Usuário inativo'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              Ativo
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-gray-600">{formatDate(user.created_at)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(user)}
                              title="Editar usuário"
                              aria-label="Editar usuário"
                            >
                              <Pencil className="w-4 h-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleActive(user)}
                              className={user.is_active === false ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}
                              title={user.is_active === false ? 'Reativar usuário' : 'Inativar usuário'}
                              aria-label={user.is_active === false ? 'Reativar usuário' : 'Inativar usuário'}
                            >
                              {user.is_active === false ? (
                                <>
                                  <Power className="w-4 h-4" />
                                  <span className="sr-only">Reativar</span>
                                </>
                              ) : (
                                <>
                                  <PowerOff className="w-4 h-4" />
                                  <span className="sr-only">Inativar</span>
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(user)}
                              className="border-red-300 text-red-700 hover:bg-red-50"
                              title="Excluir usuário"
                              aria-label="Excluir usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sr-only">Excluir</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <UserRound className="w-5 h-5 text-emerald-600" />
              Editar usuário
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={formData.full_name} onChange={(event) => setFormData((prev) => ({ ...prev, full_name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Nome de exibição</Label>
                <Input value={formData.display_name} onChange={(event) => setFormData((prev) => ({ ...prev, display_name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formData.email} onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={formData.cpf} onChange={(event) => setFormData((prev) => ({ ...prev, cpf: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input value={formData.instagram_handle} onChange={(event) => setFormData((prev) => ({ ...prev, instagram_handle: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Avatar URL</Label>
                <Input value={formData.avatar_url} onChange={(event) => setFormData((prev) => ({ ...prev, avatar_url: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Bio</Label>
                <Textarea rows={3} value={formData.bio} onChange={(event) => setFormData((prev) => ({ ...prev, bio: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.is_active ? 'true' : 'false'} onValueChange={(value) => setFormData((prev) => ({ ...prev, is_active: value === 'true' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Seguidores</Label>
                <Input type="number" min="0" value={formData.followers_count} onChange={(event) => setFormData((prev) => ({ ...prev, followers_count: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Campanhas participadas</Label>
                <Input type="number" min="0" value={formData.campaigns_participated} onChange={(event) => setFormData((prev) => ({ ...prev, campaigns_participated: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Categoria atual</Label>
                <Select value={formData.current_category} onValueChange={(value) => setFormData((prev) => ({ ...prev, current_category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trimestre atual</Label>
                <Input value={formData.current_quarter} onChange={(event) => setFormData((prev) => ({ ...prev, current_quarter: event.target.value }))} placeholder="Q2-2026" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={updateUserMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {updateUserMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedInactiveUser)} onOpenChange={(open) => !open && setSelectedInactiveUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Status do usuário</DialogTitle>
          </DialogHeader>
          {selectedInactiveUser && (
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <strong>Nome:</strong> {selectedInactiveUser.full_name || selectedInactiveUser.display_name || 'Sem nome'}
              </p>
              <p>
                <strong>Status:</strong> Inativo
              </p>
              <p>
                <strong>Inativado em:</strong> {formatDate(selectedInactiveUser.deleted_at)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}