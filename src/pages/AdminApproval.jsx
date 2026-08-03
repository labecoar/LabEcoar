// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingSubmissions, useApproveSubmission, useRejectSubmission, useApprovalHistory } from "@/hooks/useSubmissions";
import { useAddPoints } from "@/hooks/useScores";
import {
  CheckCircle, XCircle, ExternalLink, FileText,
  Clock, User, Calendar, Star, Shield, CircleDollarSign
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";
import { C, heading, body, getModalBackground, colorWithAlpha } from '@/lib/theme';
import { PageHeader, PageHeaderLabel } from "@/components/layout/PageShell";
import {
  usePageTheme,
  AdminAccessDenied,
  AdminLoading,
  AdminEmptyState,
  AdminTabButton,
  AdminStatCard,
} from '@/components/admin/AdminPageHelpers';

const normalizeSubmissionStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'pendente') return 'application_pending';
  if (normalized === 'aprovada' || normalized === 'aprovado') return 'approved';
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'rejected';
  return normalized;
};

const STATUS_LABELS = {
  pending: 'Inscrição pendente',
  application_pending: 'Inscrição pendente',
  proof_pending: 'Prova pendente',
  approved: 'Prova aprovada',
  rejected: 'Prova rejeitada',
}

const REVIEW_SLA_HOURS = 48;

const addHours = (baseDate, hoursToAdd) => {
  return new Date(new Date(baseDate).getTime() + hoursToAdd * 60 * 60 * 1000);
};

const sameUrlHost = (a, b) => {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
};

/** Une proof_url + arquivos parseados da description numa lista só (sem duplicar) */
const getSubmissionFiles = (submission) => {
  const desc = submission?.description || '';
  const fromDesc = [...desc.matchAll(/Arquivo (\d+): (https?:\/\/\S+)/g)]
    .map((m) => ({ index: Number(m[1]), url: m[2] }))
    .sort((a, b) => a.index - b.index);

  const proofUrl = String(submission?.proof_url || '').trim();
  const descUrls = new Set(fromDesc.map((f) => f.url));

  if (!proofUrl && fromDesc.length === 0) return [];

  if (fromDesc.length === 0) {
    return [{ url: proofUrl, label: 'Comprovante' }];
  }

  if (proofUrl && descUrls.has(proofUrl)) {
    return fromDesc.map((f) => ({ url: f.url, label: `Arquivo ${f.index}` }));
  }

  if (proofUrl && !descUrls.has(proofUrl)) {
    if (sameUrlHost(proofUrl, fromDesc[0]?.url)) {
      return [
        { url: proofUrl, label: 'Arquivo 1' },
        ...fromDesc.map((f, i) => ({ url: f.url, label: `Arquivo ${i + 2}` })),
      ];
    }
    return [
      { url: proofUrl, label: 'Link' },
      ...fromDesc.map((f) => ({ url: f.url, label: `Arquivo ${f.index}` })),
    ];
  }

  return fromDesc.map((f) => ({ url: f.url, label: `Arquivo ${f.index}` }));
};

