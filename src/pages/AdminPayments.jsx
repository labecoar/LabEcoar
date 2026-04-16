// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminPayments, useUpdatePaymentStatus } from '@/hooks/usePayments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, Clock, CheckCircle, AlertCircle, RefreshCw, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_LABELS = {
  pendente: 'Pendente',
  processando: 'Processando',
  pago: 'Pago',
  erro: 'Erro',
}

const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

const getStatusBadgeClass = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'pago') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (normalized === 'processando') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (normalized === 'erro') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-yellow-100 text-yellow-700 border-yellow-200'
}

export default function AdminPayments() {
  const { profile } = useAuth()
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

      const searchBase = `${userName} ${email} ${taskTitle} ${quarter}`.toLowerCase()
      return searchBase.includes(term)
    })
  }, [payments, searchTerm])

  if (profile?.role !== 'admin') {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    )
  }

  const handleStatusUpdate = async (payment, nextStatus) => {
    const defaultNote = nextStatus === 'pago'
      ? 'Pagamento realizado manualmente fora da plataforma.'
      : nextStatus === 'processando'
        ? 'Pagamento em processamento pelo financeiro.'
        : nextStatus === 'erro'
          ? 'Erro no processamento do pagamento. Necessária revisão.'
          : 'Pagamento reaberto para pendência.'

    const note = window.prompt('Observação do status (opcional):', defaultNote)
    if (note === null) return

    try {
      await updatePaymentStatus.mutateAsync({
        paymentId: payment.id,
        status: nextStatus,
        notes: note,
      })

      alert(`Status atualizado para ${STATUS_LABELS[nextStatus] || nextStatus}.`)
    } catch (error) {
      console.error('Erro ao atualizar pagamento:', error)
      alert(error?.message || 'Não foi possível atualizar o status do pagamento.')
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700 mb-2 inline-flex items-center gap-2">
            Fila de Pagamentos
            <DollarSign className="w-7 h-7" />
          </h1>
          <p className="text-gray-600">Acompanhe pagamentos pendentes, processando e pagos após aprovação de métricas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatusCard title="Pendentes" status="pendente" />
          <StatusCard title="Processando" status="processando" />
          <StatusCard title="Pagos" status="pago" />
          <StatusCard title="Erros" status="erro" />
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full md:w-auto">
                <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                <TabsTrigger value="processando">Processando</TabsTrigger>
                <TabsTrigger value="pago">Pagos</TabsTrigger>
                <TabsTrigger value="erro">Erros</TabsTrigger>
                <TabsTrigger value="all">Todos</TabsTrigger>
              </TabsList>
            </Tabs>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por ecoante, email, campanha ou trimestre"
              className="w-full md:w-[360px] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando pagamentos...</p>
            </div>
          ) : error ? (
            <Card className="text-center py-12 border-red-200 bg-red-50">
              <CardContent>
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h3 className="text-lg font-semibold text-red-700 mb-2">Erro ao carregar pagamentos</h3>
                <p className="text-red-600">{error?.message || 'Falha ao consultar pagamentos no banco.'}</p>
              </CardContent>
            </Card>
          ) : filteredPayments.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum pagamento encontrado</h3>
                <p className="text-gray-500">Quando houver registros, eles aparecerão aqui.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((payment) => {
                const ecoante = payment.profile?.display_name || payment.profile?.full_name || 'Ecoante'
                const campaignTitle = payment.metrics_submission?.task_title || 'Campanha'
                const isPending = payment.status === 'pendente'
                const isProcessing = payment.status === 'processando'
                const isPaid = payment.status === 'pago'
                const isError = payment.status === 'erro'

                return (
                  <Card key={payment.id} className="shadow-sm border border-emerald-100">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg leading-tight">{campaignTitle}</CardTitle>
                          <p className="text-sm text-gray-600 mt-1 inline-flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {ecoante}
                            <span className="text-gray-400">•</span>
                            {payment.profile?.email || 'sem email'}
                          </p>
                        </div>

                        <div className="text-right">
                          <Badge className={getStatusBadgeClass(payment.status)}>
                            {STATUS_LABELS[payment.status] || payment.status}
                          </Badge>
                          <p className="text-2xl font-bold text-emerald-700 mt-2">R$ {formatCurrency(payment.amount)}</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                        <InfoChip label="Trimestre" value={payment.quarter || '-'} />
                        <InfoChip label="Categoria" value={String(payment.category || '-').replace(/_/g, ' ')} />
                        <InfoChip label="Pontos" value={String(payment.points ?? '-')} />
                        <InfoChip
                          label={payment.paid_at ? 'Pago em' : 'Criado em'}
                          value={format(new Date(payment.paid_at || payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        />
                      </div>

                      {payment.notes && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                          <span className="font-medium">Observação: </span>
                          {payment.notes}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        {(isPending || isError) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(payment, 'processando')}
                            disabled={updatePaymentStatus.isPending}
                          >
                            <Clock className="w-4 h-4 mr-1" />
                            Marcar Processando
                          </Button>
                        )}

                        {(isPending || isProcessing || isError) && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleStatusUpdate(payment, 'pago')}
                            disabled={updatePaymentStatus.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Marcar Pago
                          </Button>
                        )}

                        {(isPending || isProcessing) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => handleStatusUpdate(payment, 'erro')}
                            disabled={updatePaymentStatus.isPending}
                          >
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Marcar Erro
                          </Button>
                        )}

                        {(isProcessing || isPaid || isError) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(payment, 'pendente')}
                            disabled={updatePaymentStatus.isPending}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Voltar para Pendente
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusCard({ title, status }) {
  const { data: items = [] } = useAdminPayments(status)

  const Icon = status === 'pago'
    ? CheckCircle
    : status === 'processando'
      ? Clock
      : status === 'erro'
        ? AlertCircle
        : DollarSign

  const colorClass = status === 'pago'
    ? 'text-emerald-700 bg-emerald-100'
    : status === 'processando'
      ? 'text-blue-700 bg-blue-100'
      : status === 'erro'
        ? 'text-red-700 bg-red-100'
        : 'text-yellow-700 bg-yellow-100'

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${colorClass}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            <p className="text-sm text-gray-600">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoChip({ label, value }) {
  return (
    <div className="rounded-md px-3 py-2 border border-gray-200 bg-gray-50">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-800 inline-flex items-center gap-1 mt-0.5">
        {label.toLowerCase().includes('em') && <Calendar className="w-3.5 h-3.5" />}
        <span>{value}</span>
      </p>
    </div>
  )
}
