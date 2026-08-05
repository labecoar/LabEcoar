// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingSubmissions, useApproveSubmission, useRejectSubmission, useApprovalHistory } from "@/hooks/useSubmissions";
import {
  CheckCircle, XCircle, ExternalLink,
  Clock, Calendar, CircleDollarSign, FileText
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
  script_pending: 'Roteiro pendente',
  script_approved: 'Roteiro aprovado',
  script_rejected: 'Roteiro rejeitado',
};

const sameUrlHost = (a, b) => {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
};

const getScriptFiles = (submission) => {
  const desc = submission?.script_description || '';
  const fromDesc = [...desc.matchAll(/Arquivo (\d+): (https?:\/\/\S+)/g)]
    .map((m) => ({ index: Number(m[1]), url: m[2] }))
    .sort((a, b) => a.index - b.index);

  const scriptUrl = String(submission?.script_url || '').trim();
  const descUrls = new Set(fromDesc.map((f) => f.url));

  if (!scriptUrl && fromDesc.length === 0) return [];

  if (fromDesc.length === 0) {
    return [{ url: scriptUrl, label: 'Roteiro' }];
  }

  if (scriptUrl && descUrls.has(scriptUrl)) {
    return fromDesc.map((f) => ({ url: f.url, label: `Arquivo ${f.index}` }));
  }

  if (scriptUrl && !descUrls.has(scriptUrl)) {
    if (sameUrlHost(scriptUrl, fromDesc[0]?.url)) {
      return [
        { url: scriptUrl, label: 'Arquivo 1' },
        ...fromDesc.map((f, i) => ({ url: f.url, label: `Arquivo ${i + 2}` })),
      ];
    }
    return [
      { url: scriptUrl, label: 'Link' },
      ...fromDesc.map((f) => ({ url: f.url, label: `Arquivo ${f.index}` })),
    ];
  }

  return fromDesc.map((f) => ({ url: f.url, label: `Arquivo ${f.index}` }));
};

