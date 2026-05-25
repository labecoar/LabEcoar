// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMetricsByStatus, useApproveMetricsSubmission, useRejectMetricsSubmission } from "@/hooks/useMetrics";
import { useRegisterManualPayment } from "@/hooks/usePayments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle, XCircle, Download, ExternalLink,
  Clock, User, Calendar, BarChart2, Instagram
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";

const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
}

const LATE_POSTING_PLAN_B_TEXT = 'Você perdeu o prazo original de postagem e está passível de perda da vaga. Ainda assim, a equipe pode avaliar o conteúdo em caráter excepcional. Aguarde contato caso seja aberto novo prazo para aproveitamento desse conteúdo.';

export default function AdminMetrics() {
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedPaymentSubmission, setSelectedPaymentSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [paymentNotes, setPaymentNotes] = useState('');
  const { profile } = useAuth();

  const { data: pendingMetricsRaw = [], isLoading: loadingPending } = useAdminMetricsByStatus('pending');
  const pendingMetrics = pendingMetricsRaw.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const { data: approvedMetrics = [], isLoading: loadingApproved } = useAdminMetricsByStatus('approved');
  const { data: rejectedMetrics = [], isLoading: loadingRejected } = useAdminMetricsByStatus('rejected');

  const approveMetricsMutation = useApproveMetricsSubmission();
  const rejectMetricsMutation = useRejectMetricsSubmission();
  const registerManualPaymentMutation = useRegisterManualPayment();

  if (profile?.role !== 'admin') {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  const isLoading = loadingPending || loadingApproved || loadingRejected

  const handleApprove = async (submission) => {
    try {
      await approveMetricsMutation.mutateAsync(submission.id)
      notifySuccess('Métricas aprovadas com sucesso. O pagamento foi sinalizado para processamento.')
    } catch (error) {
      console.error('Erro ao aprovar métricas:', error)
      notifyError('Erro ao aprovar métricas.')
    }
  }

  const handleReject = async () => {
    if (!selectedSubmission) return

    const reason = rejectionReason.trim()
    if (!reason) {
      notifyWarning('Informe o motivo da rejeição.')
      return
    }

    try {
      await rejectMetricsMutation.mutateAsync({
        metricsSubmissionId: selectedSubmission.id,
        rejectionReason: reason,
      })
      setSelectedSubmission(null)
      setRejectionReason('')
      notifySuccess('Métricas rejeitadas. O ecoante pode reenviar em até 2 dias após a rejeição.')
    } catch (error) {
      console.error('Erro ao rejeitar métricas:', error)
      notifyError('Erro ao rejeitar métricas.')
    }
  }

  const handleRegisterManualPayment = async () => {
    if (!selectedPaymentSubmission) return

    try {
      await registerManualPaymentMutation.mutateAsync({
        metricsSubmissionId: selectedPaymentSubmission.id,
        userId: selectedPaymentSubmission.user_id,
        quarter: selectedPaymentSubmission.quarter,
        notes: paymentNotes,
      })

      setSelectedPaymentSubmission(null)
      setPaymentNotes('')
      notifySuccess('Pagamento marcado como pago com sucesso.')
    } catch (error) {
      console.error('Erro ao registrar pagamento manual:', error)
      notifyError(error?.message || 'Erro ao registrar pagamento manual.')
    }
  }

  const renderMetricsCard = (submission, showActions = false) => {
    const postingDeadline = submission?.task?.posting_deadline
      ? new Date(submission.task.posting_deadline)
      : null

    const postedAt = submission?.posted_at
      ? new Date(submission.posted_at)
      : null

    const hasPostingDeadline =
      postingDeadline && !Number.isNaN(postingDeadline.getTime())

    const hasPostedAt =
      postedAt && !Number.isNaN(postedAt.getTime())

    const isLatePosting =
      hasPostingDeadline && hasPostedAt
        ? postedAt > postingDeadline
        : false

    return (
      <Card
        key={submission.id}
        className={`
        group overflow-hidden border bg-white shadow-sm transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-md
        ${submission.status === 'pending'
            ? 'border-yellow-100 hover:border-yellow-300'
            : submission.status === 'approved'
              ? 'border-emerald-100 hover:border-emerald-300'
              : 'border-red-100 hover:border-red-300'
          }
      `}
      >
        <CardContent className="p-4 space-y-4">

          {/* HEADER */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-[17px] leading-snug text-[#3c0b14] line-clamp-2">
                {submission.task_title || submission.task?.title || 'Campanha'}
              </CardTitle>

              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <User className="w-4 h-4" />
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-gray-900 line-clamp-1">
                    {submission.user_name ||
                      submission.profile?.display_name ||
                      submission.profile?.full_name ||
                      'Ecoante'}
                  </p>

                  <p className="text-xs text-gray-500 line-clamp-1">
                    {submission.user_email || submission.profile?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <Badge
                className={
                  submission.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                    : submission.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-red-100 text-red-700 border-red-200'
                }
              >
                {submission.status === 'pending' && (
                  <Clock className="w-3 h-3 mr-1" />
                )}

                {submission.status === 'approved' && (
                  <CheckCircle className="w-3 h-3 mr-1" />
                )}

                {submission.status === 'rejected' && (
                  <XCircle className="w-3 h-3 mr-1" />
                )}

                {STATUS_LABELS[submission.status] || submission.status}
              </Badge>
            </div>
          </div>

          {/* BADGES */}
          <div className="flex flex-wrap items-center gap-2">
            {Number(submission.attempt_number || 1) > 1 && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                Tentativa {submission.attempt_number}
              </Badge>
            )}

            {isLatePosting && (
              <Badge className="bg-red-100 text-red-700 border-red-200">
                Fora do prazo
              </Badge>
            )}

            {submission.quarter && (
              <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                {submission.quarter}
              </Badge>
            )}
          </div>

          {/* OBSERVAÇÃO */}
          {submission.description && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Observações
              </p>

              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words line-clamp-3">
                {submission.description}
              </p>
            </div>
          )}

          {/* LINKS */}
          <div className="space-y-2">

            {submission.metrics_link && (
              <a
                href={submission.metrics_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700">
                  <ExternalLink className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Ver publicação
                  </p>

                  <p className="text-xs text-gray-500">
                    Abrir post enviado pelo ecoante
                  </p>
                </div>
              </a>
            )}

            {(submission.metrics_file_urls?.length > 0
              ? submission.metrics_file_urls
              : submission.metrics_file_url
                ? [submission.metrics_file_url]
                : []
            ).map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-700">
                  <Download className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Arquivo de métricas
                  </p>

                  <p className="text-xs text-gray-500">
                    Clique para visualizar/download
                  </p>
                </div>
              </a>
            ))}
          </div>

          {/* REJEIÇÃO */}
          {submission.rejection_reason && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1">
                Motivo da rejeição
              </p>

              <p className="text-sm text-red-700">
                {submission.rejection_reason}
              </p>
            </div>
          )}

          {/* FOOTER */}
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3.5 h-3.5 shrink-0" />

              <span className="truncate">
                {format(
                  new Date(submission.submitted_at || submission.created_at),
                  "dd/MM/yyyy 'às' HH:mm:ss",
                  { locale: ptBR }
                )}
              </span>
            </span>

            {hasPostedAt && (
              <span className="text-right">
                Postado em{' '}
                {format(postedAt, "dd/MM HH:mm:ss", {
                  locale: ptBR
                })}
              </span>
            )}
          </div>

          {/* ACTIONS */}
          {showActions && (
            <div className="flex flex-col gap-3 pt-1 md:flex-row">
              <Button
                onClick={() => handleApprove(submission)}
                disabled={approveMetricsMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar
              </Button>

              <Button
                onClick={() => {
                  setSelectedSubmission(submission)
                  setRejectionReason(
                    isLatePosting
                      ? LATE_POSTING_PLAN_B_TEXT
                      : ''
                  )
                }}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-400"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </Button>
            </div>
          )}

          {!showActions && submission.status === 'approved' && (
            <Button
              onClick={() => {
                setSelectedPaymentSubmission(submission)
                setPaymentNotes('')
              }}
              className="w-full bg-emerald-700 hover:bg-emerald-800"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Marcar como pago
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando métricas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700 mb-2 inline-flex items-center gap-2">
            Aprovação de Métricas
            <BarChart2 className="w-7 h-7" />
          </h1>
          <p className="text-gray-600">Valide as métricas de campanhas enviadas pelos Ecoantes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="w-6 h-6 text-yellow-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{pendingMetrics.length}</p>
                  <p className="text-sm text-gray-600">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{approvedMetrics.length}</p>
                  <p className="text-sm text-gray-600">Aprovadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="w-6 h-6 text-red-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{rejectedMetrics.length}</p>
                  <p className="text-sm text-gray-600">Rejeitadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 h-auto">
            <TabsTrigger value="pending" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-[#3c0b14] data-[state=active]:shadow-sm">
              Pendentes ({pendingMetrics.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-[#3c0b14] data-[state=active]:shadow-sm">
              Aprovadas ({approvedMetrics.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 data-[state=active]:bg-white data-[state=active]:text-[#3c0b14] data-[state=active]:shadow-sm">
              Rejeitadas ({rejectedMetrics.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingMetrics.length === 0 ? (
              <div className="text-center py-12">
                <BarChart2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma métrica pendente de aprovação</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {pendingMetrics.map((submission) => renderMetricsCard(submission, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedMetrics.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma métrica aprovada</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {approvedMetrics.map((submission) => renderMetricsCard(submission, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedMetrics.length === 0 ? (
              <div className="text-center py-12">
                <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma métrica rejeitada</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {rejectedMetrics.map((submission) => renderMetricsCard(submission, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {selectedSubmission && (
          <Dialog open={!!selectedSubmission} onOpenChange={() => { setSelectedSubmission(null); setRejectionReason(''); }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Rejeitar Métricas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-gray-700"><strong>Campanha:</strong> {selectedSubmission.task_title || selectedSubmission.task?.title}</p>
                  <p className="text-sm text-gray-700 mt-1"><strong>Ecoante:</strong> {selectedSubmission.user_name || selectedSubmission.profile?.display_name || selectedSubmission.profile?.full_name}</p>
                </div>

                <p className="text-sm text-gray-600">
                  Explique o motivo da rejeição de forma clara e construtiva para o Ecoante:
                </p>
                <p className="text-xs text-gray-500">
                  Regra do fluxo: após rejeição, o ecoante tem até 2 dias para reenviar as métricas.
                </p>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs"
                    onClick={() => setRejectionReason(LATE_POSTING_PLAN_B_TEXT)}
                  >
                    Usar modelo Plano B (atraso)
                  </Button>
                </div>

                <div>
                  <Label htmlFor="reason" className="text-base font-semibold">
                    Motivo da Rejeição *
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder="Ex: Os insights enviados não mostram os dados completos. Por favor, envie um print com alcance, impressões e interações..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="h-32 mt-2"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Seja específico sobre o que está faltando.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setSelectedSubmission(null); setRejectionReason(''); }} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectionReason.trim() || rejectMetricsMutation.isPending}
                    className="flex-1"
                  >
                    {rejectMetricsMutation.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {selectedPaymentSubmission && (
          <Dialog
            open={!!selectedPaymentSubmission}
            onOpenChange={() => {
              setSelectedPaymentSubmission(null)
              setPaymentNotes('')
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Confirmar Pagamento Manual</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm text-gray-700"><strong>Campanha:</strong> {selectedPaymentSubmission.task_title || selectedPaymentSubmission.task?.title}</p>
                  <p className="text-sm text-gray-700 mt-1"><strong>Ecoante:</strong> {selectedPaymentSubmission.user_name || selectedPaymentSubmission.profile?.display_name || selectedPaymentSubmission.profile?.full_name}</p>
                </div>

                <p className="text-xs text-gray-600">
                  O pagamento é feito fora da plataforma. Este registro apenas atualiza o status para pago.
                </p>

                <div>
                  <Label htmlFor="payment-notes">Observações (opcional)</Label>
                  <Textarea
                    id="payment-notes"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Ex: Transferência realizada via TED às 14h32."
                    className="mt-2"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedPaymentSubmission(null)
                      setPaymentNotes('')
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRegisterManualPayment}
                    disabled={registerManualPaymentMutation.isPending}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800"
                  >
                    {(registerManualPaymentMutation.isPending)
                      ? 'Salvando...'
                      : 'Marcar como pago'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
