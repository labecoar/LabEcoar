// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminPayments, useUpdatePaymentStatus } from '@/hooks/usePayments'
import { DollarSign, Clock, CheckCircle, AlertCircle, RefreshCw, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { notifyError, notifyInfo, notifySuccess } from '@/lib/toast'
import { C, heading, body } from '@/lib/theme'
import { PageHeader, PageHeaderLabel } from "@/components/layout/PageShell";
import {
  usePageTheme,
  AdminAccessDenied,
  AdminEmptyState,
  AdminTabButton,
} from '@/components/admin/AdminPageHelpers'

const STATUS_LABELS = {
  pendente: 'Pendente',
  processando: 'Processando',
  pago: 'Pago',
  erro: 'Erro',
}

const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

export default function AdminPayments() {
  const { profile } = useAuth()
  const {
    isLight,
    textColor,
    mutedColor,
    subColor,
    faintColor,
    cardBorder,
    borderColor,
    inputStyle,
    pageTitleStyle,
    pageSubtitleStyle,
  } = usePageTheme()
  const [activeTab, setActiveTab] = useState('pendente')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: payments = [], isLoading, error } = useAdminPayments(activeTab)
  const updatePaymentStatus = useUpdatePaymentStatus()

  const filteredPayments = useMemo(() => {
    const term = String(searchTerm || '').trim().toLowerCase()
    if (!term) return payments
    return payments.filter((payment) => {
      const userName = payment.profile?.display_name || payment.profile?.full_name || ''
      const email = payment.profile?.email || ''
      const taskTitle = payment.metrics_submission?.task_title || ''
      const quarter = payment.quarter || ''
      return `${userName} ${email} ${taskTitle} ${quarter}`.toLowerCase().includes(term)
    })
  }, [payments, searchTerm])

  if (profile?.role !== 'admin') {
    return <AdminAccessDenied icon={AlertCircle} />
  }

  const handleStatusUpdate = async (payment, nextStatus) => {
    const defaultNote = nextStatus === 'pago'
      ? 'Pagamento realizado manualmente fora da plataforma.'
      : nextStatus === 'processando'
        ? 'Pagamento em processamento pelo financeiro.'
        : nextStatus === 'erro'
          ? 'Erro no processamento do pagamento. Necessária revisão.'
          : 'Pagamento reaberto para pendência.'

    const normalizedStatus = String(nextStatus).toLowerCase()

    if (['pago', 'processando', 'erro'].includes(normalizedStatus)) {
      try {
        await updatePaymentStatus.mutateAsync({ paymentId: payment.id, status: nextStatus, notes: defaultNote })
        if (normalizedStatus === 'pago') notifySuccess('pagamento concluído')
        else if (normalizedStatus === 'processando') notifyInfo('pagamento em processamento', 'Processando')
        else notifyError('pagamento com erro')
      } catch (error) {
        console.error('Erro ao atualizar pagamento:', error)
        notifyError(error?.message || 'Não foi possível atualizar o status do pagamento.')
      }
      return
    }

    const note = window.prompt('Observação do status (opcional):', defaultNote)
    if (note === null) return

    try {
      await updatePaymentStatus.mutateAsync({ paymentId: payment.id, status: nextStatus, notes: note })
      notifySuccess(`Status atualizado para ${STATUS_LABELS[nextStatus] || nextStatus}.`)
    } catch (error) {
      console.error('Erro ao atualizar pagamento:', error)
      notifyError(error?.message || 'Não foi possível atualizar o status do pagamento.')
    }
  }

  const tabs = [
    { key: 'pendente', label: 'Pendentes' },
    { key: 'processando', label: 'Processando' },
    { key: 'pago', label: 'Pagos' },
    { key: 'erro', label: 'Erros' },
    { key: 'all', label: 'Todos' },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <PageHeader>
        <PageHeaderLabel icon={DollarSign}>Fila de Pagamentos</PageHeaderLabel>
      </PageHeader>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0 space-y-6 md:space-y-8">

        {/* Hero */}
        <div>
          <h1 style={{ ...pageTitleStyle, fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Fila de Pagamentos
          </h1>
          <p style={pageSubtitleStyle}>
            Acompanhe pagamentos pendentes, processando e pagos após aprovação de métricas.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard title="Pendentes" status="pendente" />
          <StatusCard title="Processando" status="processando" />
          <StatusCard title="Pagos" status="pago" />
          <StatusCard title="Erros" status="erro" />
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {tabs.map((t) => (
              <AdminTabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </AdminTabButton>
            ))}
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por ecoante, email, campanha..."
            className="w-full md:w-80 px-4 py-2.5 rounded-xl outline-none transition-all"
            style={inputStyle}
          />
        </div>

        {/* Conteúdo */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: C.lime }} />
              <p style={{ color: mutedColor }}>Carregando pagamentos...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <AlertCircle size={36} style={{ color: '#f87171' }} />
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: '#f87171' }}>Erro ao carregar pagamentos</p>
            <p style={{ fontSize: 14, color: faintColor }}>{error?.message || 'Falha ao consultar pagamentos no banco.'}</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <AdminEmptyState icon={DollarSign} title="Nenhum pagamento encontrado" subtitle="Quando houver registros, eles aparecerão aqui." />
        ) : (
          <div className="flex flex-col gap-4">
            {filteredPayments.map((payment) => {
              const ecoante = payment.profile?.display_name || payment.profile?.full_name || 'Ecoante'
              const campaignTitle = payment.metrics_submission?.task_title || 'Campanha'
              const isPending = payment.status === 'pendente'
              const isProcessing = payment.status === 'processando'
              const isPaid = payment.status === 'pago'
              const isError = payment.status === 'erro'

              const statusColor = isPaid ? C.lime : isProcessing ? C.blue : isError ? '#f87171' : C.orange
              const statusBg = isPaid ? C.lime_back : isProcessing ? `${C.blue}18` : isError ? 'rgba(248,113,113,0.12)' : C.orange_back

              return (
                <div key={payment.id} className="p-5 rounded-2xl"
                  style={{ backgroundColor: C.card, border: `1px solid ${isError ? 'rgba(248,113,113,0.2)' : cardBorder}` }}>

                  {/* Top */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <p style={{ ...heading, fontSize: 16, fontWeight: 700, color: textColor, lineHeight: 1.3 }} className="line-clamp-2">
                        {campaignTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{ backgroundColor: C.orange, color: isLight ? C.onSurface : C.cream }}>
                          {ecoante.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p style={{ fontSize: 12, color: subColor }} className="truncate font-medium">{ecoante}</p>
                          <p style={{ fontSize: 11, color: faintColor }} className="truncate">{payment.profile?.email || 'sem email'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end gap-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: statusBg, color: statusColor }}>
                        {STATUS_LABELS[payment.status] || payment.status}
                      </span>
                      <p style={{ ...heading, fontSize: 22, fontWeight: 900, color: C.lime, letterSpacing: '-0.02em' }}>
                        R$ {formatCurrency(payment.amount)}
                      </p>
                    </div>
                  </div>

                  {/* Info chips */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <InfoChip label="Trimestre" value={payment.quarter || '-'} />
                    <InfoChip label="Categoria" value={String(payment.category || '-').replace(/_/g, ' ')} />
                    {String(payment.category || '').toLowerCase() !== 'campanha' && (
                      <InfoChip label="Pontos" value={String(payment.points ?? '-')} />
                    )}
                    <InfoChip
                      label={payment.paid_at ? 'Pago em' : 'Criado em'}
                      value={format(new Date(payment.paid_at || payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      hasIcon
                    />
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap gap-2 pt-4" style={{ borderTop: `1px solid ${borderColor}` }}>
                    {(isPending || isError) && (
                      <button onClick={() => handleStatusUpdate(payment, 'processando')} disabled={updatePaymentStatus.isPending}
                        className="flex items-center gap-2 px-4 h-9 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ border: `1px solid ${C.blue}40`, backgroundColor: `${C.blue_back}`, color: C.blue, ...heading, fontWeight: 600, fontSize: 13 }}>
                        <Clock size={13} />Marcar Processando
                      </button>
                    )}

                    {(isPending || isProcessing || isError) && (
                      <button onClick={() => handleStatusUpdate(payment, 'pago')} disabled={updatePaymentStatus.isPending}
                        className="flex items-center gap-2 px-4 h-9 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 13 }}>
                        <CheckCircle size={13} />Marcar Pago
                      </button>
                    )}

                    {(isPending || isProcessing) && (
                      <button onClick={() => handleStatusUpdate(payment, 'erro')} disabled={updatePaymentStatus.isPending}
                        className="flex items-center gap-2 px-4 h-9 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ border: '1px solid rgba(248,113,113,0.3)', backgroundColor: 'transparent', color: '#f87171', ...heading, fontWeight: 600, fontSize: 13 }}>
                        <AlertCircle size={13} />Marcar Erro
                      </button>
                    )}

                    {(isProcessing || isPaid || isError) && (
                      <button onClick={() => handleStatusUpdate(payment, 'pendente')} disabled={updatePaymentStatus.isPending}
                        className="flex items-center gap-2 px-4 h-9 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ border: `1px solid ${C.orange}40`, backgroundColor: C.orange_back, color: C.orange, ...heading, fontWeight: 600, fontSize: 13 }}>
                        <RefreshCw size={13} />Voltar para Pendente
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusCard({ title, status }) {
  const { surfaceBg, cardBorder, mutedColor } = usePageTheme()
  const { data: items = [] } = useAdminPayments(status)

  const Icon = status === 'pago' ? CheckCircle : status === 'processando' ? Clock : status === 'erro' ? AlertCircle : DollarSign
  const color = status === 'pago' ? C.lime : status === 'processando' ? C.blue : status === 'erro' ? '#f87171' : C.orange
  const iconBg = status === 'pago' ? C.lime_back : status === 'processando' ? C.blue_back : status === 'erro' ? 'rgba(248,113,113,0.10)' : C.orange_back

  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl"
      style={{ backgroundColor: surfaceBg, border: `1px solid ${cardBorder}` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <div style={{ ...heading, fontSize: 28, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{items.length}</div>
        <div style={{ fontSize: 11, color: mutedColor, marginTop: 4 }}>{title}</div>
      </div>
    </div>
  )
}

function InfoChip({ label, value, hasIcon = false }) {
  const { surfaceBgAlt, cardBorder, labelColor, textColor, mutedColor } = usePageTheme()
  return (
    <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
      <p style={{ fontSize: 10, color: labelColor, marginBottom: 4 }}>{label}</p>
      <p className="flex items-center gap-1" style={{ fontSize: 13, fontWeight: 700, color: textColor }}>
        {hasIcon && <Calendar size={11} style={{ color: mutedColor }} />}
        {value}
      </p>
    </div>
  )
}