export default function AdminScriptApproval() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
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

  const campaignSubmissions = pendingSubmissions.filter(
    (s) => String(s.task?.category || '') === 'campanha'
  );

  const scriptPendingSubmissions = campaignSubmissions
    .filter((s) => normalizeSubmissionStatus(s.status) === 'script_pending')
    .sort((a, b) => new Date(a.script_submitted_at || a.created_at).getTime() - new Date(b.script_submitted_at || b.created_at).getTime());

  const approvedSubmissions = campaignSubmissions
    .filter((s) => normalizeSubmissionStatus(s.status) === 'script_approved')
    .sort((a, b) => new Date(b.validated_at || b.updated_at || b.created_at).getTime() - new Date(a.validated_at || a.updated_at || a.created_at).getTime());

  const rejectedSubmissions = campaignSubmissions
    .filter((s) => normalizeSubmissionStatus(s.status) === 'script_rejected')
    .sort((a, b) => new Date(b.validated_at || b.updated_at || b.created_at).getTime() - new Date(a.validated_at || a.updated_at || a.created_at).getTime());

  const latestScriptApprovalBySubmission = approvalHistory.reduce((acc, entry) => {
    if (entry?.action !== 'script_approved' || !entry?.submission_id) return acc;
    const previous = acc[entry.submission_id];
    if (!previous) { acc[entry.submission_id] = entry; return acc; }
    const previousTime = new Date(previous.approved_at || 0).getTime();
    const currentTime = new Date(entry.approved_at || 0).getTime();
    if (currentTime > previousTime) acc[entry.submission_id] = entry;
    return acc;
  }, {});

  if (profile?.role !== 'admin') {
    return <AdminAccessDenied message="Você não tem permissão para acessar esta página." icon={XCircle} />;
  }

  const handleApprove = async (submission) => {
    try {
      await approveSubmission.mutateAsync({ submissionId: submission.id, pointsAwarded: 0 });
      notifySuccess('Roteiro aprovado! O ecoante já pode enviar a prova.');
      setSelectedSubmission(null);
    } catch (error) {
      notifyError('Erro ao aprovar roteiro');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { notifyWarning('Por favor, informe o motivo da rejeição'); return; }
    try {
      await rejectSubmission.mutateAsync({ submissionId: selectedSubmission.id, rejectionReason });
      notifySuccess('Roteiro rejeitado');
      setSelectedSubmission(null);
      setRejectionReason('');
      setIsRejecting(false);
    } catch (error) {
      notifyError('Erro ao rejeitar roteiro');
    }
  };

  const SubmissionCard = ({ submission }) => {
    const status = normalizeSubmissionStatus(submission.status);

    return (
      <div
        onClick={() => setSelectedSubmission(submission)}
        className="p-5 rounded-2xl cursor-pointer transition-all hover:brightness-110"
        style={{ backgroundColor: C.card, border: `1px solid ${cardBorder}` }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor, lineHeight: 1.3 }} className="line-clamp-2">
              {submission.task?.title || 'Campanha'}
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
            style={{ backgroundColor: C.lime_back }}>
            <CircleDollarSign size={11} style={{ color: C.lime }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.lime }}>
              R$ {Number(submission.task?.offered_value || 0).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {status === 'script_pending' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${C.blue}18`, color: C.blue }}>
              <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />Roteiro Pendente
            </span>
          )}
          {status === 'script_approved' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${C.lime_back}`, color: C.lime }}>Roteiro Aprovado</span>
          )}
          {status === 'script_rejected' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#f87171' }}>Roteiro Rejeitado</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
          <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: faintColor }}>
            <Calendar size={11} />
            {format(new Date(submission.script_submitted_at || submission.updated_at || submission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          {status === 'script_approved' && latestScriptApprovalBySubmission[submission.id] ? (
            <span style={{ fontSize: 11, color: faintColor }}>
              Por {latestScriptApprovalBySubmission[submission.id].approver_name || 'Admin'}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: faintColor }}>Toque para abrir</span>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <AdminLoading label="Carregando roteiros..." />;
  }

  const tabs = [
    { key: 'pending', label: `Pendentes (${scriptPendingSubmissions.length})` },
    { key: 'approved', label: `Aprovados (${approvedSubmissions.length})` },
    { key: 'rejected', label: `Recusados (${rejectedSubmissions.length})` },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>
      <PageHeader>
        <PageHeaderLabel icon={FileText}>Aprovação de Roteiros</PageHeaderLabel>
      </PageHeader>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0 space-y-6 md:space-y-8">
        <div>
          <h1 style={{ ...pageTitleStyle, fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Aprovação de Roteiros
          </h1>
          <p style={pageSubtitleStyle}>
            Valide os roteiros enviados por ecoantes selecionados em campanhas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <AdminStatCard icon={Clock} label="Roteiros Aguardando Análise" value={scriptPendingSubmissions.length} color={C.orange} iconBg={`${C.orange}12`} />
          <AdminStatCard icon={CheckCircle} label="Roteiros Aprovados" value={approvedSubmissions.length} color={C.lime} iconBg={`${C.lime}12`} />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((t) => (
            <AdminTabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </AdminTabButton>
          ))}
        </div>

        {activeTab === 'pending' && (
          scriptPendingSubmissions.length === 0
            ? <AdminEmptyState icon={CheckCircle} title="Nenhum roteiro pendente" subtitle="Todos os roteiros enviados já foram analisados." />
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scriptPendingSubmissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
            </div>
        )}

        {activeTab === 'approved' && (
          approvedSubmissions.length === 0
            ? <AdminEmptyState icon={CheckCircle} title="Nenhum roteiro aprovado" subtitle="Os roteiros aprovados aparecerão aqui no histórico." />
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedSubmissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
            </div>
        )}

        {activeTab === 'rejected' && (
          rejectedSubmissions.length === 0
            ? <AdminEmptyState icon={XCircle} title="Nenhum roteiro recusado" subtitle="As recusas de roteiro aparecerão aqui no histórico." />
            : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rejectedSubmissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
            </div>
        )}
      </div>

      {selectedSubmission && (
        <Dialog open={!!selectedSubmission} onOpenChange={() => { setSelectedSubmission(null); setIsDescriptionExpanded(false); setIsRejecting(false); setRejectionReason(''); }}>
          <DialogContent aria-describedby={undefined} className="sm:max-w-2xl p-0 border-0 bg-transparent overflow-hidden shadow-none">
            <DialogTitle className="sr-only">Detalhes do Roteiro</DialogTitle>
            <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: modalBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: textColor }}>Detalhes do Roteiro</span>
                <button onClick={() => { setSelectedSubmission(null); setIsRejecting(false); setRejectionReason(''); }}
                  style={{ color: mutedColor }} className="hover:opacity-100 transition-opacity">
                  <XCircle size={18} />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <h3 style={{ ...heading, fontSize: 17, fontWeight: 700, color: textColor, marginBottom: 8 }}>
                    {selectedSubmission.task?.title || 'Campanha'}
                  </h3>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: surfaceBgAlt, color: subColor }}>
                    {STATUS_LABELS[selectedSubmission.status] || selectedSubmission.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Categoria', value: 'Campanha', color: accentColor },
                    {
                      label: 'Valor',
                      value: `R$ ${Number(selectedSubmission.task?.offered_value || 0).toLocaleString('pt-BR')}`,
                      color: C.lime,
                    },
                    {
                      label: 'Enviado em',
                      value: format(
                        new Date(selectedSubmission.script_submitted_at || selectedSubmission.created_at),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      ),
                      color: textColor,
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <p style={{ fontSize: 10, color: labelColor, marginBottom: 4 }}>{label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color }}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                  <p style={{ fontSize: 10, color: labelColor, marginBottom: 6 }}>Enviado por</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: textColor }}>{selectedSubmission.profile?.full_name || 'Usuário'}</p>
                  <p style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{selectedSubmission.profile?.email || 'sem email'}</p>
                </div>

                {(() => {
                  const cleanDesc = (selectedSubmission.script_description || '')
                    .replace(/Arquivo \d+: https?:\/\/\S+\n?/g, '')
                    .trim();
                  if (!cleanDesc) return null;
                  return (
                    <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <p style={{ fontSize: 10, color: labelColor, marginBottom: 6 }}>Observações</p>
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

                {(() => {
                  const files = getScriptFiles(selectedSubmission);
                  if (files.length === 0) return null;
                  return (
                    <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <p style={{ fontSize: 10, color: labelColor, marginBottom: 8 }}>
                        {files.length === 1 ? 'Roteiro' : 'Arquivos enviados'}
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

                {normalizeSubmissionStatus(selectedSubmission.status) === 'script_pending' && (
                  !isRejecting ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(selectedSubmission)}
                        disabled={approveSubmission.isPending}
                        className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                      >
                        <CheckCircle size={15} />
                        {approveSubmission.isPending ? 'Aprovando...' : 'Aprovar Roteiro'}
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
