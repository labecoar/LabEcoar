// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingSubmissions, useApproveSubmission, useRejectSubmission, useApprovalHistory } from "@/hooks/useSubmissions";
import { useAddPoints } from "@/hooks/useScores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle, XCircle, ExternalLink, FileText,
  Clock, User, Calendar, Star, Shield
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";

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

const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const REVIEW_SLA_BUSINESS_HOURS = 5;

function ProofPreview({ url, compact = false }) {
  return (
    <div className={compact
      ? 'w-full h-32 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center gap-2 text-gray-600'
      : 'w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-5 flex items-center gap-2 text-gray-700'
    }>
      <FileText className="w-5 h-5" />
      <span className="text-sm font-medium">Arquivo</span>
    </div>
  );
}

const isBusinessDay = (date) => {
  const day = date.getDay();
  return day >= 1 && day <= 5;
};

const nextBusinessDayStart = (baseDate) => {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + 1);
  date.setHours(BUSINESS_START_HOUR, 0, 0, 0);
  while (!isBusinessDay(date)) {
    date.setDate(date.getDate() + 1);
  }
  return date;
};

const normalizeToBusinessWindow = (baseDate) => {
  const date = new Date(baseDate);

  if (!isBusinessDay(date)) {
    date.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    while (!isBusinessDay(date)) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  const hour = date.getHours();
  if (hour < BUSINESS_START_HOUR) {
    date.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    return date;
  }

  if (hour >= BUSINESS_END_HOUR) {
    return nextBusinessDayStart(date);
  }

  return date;
};

const addBusinessHours = (baseDate, hoursToAdd) => {
  let current = normalizeToBusinessWindow(baseDate);
  let remainingHours = Number(hoursToAdd || 0);

  while (remainingHours > 0) {
    const endOfBusinessDay = new Date(current);
    endOfBusinessDay.setHours(BUSINESS_END_HOUR, 0, 0, 0);

    const availableTodayHours = Math.max(0, (endOfBusinessDay.getTime() - current.getTime()) / (1000 * 60 * 60));
    if (availableTodayHours <= 0) {
      current = nextBusinessDayStart(current);
      continue;
    }

    const consumeHours = Math.min(remainingHours, availableTodayHours);
    current = new Date(current.getTime() + consumeHours * 60 * 60 * 1000);
    remainingHours -= consumeHours;

    if (remainingHours > 0) {
      current = nextBusinessDayStart(current);
    }
  }

  return current;
};

export default function AdminApproval() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [, setNowTick] = useState(Date.now());
  const { profile } = useAuth();

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
    const referenceDate = submission.updated_at || submission.created_at;
    if (!referenceDate) return null;
    const base = new Date(referenceDate);
    if (Number.isNaN(base.getTime())) return null;
    return addBusinessHours(base, REVIEW_SLA_BUSINESS_HOURS);
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
    .filter((submission) => normalizeSubmissionStatus(submission.status) === 'proof_pending')
    .sort((a, b) => {
      const aDeadline = getReviewDeadline(a);
      const bDeadline = getReviewDeadline(b);
      if (!aDeadline && !bDeadline) return 0;
      if (!aDeadline) return 1;
      if (!bDeadline) return -1;
      return aDeadline.getTime() - bDeadline.getTime();
    });

  const approvedSubmissions = pendingSubmissions
    .filter((submission) => normalizeSubmissionStatus(submission.status) === 'approved')
    .sort((a, b) => new Date(b.validated_at || b.updated_at || b.created_at).getTime() - new Date(a.validated_at || a.updated_at || a.created_at).getTime());

  const rejectedSubmissions = pendingSubmissions
    .filter((submission) => normalizeSubmissionStatus(submission.status) === 'rejected')
    .sort((a, b) => new Date(b.validated_at || b.updated_at || b.created_at).getTime() - new Date(a.validated_at || a.updated_at || a.created_at).getTime());

  const latestProofApprovalBySubmission = approvalHistory.reduce((acc, entry) => {
    if (entry?.action !== 'proof_approved' || !entry?.submission_id) return acc;
    const previous = acc[entry.submission_id];
    if (!previous) {
      acc[entry.submission_id] = entry;
      return acc;
    }

    const previousTime = new Date(previous.approved_at || 0).getTime();
    const currentTime = new Date(entry.approved_at || 0).getTime();
    if (currentTime > previousTime) {
      acc[entry.submission_id] = entry;
    }
    return acc;
  }, {});

  const overdueProofSubmissions = proofPendingSubmissions.filter((submission) => isReviewOverdue(submission));
  const activeProofSubmissions = proofPendingSubmissions.filter((submission) => !isReviewOverdue(submission)).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Verifica se é admin
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
    );
  }

  const handleApprove = async (submission) => {
    try {
      const isCampaign = submission.task?.category === 'campanha';
      const pointsToAward = isCampaign ? 0 : Number(submission.task?.points || 0);

      // Aprovar submissão
      const approvedSubmission = await approveSubmission.mutateAsync({
        submissionId: submission.id,
        pointsAwarded: pointsToAward
      });

      // Adicionar pontos ao usuário apenas na aprovação final da prova
      if (approvedSubmission?.status === 'approved' && pointsToAward > 0) {
        await addPoints.mutateAsync({
          userId: submission.user_id,
          points: pointsToAward
        });
      }

      notifySuccess(
        approvedSubmission?.status === 'application_approved'
          ? 'Inscrição aprovada! Agora o usuário pode enviar a prova.'
          : 'Prova aprovada com sucesso! Pontos adicionados.'
      );
      setSelectedSubmission(null);
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      notifyError('Erro ao aprovar submissão');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      notifyWarning('Por favor, informe o motivo da rejeição');
      return;
    }

    try {
      await rejectSubmission.mutateAsync({
        submissionId: selectedSubmission.id,
        rejectionReason: rejectionReason
      });

      notifySuccess('Submissão rejeitada');
      setSelectedSubmission(null);
      setRejectionReason('');
      setIsRejecting(false);
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      notifyError('Erro ao rejeitar submissão');
    }
  };

  const SubmissionCard = ({ submission }) => (
    <Card
      className={`group cursor-pointer overflow-hidden border border-emerald-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-300 ${normalizeSubmissionStatus(submission.status) === 'proof_pending' && isReviewOverdue(submission)
          ? 'border-red-200 bg-red-50/70 hover:border-red-300'
          : normalizeSubmissionStatus(submission.status) === 'proof_pending' && isReviewCritical(submission)
            ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
            : 'border-emerald-100 hover:border-emerald-300'
        }`}
      onClick={() => setSelectedSubmission(submission)}
    >
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-[17px] leading-snug text-[#3c0b14] line-clamp-2">
              {submission.task?.title || 'Tarefa'}
            </CardTitle>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 line-clamp-1">
                  {submission.profile?.full_name || submission.profile?.email || 'Usuário'}
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-right shadow-sm">
            <p className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-amber-800">
              <Star className="h-4 w-4 fill-amber-600 text-amber-600" />

              {submission.task?.category === 'campanha'
                ? `R$ ${Number(submission.task?.offered_value || 0).toLocaleString('pt-BR')}`
                : `${Number(submission.task?.points || 0).toLocaleString('pt-BR')} pts`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {normalizeSubmissionStatus(submission.status) === 'proof_pending' ? (
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
              <Clock className="w-3 h-3 mr-1" />
              Prova Pendente
            </Badge>
          ) : normalizeSubmissionStatus(submission.status) === 'approved' ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Prova Aprovada
            </Badge>
          ) : normalizeSubmissionStatus(submission.status) === 'rejected' ? (
            <Badge className="bg-red-100 text-red-700 border-red-200">
              <XCircle className="w-3 h-3 mr-1" />
              Prova Rejeitada
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
              <Clock className="w-3 h-3 mr-1" />
              Inscrição Pendente
            </Badge>
          )}

          {normalizeSubmissionStatus(submission.status) === 'proof_pending' && isReviewOverdue(submission) ? (
            <Badge className="bg-red-600 text-white border-red-700 animate-pulse">
              Expirado
            </Badge>
          ) : normalizeSubmissionStatus(submission.status) === 'proof_pending' && isReviewCritical(submission) ? (
            <Badge className="bg-amber-500 text-white border-amber-600">
              Urgente: {formatRemainingReviewTime(submission)}
            </Badge>
          ) : normalizeSubmissionStatus(submission.status) === 'proof_pending' ? (
            <Badge className="bg-red-100 text-red-700 border-red-200">
              Revisar em {formatRemainingReviewTime(submission)}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {format(new Date(submission.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </span>
          </span>

          {normalizeSubmissionStatus(submission.status) === 'approved' && latestProofApprovalBySubmission[submission.id] ? (
            <span className="max-w-[190px] truncate text-right">
              Por {latestProofApprovalBySubmission[submission.id].approver_name || latestProofApprovalBySubmission[submission.id].approver_email || 'Admin'}
            </span>
          ) : (
            <span className="text-right">
              {normalizeSubmissionStatus(submission.status) === 'proof_pending'
                ? `Revisar em ${formatRemainingReviewTime(submission)}`
                : 'Toque para abrir'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando submissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700 mb-2 inline-flex items-center gap-2">
            Aprovação Final de Provas
            <Shield className="w-7 h-7" />
          </h1>
          <p className="text-gray-600">Valide as provas enviadas após aprovação de inscrição.</p>
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="w-6 h-6 text-yellow-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{proofPendingSubmissions.length}</p>
                  <p className="text-sm text-gray-600">Provas Aguardando Análise</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={overdueProofSubmissions.length > 0 ? 'border-2 border-red-300 bg-red-50/60' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${overdueProofSubmissions.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <Clock className={`w-6 h-6 ${overdueProofSubmissions.length > 0 ? 'text-red-700' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${overdueProofSubmissions.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                    {overdueProofSubmissions.length}
                  </p>
                  <p className="text-sm text-gray-600">Com Prazo Expirado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 mb-2">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === 'pending' ? 'bg-white text-[#3c0b14] shadow-sm' : 'text-gray-600'}`}
            onClick={() => setActiveTab('pending')}
          >
            Pendentes ({proofPendingSubmissions.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === 'approved' ? 'bg-white text-[#3c0b14] shadow-sm' : 'text-gray-600'}`}
            onClick={() => setActiveTab('approved')}
          >
            Aprovados ({approvedSubmissions.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === 'rejected' ? 'bg-white text-[#3c0b14] shadow-sm' : 'text-gray-600'}`}
            onClick={() => setActiveTab('rejected')}
          >
            Recusados ({rejectedSubmissions.length})
          </button>
        </div>

        {activeTab === 'pending' && proofPendingSubmissions.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Nenhuma prova pendente
              </h3>
              <p className="text-gray-500">
                Todas as provas enviadas já foram analisadas.
              </p>
            </CardContent>
          </Card>
        ) : activeTab === 'pending' ? (
          <div className="space-y-6">
            {overdueProofSubmissions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-red-700">Prioridade Máxima: Provas Atrasadas</h2>
                  <Badge className="bg-red-600 text-white border-red-700">{overdueProofSubmissions.length} atrasada(s)</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {overdueProofSubmissions.map((submission) => (
                    <SubmissionCard key={submission.id} submission={submission} />
                  ))}
                </div>
              </div>
            )}

            {activeProofSubmissions.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-3">Demais Provas Pendentes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeProofSubmissions.map((submission) => (
                    <SubmissionCard key={submission.id} submission={submission} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'approved' ? (
          approvedSubmissions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhuma prova aprovada</h3>
                <p className="text-gray-500">As provas aprovadas aparecerão aqui no histórico.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {approvedSubmissions.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))}
            </div>
          )
        ) : rejectedSubmissions.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhuma prova recusada</h3>
              <p className="text-gray-500">As recusas de prova aparecerão aqui no histórico.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rejectedSubmissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedSubmission && (
        <Dialog open={!!selectedSubmission} onOpenChange={() => {
          setSelectedSubmission(null);
          setIsDescriptionExpanded(false);
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl text-[#3c0b14]">Detalhes da Prova</DialogTitle>
            </DialogHeader>

            <div className="space-y-5 py-4">
              <div>
                <h3 className="mb-2 text-lg font-semibold text-[#3c0b14] break-words">
                  {selectedSubmission.task?.title || 'Tarefa'}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                    {STATUS_LABELS[selectedSubmission.status] || selectedSubmission.status}
                  </Badge>
                  {selectedSubmission.task?.category === 'campanha' && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      Após prova, aguarda etapa de métricas
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-emerald-100 bg-[#f3fbf7] p-3">
                  <p className="text-xs text-gray-600">Categoria</p>
                  <p className="mt-1 text-base font-semibold text-gray-900 capitalize">
                    {selectedSubmission.task?.category || '-'}
                  </p>
                </div>

                <div className="rounded-lg border border-amber-100 bg-[#fff8eb] p-3">
                  <p className="text-xs text-gray-600">Valor / Pontuação</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {selectedSubmission.task?.category === 'campanha'
                      ? `R$ ${Number(selectedSubmission.task?.offered_value || 0).toLocaleString('pt-BR')}`
                      : `${Number(selectedSubmission.task?.points || 0).toLocaleString('pt-BR')} pontos`}
                  </p>
                </div>

                <div className="rounded-lg border border-blue-100 bg-[#f4f8ff] p-3">
                  <p className="text-xs text-gray-600">Enviado em</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {format(new Date(selectedSubmission.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>

                <div className="rounded-lg border border-purple-100 bg-[#f9f4ff] p-3">
                  <p className="text-xs text-gray-600">Prazo de revisão</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {formatRemainingReviewTime(selectedSubmission)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-600 mb-1">Enviado por</p>
                <p className="font-semibold text-gray-900">
                  {selectedSubmission.profile?.full_name || 'Usuário'}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedSubmission.profile?.email || 'sem email'}
                </p>
              </div>

              {selectedSubmission.description && (
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-600 mb-1">Descrição</p>
                  <div
                    className={isDescriptionExpanded
                      ? 'text-sm text-gray-800 whitespace-pre-wrap break-words'
                      : 'text-sm text-gray-800 whitespace-pre-wrap break-all line-clamp-2 overflow-hidden'}
                  >
                    {selectedSubmission.description}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-emerald-700 hover:underline"
                    onClick={() => setIsDescriptionExpanded((current) => !current)}
                  >
                    {isDescriptionExpanded ? 'Ver menos' : 'Ver mais'}
                  </button>
                </div>
              )}

              {selectedSubmission.proof_url && (
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-600 mb-1">Comprovante</p>
                  <a
                    href={selectedSubmission.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-white bg-white px-4 py-3 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-emerald-600 shadow-sm">
                        <ExternalLink className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Abrir arquivo</p>
                        <p className="text-xs text-gray-500">Clique para visualizar o comprovante enviado</p>
                      </div>
                    </div>
                  </a>
                </div>
              )}

              {normalizeSubmissionStatus(selectedSubmission.status) === 'proof_pending' ? (
                !isRejecting ? (
                  <div className="flex flex-col gap-3 pt-1 md:flex-row">
                    <Button
                      onClick={() => handleApprove(selectedSubmission)}
                      disabled={approveSubmission.isPending}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {approveSubmission.isPending ? 'Aprovando...' : 'Aprovar'}
                    </Button>
                    <Button
                      onClick={() => setIsRejecting(true)}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-400"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Rejeitar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-red-100 bg-red-50/50 p-5">
                    <Label htmlFor="rejection-reason" className="text-sm font-semibold text-gray-700">Motivo da Rejeição</Label>
                    <Textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explique o motivo da rejeição para o usuário..."
                      rows={4}
                      className="bg-white"
                    />
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Button
                        onClick={handleReject}
                        disabled={rejectSubmission.isPending}
                        className="flex-1 bg-red-600 hover:bg-red-700"
                      >
                        {rejectSubmission.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
                      </Button>
                      <Button
                        onClick={() => {
                          setIsRejecting(false);
                          setRejectionReason('');
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
