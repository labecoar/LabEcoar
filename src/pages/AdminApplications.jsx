// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingSubmissions, useApproveSubmission, useRejectSubmission, useResetSubmissionReview } from "@/hooks/useSubmissions";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Clock, CheckCircle, XCircle, User, Calendar, Users, Star, Eye, RotateCcw, CircleDollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";
import { C, heading, body } from '@/lib/theme';

const CONTACT_HELP_TEXT = 'Se precisar, fale com a equipe no Fórum (categoria Dúvidas) para esclarecimentos.';

const normalizeSubmissionStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'pendente') return 'application_pending'
  if (normalized === 'aprovada' || normalized === 'aprovado') return 'application_approved'
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'application_rejected'
  return normalized
}

export default function AdminApplications() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedTaskPreview, setSelectedTaskPreview] = useState(null);
  const [isPreviewDescriptionExpanded, setIsPreviewDescriptionExpanded] = useState(false);
  const [isPreviewJustificationExpanded, setIsPreviewJustificationExpanded] = useState(false);
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingSubmissions = [], isLoading } = usePendingSubmissions();
  const approveSubmission = useApproveSubmission();
  const rejectSubmission = useRejectSubmission();
  const resetSubmissionReview = useResetSubmissionReview();

  const isSidequestSubmission = (submission) => String(submission?.task?.category || '') === 'sidequest_teste';

  const pendingApplications = useMemo(
    () => pendingSubmissions.filter((s) => !isSidequestSubmission(s) && ['application_pending', 'pending'].includes(normalizeSubmissionStatus(s.status)))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [pendingSubmissions]
  );

  const selectedApplications = useMemo(
    () => pendingSubmissions.filter((s) => {
      if (isSidequestSubmission(s)) return false
      const status = normalizeSubmissionStatus(s.status)
      return ['application_approved', 'proof_pending', 'approved'].includes(status)
    }),
    [pendingSubmissions]
  );

  const rejectedApplications = useMemo(
    () => pendingSubmissions.filter((s) => {
      if (isSidequestSubmission(s)) return false
      const status = normalizeSubmissionStatus(s.status)
      return ['application_rejected', 'rejected'].includes(status)
    }),
    [pendingSubmissions]
  );

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
        <div className="max-w-md p-8 rounded-2xl text-center" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.08)` }}>
          <XCircle size={36} style={{ color: '#f87171', margin: '0 auto 16px' }} />
          <h2 style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream }} className="mb-2">Acesso Negado</h2>
          <p style={{ color: `${C.cream}60`, fontSize: 14 }}>Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  const handleApprove = async (submission) => {
    try {
      const isCampaign = submission.task?.category === 'campanha'
      const pointsAwarded = isCampaign ? 0 : Number(submission.task?.points || 0)
      const maxParticipants = Number(submission.task?.max_participants || 0)
      const currentParticipants = Number(submission.task?.current_participants || 0)
      if (maxParticipants > 0 && currentParticipants >= maxParticipants) {
        notifyError(`❌ Limite de participantes atingido! Máximo: ${maxParticipants}, Atual: ${currentParticipants}`)
        return
      }

      const approvedSubmission = await approveSubmission.mutateAsync({ submissionId: submission.id, pointsAwarded });

      queryClient.setQueryData(['submissions', 'pending'], (current = []) =>
        current.map((item) => item.id === submission.id
          ? { ...item, status: approvedSubmission?.status || 'application_approved', validated_at: approvedSubmission?.validated_at || item.validated_at, rejection_reason: null, points_awarded: approvedSubmission?.points_awarded ?? item.points_awarded }
          : item
        )
      );

      await queryClient.invalidateQueries({ queryKey: ['submissions'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.refetchQueries({ queryKey: ['submissions', 'pending'] });

      if (approvedSubmission?.status === 'application_approved') setActiveTab('selected');

      const proofDeadline = submission.task?.delivery_deadline ? new Date(submission.task.delivery_deadline) : null
      const proofDeadlineLabel = proofDeadline && !Number.isNaN(proofDeadline.getTime()) ? proofDeadline.toLocaleDateString('pt-BR') : null
      notifySuccess(proofDeadlineLabel ? `Inscrição aprovada! O usuário já pode enviar a prova até ${proofDeadlineLabel}.` : 'Inscrição aprovada!');
    } catch (error) {
      notifyError('Erro ao aprovar inscrição.');
    }
  };

  const handleReject = async (submission) => {
    const reason = window.prompt('Motivo da rejeição da inscrição:');
    if (!reason || !reason.trim()) { notifyWarning('Informe um motivo de rejeição para continuar.'); return; }

    try {
      await rejectSubmission.mutateAsync({ submissionId: submission.id, rejectionReason: `${reason.trim()}\n\n${CONTACT_HELP_TEXT}` });

      queryClient.setQueryData(['submissions', 'pending'], (current = []) =>
        current.map((item) => item.id === submission.id
          ? { ...item, status: 'application_rejected', rejection_reason: `${reason.trim()}\n\n${CONTACT_HELP_TEXT}`, validated_at: item.validated_at || new Date().toISOString() }
          : item
        )
      );

      await queryClient.invalidateQueries({ queryKey: ['submissions'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.refetchQueries({ queryKey: ['submissions', 'pending'] });
      notifySuccess('Inscrição rejeitada.');
    } catch (error) {
      notifyError('Erro ao rejeitar inscrição.');
    }
  };

  const handleResetReview = async (submission) => {
    try {
      await resetSubmissionReview.mutateAsync({ submissionId: submission.id });

      queryClient.setQueryData(['submissions', 'pending'], (current = []) =>
        current.map((item) => item.id === submission.id
          ? { ...item, status: 'application_pending', rejection_reason: null, validated_at: null }
          : item
        )
      );

      await queryClient.invalidateQueries({ queryKey: ['submissions'] });
      await queryClient.refetchQueries({ queryKey: ['submissions', 'pending'] });
      notifySuccess('Inscrição voltou para análise pendente.');
    } catch (error) {
      notifyError('Erro ao reabrir análise.');
    }
  };

  const tabs = [
    { key: 'pending', label: `Pendentes (${pendingApplications.length})` },
    { key: 'selected', label: `Selecionados (${selectedApplications.length})` },
    { key: 'rejected', label: `Não Selecionados (${rejectedApplications.length})` },
  ];

  const tabData = { pending: pendingApplications, selected: selectedApplications, rejected: rejectedApplications };
  const visibleItems = tabData[activeTab];

  const openTaskPreview = (submission) => {
    setSelectedTaskPreview(submission || null)
    setIsPreviewDescriptionExpanded(false)
    setIsPreviewJustificationExpanded(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: C.lime }} />
          <p style={{ color: `${C.cream}50` }}>Carregando candidatos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <div className="flex items-center justify-between px-8 py-4 sticky top-0 z-10"
        style={{ backgroundColor: `${C.black}F5`, backdropFilter: 'blur(16px)', borderBottom: `1px solid rgba(255,255,222,0.05)` }}>
        <div className="flex items-center gap-3">
          <Users size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Seleção de Candidatos
          </span>
        </div>
      </div>

      <div className="px-4 md:px-8 pt-7 pb-10 max-w-6xl mx-auto space-y-8">

        {/* Hero */}
        <div>
          <h1 style={{ ...heading, fontSize: 40, fontWeight: 900, color: C.cream, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Candidatos
          </h1>
          <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>
            Aprove ou rejeite inscrições nas tarefas antes do envio de provas.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Eye, label: 'Pendentes', value: pendingApplications.length, color: C.orange, iconBg: `${C.orange_back}` },
            { icon: CheckCircle, label: 'Selecionados', value: selectedApplications.length, color: C.lime, iconBg: `${C.lime_back}` },
            { icon: XCircle, label: 'Não Selecionados', value: rejectedApplications.length, color: `${C.cream}50`, iconBg: `rgba(255,255,222,0.06)` },
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
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
              style={{
                backgroundColor: activeTab === t.key ? C.lime : 'rgba(255,255,222,0.06)',
                color: activeTab === t.key ? C.black : `${C.cream}70`,
                fontWeight: activeTab === t.key ? 700 : 400,
                ...heading, fontSize: 13,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <CheckCircle size={36} style={{ color: `${C.cream}20` }} />
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>Nenhum candidato nesta aba.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleItems.map((submission) => {
              const isCampaign = submission.task?.category === 'campanha'
              return (
                <div
                  key={submission.id}
                  onClick={() => openTaskPreview(submission)}
                  className="p-5 rounded-2xl cursor-pointer transition-all hover:brightness-110"
                  style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.07)` }}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                        style={{ backgroundColor: C.orange, color: C.cream }}>
                        {(submission.profile?.display_name || submission.profile?.full_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream, lineHeight: 1.2 }}>
                          {submission.profile?.display_name || submission.profile?.full_name || 'Usuário'}
                        </p>
                        <p style={{ fontSize: 12, color: `${C.cream}50`, marginTop: 3 }}>
                          {submission.task?.title || 'Tarefa'}
                        </p>
                      </div>
                    </div>
                    {/* Badge valor */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: isCampaign ? `${C.lime}18` : `${C.orange}18` }}>
                      {isCampaign
                        ? <><CircleDollarSign size={12} style={{ color: C.lime }} /><span style={{ fontSize: 12, fontWeight: 700, color: C.lime }}>R$ {Number(submission.task?.offered_value || 0).toLocaleString('pt-BR')}</span></>
                        : <><Star size={12} style={{ color: C.orange }} /><span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>{Number(submission.task?.points || 0).toLocaleString('pt-BR')} pts</span></>
                      }
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="mb-3">
                    {activeTab === 'pending' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: `${C.orange}18`, color: C.orange }}>Aguardando Análise</span>
                    )}
                    {activeTab === 'selected' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: `${C.lime}18`, color: C.lime }}>Selecionado</span>
                    )}
                    {activeTab === 'rejected' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: 'rgba(255,255,222,0.06)', color: `${C.cream}50` }}>Não Selecionado</span>
                    )}
                  </div>

                  {/* Instagram + Seguidores */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(225,48,108,0.08)', border: '1px solid rgba(225,48,108,0.15)' }}>
                      <p style={{ fontSize: 10, color: 'white', marginBottom: 2 }}>Instagram</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#E1306C' }}>{submission.profile?.instagram_handle || '@semperfil'}</p>
                    </div>
                    <div className="px-3 py-2 rounded-xl" style={{ backgroundColor: `${C.blue_back}`, border: `1px solid ${C.blue_back}` }}>
                      <p style={{ fontSize: 10, color: 'white', marginBottom: 2 }}>Seguidores</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>{Number(submission.profile?.followers_count || 0).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid rgba(255,255,222,0.06)` }}>
                    <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: `${C.cream}40` }}>
                      <Calendar size={11} />
                      {format(new Date(submission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: `${C.cream}40` }}>
                      <User size={11} />
                      {submission.profile?.email || 'sem email'}
                    </span>
                  </div>

                  {/* Botões */}
                  {activeTab === 'pending' && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(submission); }}
                        disabled={approveSubmission.isPending}
                        className="h-10 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ backgroundColor: C.lime, color: C.black, ...heading, fontWeight: 700, fontSize: 13 }}
                      >
                        <CheckCircle size={14} /> Selecionar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(submission); }}
                        disabled={rejectSubmission.isPending}
                        className="h-10 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ border: '1px solid rgba(248,113,113,0.3)', backgroundColor: 'transparent', color: '#f87171', ...heading, fontWeight: 700, fontSize: 13 }}
                      >
                        <XCircle size={14} /> Não Selecionar
                      </button>
                    </div>
                  )}

                  {activeTab === 'selected' && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResetReview(submission); }}
                        disabled={resetSubmissionReview.isPending}
                        className="h-10 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ border: `1px solid rgba(255,255,222,0.12)`, backgroundColor: 'transparent', color: `${C.cream}70`, ...heading, fontWeight: 700, fontSize: 13 }}
                      >
                        <RotateCcw size={14} /> Voltar p/ Análise
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(submission); }}
                        disabled={rejectSubmission.isPending}
                        className="h-10 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ border: '1px solid rgba(248,113,113,0.3)', backgroundColor: 'transparent', color: '#f87171', ...heading, fontWeight: 700, fontSize: 13 }}
                      >
                        <XCircle size={14} /> Não Selecionar
                      </button>
                    </div>
                  )}

                  {activeTab === 'rejected' && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResetReview(submission); }}
                        disabled={resetSubmissionReview.isPending}
                        className="h-10 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ border: `1px solid rgba(255,255,222,0.12)`, backgroundColor: 'transparent', color: `${C.cream}70`, ...heading, fontWeight: 700, fontSize: 13 }}
                      >
                        <RotateCcw size={14} /> Reabrir Análise
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(submission); }}
                        disabled={approveSubmission.isPending}
                        className="h-10 rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ backgroundColor: C.lime, color: C.black, ...heading, fontWeight: 700, fontSize: 13 }}
                      >
                        <CheckCircle size={14} /> Selecionar Agora
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal detalhes */}
      <Dialog open={!!selectedTaskPreview} onOpenChange={(open) => { if (!open) setSelectedTaskPreview(null) }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xl p-0 border-0 bg-transparent overflow-hidden shadow-none">
          <DialogTitle className="sr-only">Detalhes da Tarefa</DialogTitle>
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.1)` }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(255,255,222,0.07)` }}>
              <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>
                {selectedTaskPreview?.task?.title || 'Detalhes da Tarefa'}
              </span>
              <button
                onClick={() => setSelectedTaskPreview(null)}
                style={{ color: `${C.cream}50` }}
                className="hover:opacity-100 transition-opacity"
              >
                <XCircle size={18} />
              </button>
            </div>

            {selectedTaskPreview && (
              <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

                {/* Grid info */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Categoria', value: selectedTaskPreview.task?.category || '-', color: C.lime },
                    {
                      label: 'Valor / Pontuação',
                      value: selectedTaskPreview.task?.category === 'campanha'
                        ? `R$ ${Number(selectedTaskPreview.task?.offered_value || 0).toLocaleString('pt-BR')}`
                        : `${Number(selectedTaskPreview.task?.points || 0).toLocaleString('pt-BR')} pts`,
                      color: C.orange,
                    },
                    {
                      label: 'Vagas',
                      value: `${Number(selectedTaskPreview.task?.current_participants || 0)}${selectedTaskPreview.task?.max_participants ? ` / ${Number(selectedTaskPreview.task?.max_participants)}` : ''}`,
                      color: C.blue,
                    },
                    { label: 'Mín. Seguidores', value: Number(selectedTaskPreview.task?.min_followers || 0).toLocaleString('pt-BR'), color: `${C.cream}80` },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,222,0.04)', border: `1px solid rgba(255,255,222,0.07)` }}>
                      <p style={{ fontSize: 10, color: `${C.cream}50`, marginBottom: 4 }}>{label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Descrição */}
                <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,222,0.04)', border: `1px solid rgba(255,255,222,0.07)` }}>
                  <p style={{ fontSize: 10, color: `${C.cream}50`, marginBottom: 6 }}>Descrição</p>
                  <div className={isPreviewDescriptionExpanded ? '' : 'line-clamp-2'}
                    style={{ fontSize: 13, color: `${C.cream}70`, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selectedTaskPreview.task?.description || 'Sem descrição cadastrada.'}
                  </div>
                  {(selectedTaskPreview.task?.description || '').trim() && (
                    <button type="button" onClick={() => setIsPreviewDescriptionExpanded((v) => !v)}
                      style={{ fontSize: 12, color: C.lime, fontWeight: 600, marginTop: 6 }}>
                      {isPreviewDescriptionExpanded ? 'Ver menos' : 'Ver mais'}
                    </button>
                  )}
                </div>

                {/* Justificativa */}
                <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,222,0.04)', border: `1px solid rgba(255,255,222,0.07)` }}>
                  <p style={{ fontSize: 10, color: `${C.cream}50`, marginBottom: 6 }}>Justificativa</p>
                  <div className={isPreviewJustificationExpanded ? '' : 'line-clamp-2'}
                    style={{ fontSize: 13, color: `${C.cream}70`, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {selectedTaskPreview.description || 'Sem justificativa informada.'}
                  </div>
                  {(selectedTaskPreview.description || '').trim() && (
                    <button type="button" onClick={() => setIsPreviewJustificationExpanded((v) => !v)}
                      style={{ fontSize: 12, color: C.lime, fontWeight: 600, marginTop: 6 }}>
                      {isPreviewJustificationExpanded ? 'Ver menos' : 'Ver mais'}
                    </button>
                  )}
                </div>

                {/* Datas */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Prazo de postagem', value: selectedTaskPreview.task?.posting_deadline ? format(new Date(selectedTaskPreview.task.posting_deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-' },
                    { label: 'Expira em', value: selectedTaskPreview.task?.expires_at ? format(new Date(selectedTaskPreview.task.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-' },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,222,0.04)', border: `1px solid rgba(255,255,222,0.07)` }}>
                      <p style={{ fontSize: 10, color: `${C.cream}50`, marginBottom: 4 }}>{label}</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.cream }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}