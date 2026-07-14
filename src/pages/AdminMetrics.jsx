// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMetricsByStatus, useApproveMetricsSubmission, useRejectMetricsSubmission, useRevertMetricsSubmission } from "@/hooks/useMetrics";
import {
  CheckCircle, XCircle, Download, ExternalLink,
  Clock, User, Calendar, BarChart2, RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";
import { C, heading, body } from '@/lib/theme';
import { METRICS_ADMIN_REVIEW_BUFFER_DAYS, METRICS_SUBMISSION_WINDOW_DAYS } from '@/lib/metrics-window';

const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
}

const LATE_POSTING_PLAN_B_TEXT = 'Você perdeu o prazo original de postagem e está passível de perda da vaga. Ainda assim, a equipe pode avaliar o conteúdo em caráter excepcional. Aguarde contato caso seja aberto novo prazo para aproveitamento desse conteúdo.';

export default function AdminMetrics() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { profile } = useAuth();

  const { data: pendingMetricsRaw = [], isLoading: loadingPending } = useAdminMetricsByStatus('pending');
  const pendingMetrics = pendingMetricsRaw.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const { data: approvedMetrics = [], isLoading: loadingApproved } = useAdminMetricsByStatus('approved');
  const { data: rejectedMetrics = [], isLoading: loadingRejected } = useAdminMetricsByStatus('rejected');

  const approveMetricsMutation = useApproveMetricsSubmission();
  const rejectMetricsMutation = useRejectMetricsSubmission();
  const revertMetricsMutation = useRevertMetricsSubmission();

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
        <div className="max-w-md p-8 rounded-2xl text-center" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.08)` }}>
          <XCircle size={36} style={{ color: '#f87171', margin: '0 auto 16px' }} />
          <h2 style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream }}>Acesso Negado</h2>
          <p style={{ color: `${C.cream}60`, fontSize: 14 }}>Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  const isLoading = loadingPending || loadingApproved || loadingRejected;

  const handleApprove = async (submission) => {
    try {
      await approveMetricsMutation.mutateAsync(submission.id);
      notifySuccess('Métricas aprovadas com sucesso. O pagamento foi sinalizado para processamento.');
    } catch (error) {
      console.error('Erro ao aprovar métricas:', error);
      notifyError('Erro ao aprovar métricas.');
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    const reason = rejectionReason.trim();
    if (!reason) { notifyWarning('Informe o motivo da rejeição.'); return; }
    try {
      await rejectMetricsMutation.mutateAsync({ metricsSubmissionId: selectedSubmission.id, rejectionReason: reason });
      setSelectedSubmission(null);
      setRejectionReason('');
      notifySuccess('Métricas rejeitadas. O ecoante pode reenviar em até 2 dias após a rejeição.');
    } catch (error) {
      console.error('Erro ao rejeitar métricas:', error);
      notifyError('Erro ao rejeitar métricas.');
    }
  };

  const handleRevert = async (submission) => {
    try {
      await revertMetricsMutation.mutateAsync(submission.id);
      notifySuccess('Métrica revertida para pendente com sucesso.');
    } catch (error) {
      console.error('Erro ao reverter métrica:', error);
      notifyError('Erro ao reverter métrica.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: C.lime }} />
          <p style={{ color: `${C.cream}50` }}>Carregando métricas...</p>
        </div>
      </div>
    );
  }

  const MetricsCard = ({ submission, showActions = false }) => {
    const postingDeadline = submission?.task?.posting_deadline ? new Date(submission.task.posting_deadline) : null;
    const postedAt = submission?.posted_at ? new Date(submission.posted_at) : null;
    const hasPostingDeadline = postingDeadline && !Number.isNaN(postingDeadline.getTime());
    const hasPostedAt = postedAt && !Number.isNaN(postedAt.getTime());
    const isLatePosting = hasPostingDeadline && hasPostedAt ? postedAt > postingDeadline : false;
    const isMultiAttempt = Number(submission.attempt_number || 1) > 1;

    return (
      <div
        className="p-5 rounded-2xl transition-all hover:brightness-110"
        style={{
          backgroundColor: C.card,
          border: `1px solid ${submission.status === 'rejected' ? 'rgba(248,113,113,0.2)' : isLatePosting ? `${C.orange}25` : 'rgba(255,255,222,0.07)'}`,
        }}
      >
        {/* Top */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream, lineHeight: 1.3 }} className="line-clamp-2">
              {submission.task_title || submission.task?.title || 'Campanha'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ backgroundColor: C.orange, color: C.cream }}>
                {(submission.user_name || submission.profile?.full_name || submission.profile?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p style={{ fontSize: 12, color: `${C.cream}70` }} className="truncate font-medium">
                  {submission.user_name || submission.profile?.display_name || submission.profile?.full_name || 'Ecoante'}
                </p>
                <p style={{ fontSize: 11, color: `${C.cream}40` }} className="truncate">
                  {submission.user_email || submission.profile?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="shrink-0">
            {submission.status === 'pending' && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${C.orange_back}`, color: C.orange }}>
                <Clock size={10} />Pendente
              </span>
            )}
            {submission.status === 'approved' && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: C.lime_back, color: C.lime }}>
                <CheckCircle size={10} />Aprovada
              </span>
            )}
            {submission.status === 'rejected' && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                <XCircle size={10} />Rejeitada
              </span>
            )}
          </div>
        </div>

        {/* Badges secundários */}
        <div className="flex flex-wrap gap-2 mb-3">
          {isMultiAttempt && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${C.orange}15`, color: C.orange }}>
              Tentativa {submission.attempt_number}
            </span>
          )}
          {isLatePosting && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
              Fora do prazo
            </span>
          )}
          {submission.quarter && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'rgba(255,255,222,0.06)', color: `${C.cream}60` }}>
              {submission.quarter}
            </span>
          )}
        </div>

        {/* Observação */}
        {submission.description && (
          <div className="px-3 py-2.5 rounded-xl mb-3" style={{ backgroundColor: 'rgba(255,255,222,0.04)', border: `1px solid rgba(255,255,222,0.07)` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: `${C.cream}50`, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Observações</p>
            <p style={{ fontSize: 13, color: `${C.cream}70`, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="line-clamp-3">
              {submission.description}
            </p>
          </div>
        )}

        {/* Links */}
        <div className="flex flex-col gap-2 mb-3">
          {submission.metrics_link && (
            <a href={submission.metrics_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:brightness-110"
              style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: `1px solid rgba(255,255,222,0.08)` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${C.lime}14`, color: C.lime }}>
                <ExternalLink size={15} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.cream }}>Ver publicação</p>
                <p style={{ fontSize: 11, color: `${C.cream}50` }}>Abrir post enviado pelo ecoante</p>
              </div>
            </a>
          )}

          {(submission.metrics_file_urls?.length > 0
            ? submission.metrics_file_urls
            : submission.metrics_file_url ? [submission.metrics_file_url] : []
          ).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:brightness-110"
              style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: `1px solid rgba(255,255,222,0.08)` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${C.blue}18`, color: C.blue }}>
                <Download size={15} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.cream }}>Arquivo de métricas</p>
                <p style={{ fontSize: 11, color: `${C.cream}50` }}>Clique para visualizar / download</p>
              </div>
            </a>
          ))}
        </div>

        {/* Motivo de rejeição */}
        {submission.rejection_reason && (
          <div className="px-3 py-2.5 rounded-xl mb-3" style={{ backgroundColor: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#f87171', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Motivo da rejeição</p>
            <p style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>{submission.rejection_reason}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid rgba(255,255,222,0.06)` }}>
          <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: `${C.cream}40` }}>
            <Calendar size={11} />
            {format(new Date(submission.submitted_at || submission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        {/* Ações */}
        {showActions && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleApprove(submission)}
              disabled={approveMetricsMutation.isPending}
              className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
            >
              <CheckCircle size={15} />
              {approveMetricsMutation.isPending ? 'Aprovando...' : 'Aprovar'}
            </button>
            <button
              onClick={() => {
                setSelectedSubmission(submission);
                setRejectionReason(isLatePosting ? LATE_POSTING_PLAN_B_TEXT : '');
              }}
              className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110"
              style={{ border: '1px solid rgba(248,113,113,0.3)', backgroundColor: 'transparent', color: '#f87171', ...heading, fontWeight: 700, fontSize: 14 }}
            >
              <XCircle size={15} />Rejeitar
            </button>
          </div>
        )}

        {!showActions && submission.status === 'approved' && (
          <button
            onClick={() => handleRevert(submission)}
            disabled={revertMetricsMutation.isPending}
            className="w-full h-11 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50 mt-4"
            style={{ border: `1px solid ${C.orange}40`, backgroundColor: C.orange_back, color: C.orange, ...heading, fontWeight: 700, fontSize: 13 }}
          >
            <RotateCcw size={14} />
            {revertMetricsMutation.isPending ? 'Revertendo...' : 'Voltar para Pendentes'}
          </button>
        )}
      </div>
    );
  };

  const EmptyState = ({ icon: Icon, title, subtitle }) => (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Icon size={36} style={{ color: `${C.cream}20` }} />
      <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>{title}</p>
      {subtitle && <p style={{ fontSize: 14, color: `${C.cream}30` }}>{subtitle}</p>}
    </div>
  );

  const tabs = [
    { key: 'pending', label: `Pendentes (${pendingMetrics.length})` },
    { key: 'approved', label: `Aprovadas (${approvedMetrics.length})` },
    { key: 'rejected', label: `Rejeitadas (${rejectedMetrics.length})` },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <div className="flex items-center justify-between px-8 py-4 sticky top-0 z-10"
        style={{ backgroundColor: `${C.black}F5`, backdropFilter: 'blur(16px)', borderBottom: `1px solid rgba(255,255,222,0.05)` }}>
        <div className="flex items-center gap-3">
          <BarChart2 size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Aprovação de Métricas
          </span>
        </div>
      </div>

      <div className="px-4 md:px-8 pt-7 pb-10 max-w-6xl mx-auto space-y-8">

        {/* Hero */}
        <div>
          <h1 style={{ ...heading, fontSize: 40, fontWeight: 900, color: C.cream, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Aprovação de Métricas
          </h1>
          <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>
            Valide as métricas de campanhas enviadas pelos Ecoantes. Ecoantes têm {METRICS_SUBMISSION_WINDOW_DAYS} dias para enviar; campanhas permanecem visíveis por mais {METRICS_ADMIN_REVIEW_BUFFER_DAYS} dias para revisão.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          {[
            { icon: Clock, label: 'Pendentes', value: pendingMetrics.length, color: C.orange, iconBg: C.orange_back },
            { icon: CheckCircle, label: 'Aprovadas', value: approvedMetrics.length, color: C.lime, iconBg: C.lime_back },
            { icon: XCircle, label: 'Rejeitadas', value: rejectedMetrics.length, color: '#f87171', iconBg: 'rgba(248,113,113,0.10)' },
          ].map(({ icon: Icon, label, value, color, iconBg }) => (
            <div key={label} className="flex items-center gap-4 p-5 rounded-2xl"
              style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: `1px solid rgba(255,255,222,0.06)` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <div style={{ ...heading, fontSize: 28, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ fontSize: 11, color: `${C.cream}50`, marginTop: 4 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
              className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
              style={{ backgroundColor: activeTab === t.key ? C.lime : 'rgba(255,255,222,0.06)', color: activeTab === t.key ? C.black : `${C.cream}70`, fontWeight: activeTab === t.key ? 700 : 400, ...heading, fontSize: 13 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        {activeTab === 'pending' && (
          pendingMetrics.length === 0
            ? <EmptyState icon={BarChart2} title="Nenhuma métrica pendente" subtitle="As métricas pendentes de aprovação aparecerão aqui." />
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingMetrics.map((s) => <MetricsCard key={s.id} submission={s} showActions={true} />)}
            </div>
        )}

        {activeTab === 'approved' && (
          approvedMetrics.length === 0
            ? <EmptyState icon={CheckCircle} title="Nenhuma métrica aprovada" subtitle="As métricas aprovadas aparecerão aqui no histórico." />
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedMetrics.map((s) => <MetricsCard key={s.id} submission={s} showActions={false} />)}
            </div>
        )}

        {activeTab === 'rejected' && (
          rejectedMetrics.length === 0
            ? <EmptyState icon={XCircle} title="Nenhuma métrica rejeitada" subtitle="As métricas rejeitadas aparecerão aqui no histórico." />
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rejectedMetrics.map((s) => <MetricsCard key={s.id} submission={s} showActions={false} />)}
            </div>
        )}
      </div>

      {/* Modal de rejeição */}
      {selectedSubmission && (
        <Dialog open={!!selectedSubmission} onOpenChange={() => { setSelectedSubmission(null); setRejectionReason(''); }}>
          <DialogContent aria-describedby={undefined} className="sm:max-w-lg p-0 border-0 bg-transparent overflow-hidden shadow-none">
            <DialogTitle className="sr-only">Rejeitar Métricas</DialogTitle>
            <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.1)` }}>

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(255,255,222,0.07)` }}>
                <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>Rejeitar Métricas</span>
                <button onClick={() => { setSelectedSubmission(null); setRejectionReason(''); }}
                  style={{ color: `${C.cream}50` }} className="hover:opacity-100 transition-opacity">
                  <XCircle size={18} />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">

                {/* Info da submissão */}
                <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,222,0.04)', border: `1px solid rgba(255,255,222,0.07)` }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.cream }}>
                    {selectedSubmission.task_title || selectedSubmission.task?.title}
                  </p>
                  <p style={{ fontSize: 12, color: `${C.cream}50`, marginTop: 4 }}>
                    {selectedSubmission.user_name || selectedSubmission.profile?.display_name || selectedSubmission.profile?.full_name}
                  </p>
                </div>

                <p style={{ fontSize: 13, color: `${C.cream}60` }}>
                  Explique o motivo da rejeição de forma clara e construtiva para o Ecoante:
                </p>
                <p style={{ fontSize: 11, color: `${C.cream}40` }}>
                  Após a rejeição, o ecoante tem até 2 dias para reenviar as métricas.
                </p>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRejectionReason(LATE_POSTING_PLAN_B_TEXT)}
                    className="px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                    style={{ fontSize: 11, color: C.orange, border: `1px solid ${C.orange}30`, backgroundColor: `${C.orange}08`, fontWeight: 600 }}
                  >
                    Usar modelo Plano B (atraso)
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.05em' }}>MOTIVO DA REJEIÇÃO *</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                    style={{ backgroundColor: 'rgba(255,255,222,0.04)', border: `1px solid rgba(255,255,222,0.12)`, color: C.cream, fontSize: 13, ...body }}
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: Os insights enviados não mostram os dados completos. Por favor, envie um print com alcance, impressões e interações..."
                  />
                  <p style={{ fontSize: 11, color: `${C.cream}40` }}>Seja específico sobre o que está faltando.</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setSelectedSubmission(null); setRejectionReason(''); }}
                    className="flex-1 h-12 rounded-xl flex items-center justify-center transition-all hover:brightness-110"
                    style={{ backgroundColor: 'rgba(255,255,222,0.04)', border: `1px solid rgba(255,255,222,0.07)`, color: `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectionReason.trim() || rejectMetricsMutation.isPending}
                    className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ backgroundColor: '#f87171', color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                  >
                    {rejectMetricsMutation.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}