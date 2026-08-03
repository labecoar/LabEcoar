// @ts-nocheck
import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminRewardClaims, useUpdateRewardClaim } from '@/hooks/useRewards'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Gift, Clock, CheckCircle, AlertCircle, XCircle, Calendar, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { notifyError, notifySuccess } from '@/lib/toast'
import { C, heading, body, getModalBackground } from '@/lib/theme'
import { PageHeader, PageHeaderLabel } from "@/components/layout/PageShell";
import {
  usePageTheme,
  AdminAccessDenied,
  AdminLoading,
  AdminEmptyState,
  AdminTabButton,
  AdminStatCard,
} from '@/components/admin/AdminPageHelpers'

const STATUS_LABELS = {
  pendente: 'Pendente',
  processando: 'Processando',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const statusColor = (status) => {
  if (status === 'entregue') return C.lime
  if (status === 'processando') return C.blue
  if (status === 'cancelado') return '#f87171'
  return C.orange
}

const statusBg = (status) => {
  if (status === 'entregue') return C.lime_back
  if (status === 'processando') return C.blue_back
  if (status === 'cancelado') return 'rgba(248,113,113,0.12)'
  return C.orange_back
}

const StatusIcon = ({ status, size = 13 }) => {
  const props = { size, style: { color: statusColor(status) } }
  if (status === 'entregue') return <CheckCircle {...props} />
  if (status === 'processando') return <AlertCircle {...props} />
  if (status === 'cancelado') return <XCircle {...props} />
  return <Clock {...props} />
}

function ClaimCard({ claim, onOpen }) {
  const {
    isLight,
    textColor,
    mutedColor,
    subColor,
    faintColor,
    labelColor,
    cardBorder,
    borderColor,
    surfaceBgAlt,
  } = usePageTheme()

  return (
    <div
      onClick={() => onOpen(claim)}
      className="p-5 rounded-2xl cursor-pointer transition-all hover:brightness-110"
      style={{ backgroundColor: C.card, border: `1px solid ${cardBorder}` }}
    >
      {/* Top */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor, lineHeight: 1.3 }} className="line-clamp-2">
            {claim.reward_title || 'Recompensa'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ backgroundColor: C.orange, color: isLight ? C.onSurface : C.cream }}>
              {(claim.user_name || 'E').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 12, color: subColor }} className="truncate font-medium">{claim.user_name || 'Ecoante'}</p>
              <p style={{ fontSize: 11, color: faintColor }} className="truncate">{claim.user_email}</p>
            </div>
          </div>
        </div>

        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
          style={{ backgroundColor: statusBg(claim.status), color: statusColor(claim.status) }}>
          <StatusIcon status={claim.status} size={10} />
          {STATUS_LABELS[claim.status] || claim.status}
        </span>
      </div>

      {/* Pontos */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
        style={{ backgroundColor: C.orange_back, border: `1px solid ${C.orange}20` }}>
        <Gift size={13} style={{ color: C.orange }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.orange }}>
          {Number(claim.points_spent || 0).toLocaleString('pt-BR')} pontos
        </span>
      </div>

      {/* Notas */}
      {claim.notes && (
        <div className="px-3 py-2.5 rounded-xl mb-3"
          style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: labelColor, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Observações</p>
          <p style={{ fontSize: 13, color: subColor, lineHeight: 1.5 }} className="line-clamp-2">{claim.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-1.5 pt-3" style={{ borderTop: `1px solid ${borderColor}` }}>
        <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: faintColor }}>
          <Calendar size={11} />
          Resgatado em {format(new Date(claim.claimed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
        {claim.delivered_at && (
          <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: C.lime }}>
            <CheckCircle size={11} />
            Entregue em {format(new Date(claim.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        )}
      </div>
    </div>
  )
}

export default function AdminRewardClaims() {
  const { profile } = useAuth()
  const {
    isLight,
    textColor,
    mutedColor,
    subColor,
    faintColor,
    cardBorder,
    borderColor,
    surfaceBgAlt,
    inputStyle,
    pageTitleStyle,
    pageSubtitleStyle,
  } = usePageTheme()
  const modalBg = getModalBackground(isLight)
  const [activeTab, setActiveTab] = useState('pendente')
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [newStatus, setNewStatus] = useState(null)
  const [notes, setNotes] = useState('')

  const { data: allClaims = [], isLoading } = useAdminRewardClaims()
  const updateClaim = useUpdateRewardClaim()

  if (profile?.role !== 'admin') {
    return <AdminAccessDenied icon={XCircle} message="Você não tem permissão para acessar esta página." />
  }

  const pendenteClaims = allClaims.filter((c) => c.status === 'pendente')
  const processandoClaims = allClaims.filter((c) => c.status === 'processando')
  const entreguesClaims = allClaims.filter((c) => c.status === 'entregue')
  const canceladosClaims = allClaims.filter((c) => c.status === 'cancelado')

  const tabData = {
    pendente: { label: 'Pendentes', items: pendenteClaims },
    processando: { label: 'Processando', items: processandoClaims },
    entregue: { label: 'Entregues', items: entreguesClaims },
    cancelado: { label: 'Cancelados', items: canceladosClaims },
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

  if (isLoading) {
    return <AdminLoading label="Carregando resgates..." />
  }

  const tabs = Object.entries(tabData).map(([key, data]) => ({
    key,
    label: `${data.label} (${data.items.length})`,
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <PageHeader>
        <PageHeaderLabel icon={Gift}>Resgates de Recompensas</PageHeaderLabel>
      </PageHeader>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0 space-y-6 md:space-y-8">

        {/* Hero */}
        <div>
          <h1 style={{ ...pageTitleStyle, fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Resgates de Recompensas
          </h1>
          <p style={pageSubtitleStyle}>
            Gerencie os resgates de recompensas dos ecoantes.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AdminStatCard icon={Clock} label="Pendentes" value={pendenteClaims.length} color={statusColor('pendente')} iconBg={statusBg('pendente')} />
          <AdminStatCard icon={AlertCircle} label="Processando" value={processandoClaims.length} color={statusColor('processando')} iconBg={statusBg('processando')} />
          <AdminStatCard icon={CheckCircle} label="Entregues" value={entreguesClaims.length} color={statusColor('entregue')} iconBg={statusBg('entregue')} />
          <AdminStatCard icon={XCircle} label="Cancelados" value={canceladosClaims.length} color={statusColor('cancelado')} iconBg={statusBg('cancelado')} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((t) => (
            <AdminTabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </AdminTabButton>
          ))}
        </div>

        {/* Conteúdo */}
        {visibleItems.length === 0 ? (
          <AdminEmptyState
            icon={Gift}
            title={`Nenhum resgate ${tabData[activeTab].label.toLowerCase()}`}
            subtitle={`Resgates com status "${STATUS_LABELS[activeTab]}" aparecerão aqui.`}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((claim) => <ClaimCard key={claim.id} claim={claim} onOpen={handleOpenClaim} />)}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedClaim && (
        <Dialog open={!!selectedClaim} onOpenChange={(open) => !open && setSelectedClaim(null)}>
          <DialogContent aria-describedby={undefined} className="sm:max-w-2xl p-0 border-0 bg-transparent overflow-hidden shadow-none">
            <DialogTitle className="sr-only">Detalhes do Resgate</DialogTitle>
            <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: modalBg, border: `1px solid ${cardBorder}` }}>

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-2">
                  <Gift size={15} style={{ color: C.lime }} />
                  <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: textColor }}>{selectedClaim.reward_title}</span>
                </div>
                <button onClick={() => setSelectedClaim(null)} style={{ color: mutedColor }}>
                  <XCircle size={18} />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">

                {/* Ecoante */}
                <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                  <p style={{ fontSize: 10, color: mutedColor, marginBottom: 6 }}>Ecoante</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: textColor }}>{selectedClaim.user_name}</p>
                  <p style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{selectedClaim.user_email}</p>
                </div>

                {/* Pontos */}
                <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: C.orange_back, border: `1px solid ${C.orange}20` }}>
                  <p style={{ fontSize: 10, color: C.orange, marginBottom: 4 }}>Pontos Gastos</p>
                  <p style={{ ...heading, fontSize: 24, fontWeight: 900, color: C.orange, letterSpacing: '-0.02em' }}>
                    {Number(selectedClaim.points_spent || 0).toLocaleString('pt-BR')}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: subColor, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Status</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setNewStatus(key)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                        style={{
                          backgroundColor: newStatus === key ? statusBg(key) : surfaceBgAlt,
                          color: newStatus === key ? statusColor(key) : mutedColor,
                          border: `1px solid ${newStatus === key ? statusColor(key) + '40' : cardBorder}`,
                          fontWeight: newStatus === key ? 700 : 400,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Endereço */}
                {(selectedClaim.cep || selectedClaim.endereco) && (
                  <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin size={13} style={{ color: C.lime }} />
                      <p style={{ fontSize: 11, fontWeight: 700, color: subColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Endereço de Entrega</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { label: 'CEP', value: selectedClaim.cep },
                        { label: 'Rua', value: selectedClaim.endereco },
                        { label: 'Número', value: selectedClaim.numero },
                        { label: 'Complemento', value: selectedClaim.complemento },
                        { label: 'Bairro', value: selectedClaim.bairro },
                        { label: 'Cidade', value: selectedClaim.cidade && `${selectedClaim.cidade}${selectedClaim.estado ? ` - ${selectedClaim.estado}` : ''}` },
                      ].filter(({ value }) => value).map(({ label, value }) => (
                        <div key={label} className="flex gap-2">
                          <span style={{ fontSize: 12, color: faintColor, minWidth: 80 }}>{label}:</span>
                          <span style={{ fontSize: 12, color: subColor }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observações */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: subColor, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Observações
                  </label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                    style={inputStyle}
                    rows={4}
                    placeholder="Adicione observações sobre este resgate..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedClaim(null)}
                    className="flex-1 h-12 rounded-xl flex items-center justify-center transition-all hover:brightness-110"
                    style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}`, color: subColor, ...heading, fontWeight: 700, fontSize: 14 }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateClaim}
                    disabled={updateClaim.isPending}
                    className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                  >
                    {updateClaim.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
