// @ts-nocheck
import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminRewardClaims, useUpdateRewardClaim } from '@/hooks/useRewards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Gift, Clock, CheckCircle, AlertCircle, XCircle, Calendar, User, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { notifyError, notifySuccess, notifyWarning } from '@/lib/toast'

const STATUS_LABELS = {
  pendente: 'Pendente',
  processando: 'Processando',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const STATUS_COLORS = {
  pendente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  processando: 'bg-blue-100 text-blue-700 border-blue-200',
  entregue: 'bg-green-100 text-green-700 border-green-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_ICONS = {
  pendente: Clock,
  processando: AlertCircle,
  entregue: CheckCircle,
  cancelado: XCircle,
}

export default function AdminRewardClaims() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('pendente')
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [newStatus, setNewStatus] = useState(null)
  const [notes, setNotes] = useState('')

  const { data: allClaims = [], isLoading } = useAdminRewardClaims()
  const updateClaim = useUpdateRewardClaim()

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pendenteClaims = allClaims.filter((claim) => claim.status === 'pendente')
  const processandoClaims = allClaims.filter((claim) => claim.status === 'processando')
  const entreguesClaims = allClaims.filter((claim) => claim.status === 'entregue')
  const canceladosClaims = allClaims.filter((claim) => claim.status === 'cancelado')

  const tabData = {
    pendente: { label: 'Pendentes', items: pendenteClaims, count: pendenteClaims.length },
    processando: { label: 'Processando', items: processandoClaims, count: processandoClaims.length },
    entregue: { label: 'Entregues', items: entreguesClaims, count: entreguesClaims.length },
    cancelado: { label: 'Cancelados', items: canceladosClaims, count: canceladosClaims.length },
  }

  const visibleItems = tabData[activeTab].items

  const handleOpenClaim = (claim) => {
    setSelectedClaim(claim)
    setNewStatus(claim.status)
    setNotes(claim.notes || '')
  }

  const handleUpdateClaim = async () => {
    if (!selectedClaim) return

    try {
      await updateClaim.mutateAsync({
        claimId: selectedClaim.id,
        payload: {
          status: newStatus,
          notes: notes.trim() || null,
          delivered_at: newStatus === 'entregue' ? new Date().toISOString() : null,
        },
      })

      notifySuccess('Resgate atualizado com sucesso!')
      setSelectedClaim(null)
      setNewStatus(null)
      setNotes('')
    } catch (error) {
      console.error('Erro ao atualizar resgate:', error)
      notifyError('Erro ao atualizar resgate.')
    }
  }

  const ClaimCard = ({ claim }) => {
    const StatusIcon = STATUS_ICONS[claim.status] || Clock

    return (
      <Card
        className="cursor-pointer overflow-hidden border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-300"
        onClick={() => handleOpenClaim(claim)}
      >
        <CardContent className="p-4 space-y-4">
          {/* HEADER */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-[17px] leading-snug text-[#3c0b14] line-clamp-2">
                {claim.reward_title || 'Recompensa'}
              </CardTitle>

              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <User className="w-4 h-4" />
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-gray-900 line-clamp-1">
                    {claim.user_name || 'Ecoante'}
                  </p>

                  <p className="text-xs text-gray-500 line-clamp-1">
                    {claim.user_email}
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <Badge className={`${STATUS_COLORS[claim.status]} border`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {STATUS_LABELS[claim.status] || claim.status}
              </Badge>
            </div>
          </div>

          {/* PONTOS */}
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
            <Gift className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {Number(claim.points_spent || 0).toLocaleString('pt-BR')} pontos
            </span>
          </div>

          {/* NOTAS */}
          {claim.notes && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Observações
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words line-clamp-2">
                {claim.notes}
              </p>
            </div>
          )}

          {/* DATAS */}
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Resgatado em {format(new Date(claim.claimed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </span>
            </div>

            {claim.delivered_at && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 text-green-600" />
                <span className="truncate">
                  Entregue em {format(new Date(claim.delivered_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando resgates de recompensas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700 mb-2 inline-flex items-center gap-2">
            Resgates de Recompensas
            <Gift className="w-7 h-7" />
          </h1>
          <p className="text-gray-600">Gerencie os resgates de recompensas dos ecoantes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-yellow-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-xl">
                  <Clock className="w-5 h-5 text-yellow-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pendentes</p>
                  <p className="text-2xl font-bold text-gray-900">{pendenteClaims.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Processando</p>
                  <p className="text-2xl font-bold text-gray-900">{processandoClaims.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Entregues</p>
                  <p className="text-2xl font-bold text-gray-900">{entreguesClaims.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <XCircle className="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cancelados</p>
                  <p className="text-2xl font-bold text-gray-900">{canceladosClaims.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 mb-6">
          {Object.entries(tabData).map(([key, data]) => (
            <button
              key={key}
              type="button"
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                activeTab === key ? 'bg-white text-[#3c0b14] shadow-sm' : 'text-gray-600'
              }`}
              onClick={() => setActiveTab(key)}
            >
              {data.label} ({data.count})
            </button>
          ))}
        </div>

        {visibleItems.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Gift className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Nenhum resgate {tabData[activeTab].label.toLowerCase()}
              </h3>
              <p className="text-gray-500">
                Resgates de recompensas com status "{STATUS_LABELS[activeTab]}" aparecerão aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleItems.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} />
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {selectedClaim && (
        <Dialog open={!!selectedClaim} onOpenChange={(open) => !open && setSelectedClaim(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                {selectedClaim.reward_title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* USUÁRIO */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-sm font-medium text-gray-600 mb-2">Ecoante</p>
                <p className="font-medium text-gray-900">{selectedClaim.user_name}</p>
                <p className="text-sm text-gray-500">{selectedClaim.user_email}</p>
              </div>

              {/* PONTOS */}
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm font-medium text-amber-700 mb-2">Pontos Gastos</p>
                <p className="text-2xl font-bold text-amber-900">
                  {Number(selectedClaim.points_spent || 0).toLocaleString('pt-BR')}
                </p>
              </div>

              {/* STATUS */}
              <div>
                <Label className="text-base font-semibold mb-2 block">Status</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setNewStatus(key)}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                        newStatus === key
                          ? `${STATUS_COLORS[key]} border-2 ring-2 ring-offset-1`
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ENDEREÇO DE ENTREGA */}
              {(selectedClaim.cep || selectedClaim.endereco) && (
                <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-900">Endereço de Entrega</p>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-700">
                    {selectedClaim.cep && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600 min-w-20">CEP:</span>
                        <span>{selectedClaim.cep}</span>
                      </div>
                    )}
                    
                    {selectedClaim.endereco && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-gray-600 min-w-20">Rua:</span>
                        <span>{selectedClaim.endereco}</span>
                      </div>
                    )}
                    
                    {selectedClaim.numero && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600 min-w-20">Número:</span>
                        <span>{selectedClaim.numero}</span>
                      </div>
                    )}
                    
                    {selectedClaim.complemento && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600 min-w-20">Complemento:</span>
                        <span>{selectedClaim.complemento}</span>
                      </div>
                    )}
                    
                    {selectedClaim.bairro && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600 min-w-20">Bairro:</span>
                        <span>{selectedClaim.bairro}</span>
                      </div>
                    )}
                    
                    {(selectedClaim.cidade || selectedClaim.estado) && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600 min-w-20">Cidade:</span>
                        <span>
                          {selectedClaim.cidade}
                          {selectedClaim.estado && ` - ${selectedClaim.estado}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CÓDIGO DE ENTREGA */}
              {/* Removido - coluna não existe no banco */}

              {/* NOTAS */}
              <div>
                <Label htmlFor="notes" className="text-base font-semibold mb-2 block">
                  Observações
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Adicione observações sobre este resgate..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              {/* BOTÕES */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <Button
                  onClick={() => setSelectedClaim(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdateClaim}
                  disabled={updateClaim.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {updateClaim.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