export default function AdminApproval() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [, setNowTick] = useState(Date.now());
  const { profile } = useAuth();
  const {
    textColor, mutedColor, subColor, faintColor, cardBorder,
    surfaceBg, surfaceBgAlt, labelColor, inputStyle, pageTitleStyle, pageSubtitleStyle, isLight, T,
  } = usePageTheme();
  const modalBg = getModalBackground(isLight);
  const accentColor = T.accent;

  const { data: pendingSubmissions = [], isLoading } = usePendingSubmissions();
  const { data: approvalHistory = [] } = useApprovalHistory(200);
  const approveSubmission = useApproveSubmission();
  const rejectSubmission = useRejectSubmission();
  const addPoints = useAddPoints();

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getReviewDeadline = (submission) => {
    const referenceDate = submission.proof_submitted_at || submission.updated_at || submission.created_at;
    if (!referenceDate) return null;
    const base = new Date(referenceDate);
    if (Number.isNaN(base.getTime())) return null;
    return addHours(base, REVIEW_SLA_HOURS);
  };

  const formatRemainingReviewTime = (submission) => {
    const deadline = getReviewDeadline(submission);
    if (!deadline) return 'Sem prazo';
    const diffMs = deadline.getTime() - Date.now();
    if (diffMs <= 0) return 'Expirado';
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}min`;
  };

  const isReviewOverdue = (submission) => {
    const deadline = getReviewDeadline(submission);
    if (!deadline) return false;
    return deadline.getTime() <= Date.now();
  };

  const isReviewCritical = (submission) => {
    const deadline = getReviewDeadline(submission);
    if (!deadline) return false;
    const diffMs = deadline.getTime() - Date.now();
    return diffMs > 0 && diffMs <= 60 * 60 * 1000;
  };

  const proofPendingSubmissions = pendingSubmissions
    .filter((s) => normalizeSubmissionStatus(s.status) === 'proof_pending')
    .sort((a, b) => {
      const aD = getReviewDeadline(a); const bD = getReviewDeadline(b);
      if (!aD && !bD) return 0; if (!aD) return 1; if (!bD) return -1;
      return aD.getTime() - bD.getTime();
    });

  const approvedSubmissions = pendingSubmissions
    .filter((s) => normalizeSubmissionStatus(s.status) === 'approved')
    .sort((a, b) => new Date(b.validated_at || b.updated_at || b.created_at).getTime() - new Date(a.validated_at || a.updated_at || a.created_at).getTime());

  const rejectedSubmissions = pendingSubmissions
    .filter((s) => normalizeSubmissionStatus(s.status) === 'rejected')
    .sort((a, b) => new Date(b.validated_at || b.updated_at || b.created_at).getTime() - new Date(a.validated_at || a.updated_at || a.created_at).getTime());

  const latestProofApprovalBySubmission = approvalHistory.reduce((acc, entry) => {
    if (entry?.action !== 'proof_approved' || !entry?.submission_id) return acc;
    const previous = acc[entry.submission_id];
    if (!previous) { acc[entry.submission_id] = entry; return acc; }
    const previousTime = new Date(previous.approved_at || 0).getTime();
    const currentTime = new Date(entry.approved_at || 0).getTime();
    if (currentTime > previousTime) acc[entry.submission_id] = entry;
    return acc;
  }, {});

  const overdueProofSubmissions = proofPendingSubmissions.filter((s) => isReviewOverdue(s));
  const activeProofSubmissions = proofPendingSubmissions.filter((s) => !isReviewOverdue(s))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (profile?.role !== 'admin') {
    return <AdminAccessDenied message="Você não tem permissão para acessar esta página." icon={XCircle} />;
  }

  const handleApprove = async (submission) => {
    try {
      const isCampaign = submission.task?.category === 'campanha';
      const pointsToAward = isCampaign ? 0 : Number(submission.task?.points || 0);
      const approvedSubmission = await approveSubmission.mutateAsync({ submissionId: submission.id, pointsAwarded: pointsToAward });
      if (approvedSubmission?.status === 'approved' && pointsToAward > 0) {
        await addPoints.mutateAsync({ userId: submission.user_id, points: pointsToAward });
      }
      notifySuccess(approvedSubmission?.status === 'application_approved'
        ? 'Inscrição aprovada! Agora o usuário pode enviar a prova.'
        : 'Prova aprovada com sucesso! Pontos adicionados.');
      setSelectedSubmission(null);
    } catch (error) {
      notifyError('Erro ao aprovar submissão');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { notifyWarning('Por favor, informe o motivo da rejeição'); return; }
    try {
      await rejectSubmission.mutateAsync({ submissionId: selectedSubmission.id, rejectionReason });
      notifySuccess('Submissão rejeitada');
      setSelectedSubmission(null);
      setRejectionReason('');
      setIsRejecting(false);
    } catch (error) {
      notifyError('Erro ao rejeitar submissão');
    }
  };

  const aInputCls = "w-full px-4 py-2.5 rounded-xl outline-none transition-all";

  const SubmissionCard = ({ submission }) => {
    const status = normalizeSubmissionStatus(submission.status);
    const overdue = status === 'proof_pending' && isReviewOverdue(submission);
    const critical = status === 'proof_pending' && isReviewCritical(submission);
    const isCampaign = submission.task?.category === 'campanha';

    return (
      <div
        onClick={() => setSelectedSubmission(submission)}
        className="p-5 rounded-2xl cursor-pointer transition-all hover:brightness-110"
        style={{
          backgroundColor: C.card,
          border: `1px solid ${overdue ? 'rgba(248,113,113,0.3)' : critical ? `${C.orange}30` : cardBorder}`,
        }}
      >
        {/* Top */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor, lineHeight: 1.3 }} className="line-clamp-2">
              {submission.task?.title || 'Tarefa'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ backgroundColor: C.orange, color: isLight ? C.onSurface : C.cream }}>
                {(submission.profile?.full_name || submission.profile?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <p style={{ fontSize: 12, color: subColor }} className="truncate">
                {submission.profile?.full_name || submission.profile?.email || 'Usuário'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
            style={{ backgroundColor: isCampaign ? `${C.lime_back}` : `${C.orange_back}` }}>
            {isCampaign
              ? <><CircleDollarSign size={11} style={{ color: C.lime }} /><span style={{ fontSize: 11, fontWeight: 700, color: C.lime }}>R$ {Number(submission.task?.offered_value || 0).toLocaleString('pt-BR')}</span></>
              : <><Star size={11} style={{ color: C.orange }} /><span style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>{Number(submission.task?.points || 0).toLocaleString('pt-BR')} pts</span></>
            }
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {status === 'proof_pending' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${C.blue}18`, color: C.blue }}>
              <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />Prova Pendente
            </span>
          )}
          {status === 'approved' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${C.lime_back}`, color: C.lime }}>Prova Aprovada</span>
          )}
          {status === 'rejected' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#f87171' }}>Prova Rejeitada</span>
          )}
          {overdue && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse"
              style={{ backgroundColor: 'rgba(248,113,113,0.2)', color: '#f87171' }}>Expirado</span>
          )}
          {critical && !overdue && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${C.orange}20`, color: C.orange }}>
              Urgente: {formatRemainingReviewTime(submission)}
            </span>
          )}
          {status === 'proof_pending' && !overdue && !critical && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
              Revisar em {formatRemainingReviewTime(submission)}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
          <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: faintColor }}>
            <Calendar size={11} />
            {format(new Date(submission.proof_submitted_at || submission.updated_at || submission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          {status === 'approved' && latestProofApprovalBySubmission[submission.id] ? (
            <span style={{ fontSize: 11, color: faintColor }}>
              Por {latestProofApprovalBySubmission[submission.id].approver_name || 'Admin'}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: faintColor }}>Toque para abrir</span>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <AdminLoading label="Carregando submissões..." />;
  }

  const tabs = [
    { key: 'pending', label: `Pendentes (${proofPendingSubmissions.length})` },
    { key: 'approved', label: `Aprovados (${approvedSubmissions.length})` },
    { key: 'rejected', label: `Recusados (${rejectedSubmissions.length})` },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <PageHeader>
        <PageHeaderLabel icon={Shield}>Aprovação Final de Provas</PageHeaderLabel>
      </PageHeader>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0 space-y-6 md:space-y-8">

        {/* Hero */}
        <div>
          <h1 style={{ ...pageTitleStyle, fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Aprovação de Provas
          </h1>
          <p style={pageSubtitleStyle}>
            Valide as provas enviadas após aprovação de inscrição.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <AdminStatCard icon={Clock} label="Provas Aguardando Análise" value={proofPendingSubmissions.length} color={C.orange} iconBg={`${C.orange}12`} />
          <AdminStatCard
            icon={Clock}
            label="Com Prazo Expirado"
            value={overdueProofSubmissions.length}
            color={overdueProofSubmissions.length > 0 ? '#f87171' : mutedColor}
            iconBg={overdueProofSubmissions.length > 0 ? 'rgba(248,113,113,0.12)' : surfaceBgAlt}
          />
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
        {activeTab === 'pending' && (
          proofPendingSubmissions.length === 0
            ? <AdminEmptyState icon={CheckCircle} title="Nenhuma prova pendente" subtitle="Todas as provas enviadas já foram analisadas." />
            : <div className="space-y-6">
              {overdueProofSubmissions.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#f87171' }} />
                    <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: '#f87171' }}>Prioridade Máxima: Provas Atrasadas</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                      {overdueProofSubmissions.length} atrasada(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {overdueProofSubmissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
                  </div>
                </div>
              )}
              {activeProofSubmissions.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
                    <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: textColor }}>Demais Provas Pendentes</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeProofSubmissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
                  </div>
                </div>
              )}
            </div>
        )}

        {activeTab === 'approved' && (
          approvedSubmissions.length === 0
            ? <AdminEmptyState icon={CheckCircle} title="Nenhuma prova aprovada" subtitle="As provas aprovadas aparecerão aqui no histórico." />
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedSubmissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
            </div>
        )}

        {activeTab === 'rejected' && (
          rejectedSubmissions.length === 0
            ? <AdminEmptyState icon={XCircle} title="Nenhuma prova recusada" subtitle="As recusas de prova aparecerão aqui no histórico." />
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rejectedSubmissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
            </div>
        )}
      </div>

      {/* Modal detalhes */}
      {selectedSubmission && (
        <Dialog open={!!selectedSubmission} onOpenChange={() => { setSelectedSubmission(null); setIsDescriptionExpanded(false); setIsRejecting(false); setRejectionReason(''); }}>
          <DialogContent aria-describedby={undefined} className="sm:max-w-2xl p-0 border-0 bg-transparent overflow-hidden shadow-none">
            <DialogTitle className="sr-only">Detalhes da Prova</DialogTitle>
            <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: modalBg, border: `1px solid ${cardBorder}` }}>

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: textColor }}>Detalhes da Prova</span>
                <button onClick={() => { setSelectedSubmission(null); setIsRejecting(false); setRejectionReason(''); }}
                  style={{ color: mutedColor }} className="hover:opacity-100 transition-opacity">
                  <XCircle size={18} />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">

                {/* Título + status */}
                <div>
                  <h3 style={{ ...heading, fontSize: 17, fontWeight: 700, color: textColor, marginBottom: 8 }}>
                    {selectedSubmission.task?.title || 'Tarefa'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: surfaceBgAlt, color: subColor }}>
                      {STATUS_LABELS[selectedSubmission.status] || selectedSubmission.status}
                    </span>
                    {selectedSubmission.task?.category === 'campanha' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: `${C.blue}18`, color: C.blue }}>
                        Após prova, aguarda etapa de métricas
                      </span>
                    )}
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Categoria', value: (() => {
                        const cat = selectedSubmission.task?.category || '';
                        if (cat === 'sidequest_teste' || cat === 'sidequest') return 'Missão';
                        if (cat === 'campanha') return 'Campanha';
                        return cat || '-';
                      })(), color: accentColor
                    },
                    {
                      label: 'Valor / Pontuação',
                      value: selectedSubmission.task?.category === 'campanha'
                        ? `R$ ${Number(selectedSubmission.task?.offered_value || 0).toLocaleString('pt-BR')}`
                        : `${Number(selectedSubmission.task?.points || 0).toLocaleString('pt-BR')} pontos`,
                      color: C.orange,
                    },
                    {
                      label: 'Enviado em',
                      value: format(
                        new Date(selectedSubmission.proof_submitted_at || selectedSubmission.created_at),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      ),
                      color: textColor,
                    },
                    { label: 'Prazo de revisão', value: formatRemainingReviewTime(selectedSubmission), color: textColor },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <p style={{ fontSize: 10, color: labelColor, marginBottom: 4 }}>{label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Enviado por */}
                <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                  <p style={{ fontSize: 10, color: labelColor, marginBottom: 6 }}>Enviado por</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: textColor }}>{selectedSubmission.profile?.full_name || 'Usuário'}</p>
                  <p style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{selectedSubmission.profile?.email || 'sem email'}</p>
                </div>

                {/* Descrição */}
                {(() => {
                  const cleanDesc = (selectedSubmission.description || '')
                    .replace(/Arquivo \d+: https?:\/\/\S+\n?/g, '')
                    .trim();
                  if (!cleanDesc) return null;
                  return (
                    <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <p style={{ fontSize: 10, color: labelColor, marginBottom: 6 }}>Descrição</p>
                      <div
                        className={isDescriptionExpanded ? '' : 'line-clamp-2'}
                        style={{ fontSize: 13, color: subColor, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                      >
                        {cleanDesc}
                      </div>
                      {cleanDesc.length > 100 && (
                        <button type="button" onClick={() => setIsDescriptionExpanded((v) => !v)}
                          style={{ fontSize: 12, color: accentColor, fontWeight: 600, marginTop: 6 }}>
                          {isDescriptionExpanded ? 'Ver menos' : 'Ver mais'}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Arquivos enviados (proof_url + uploads na description, sem duplicar) */}
                {(() => {
                  const files = getSubmissionFiles(selectedSubmission);
                  if (files.length === 0) return null;
                  return (
                    <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <p style={{ fontSize: 10, color: labelColor, marginBottom: 8 }}>
                        {files.length === 1 ? 'Comprovante' : 'Arquivos enviados'}
                      </p>
                      <div className="flex flex-col gap-2">
                        {files.map(({ url, label }) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:brightness-110"
                            style={{ backgroundColor: surfaceBg, border: `1px solid ${cardBorder}` }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: colorWithAlpha(accentColor, 0.1), color: accentColor }}>
                              <ExternalLink size={16} />
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{label}</p>
                              <p style={{ fontSize: 11, color: mutedColor }}>Clique para visualizar</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Ações */}
                {normalizeSubmissionStatus(selectedSubmission.status) === 'proof_pending' && (
                  !isRejecting ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(selectedSubmission)}
                        disabled={approveSubmission.isPending}
                        className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                      >
                        <CheckCircle size={15} />
                        {approveSubmission.isPending ? 'Aprovando...' : 'Aprovar'}
                      </button>
                      <button
                        onClick={() => setIsRejecting(true)}
                        className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110"
                        style={{ border: '1px solid rgba(248,113,113,0.3)', backgroundColor: 'transparent', color: '#f87171', ...heading, fontWeight: 700, fontSize: 14 }}
                      >
                        <XCircle size={15} /> Rejeitar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.05em' }}>MOTIVO DA REJEIÇÃO</label>
                      <textarea
                        className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                        style={{ ...inputStyle }}
                        rows={4}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explique o motivo da rejeição para o usuário..."
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleReject}
                          disabled={rejectSubmission.isPending}
                          className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                          style={{ backgroundColor: '#f87171', color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                        >
                          {rejectSubmission.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
                        </button>
                        <button
                          onClick={() => { setIsRejecting(false); setRejectionReason(''); }}
                          className="flex-1 h-12 rounded-xl flex items-center justify-center transition-all hover:brightness-110"
                          style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}`, color: subColor, ...heading, fontWeight: 700, fontSize: 14 }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}