// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions } from "@/hooks/useMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, CheckCircle, XCircle, Star, ExternalLink, CircleDollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskDetailsModal from "../components/tasks/TaskDetailsModal";

const normalizeSubmissionStatus = (status) => {
  if (status === 'pendente') return 'pending';
  if (status === 'aprovada') return 'approved';
  if (status === 'rejeitada') return 'rejected';
  return status;
};

const CATEGORY_NAMES = {
  campanha: 'Campanha',
  resposta_rapida: 'Resposta Rápida',
  oficina: 'Oficina',
  folhetim: 'Folhetim',
  compartilhar_ecoante: 'Compartilhar Ecoante',
};

const CATEGORY_COLORS = {
  campanha: 'bg-green-100 text-green-700 border-green-200',
  resposta_rapida: 'bg-orange-100 text-orange-700 border-orange-200',
  oficina: 'bg-purple-100 text-purple-700 border-purple-200',
  folhetim: 'bg-blue-100 text-blue-700 border-blue-200',
  compartilhar_ecoante: 'bg-pink-100 text-pink-700 border-pink-200',
};

function ProofPreview({ proofUrl }) {
  if (!proofUrl) return null;

  return (
    <div className="pt-2">
      <a
        href={proofUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-900 underline"
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalLink className="w-4 h-4" />
        Abrir comprovante
      </a>
    </div>
  );
}

export default function MySubmissions() {
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const { user } = useAuth();
  const { data: submissions = [], isLoading, error } = useMySubmissions(user?.id);
  const { data: myMetricsSubmissions = [] } = useMyMetricsSubmissions(user?.id);

  const getSubmissionTaskId = (submission) => {
    return submission?.task_id || submission?.task?.id || null;
  };

  const getCampaignMetricsStatus = (submission) => {
    const taskId = getSubmissionTaskId(submission);
    if (!taskId) return null;

    const metricsSubmission = myMetricsSubmissions.find((item) => String(item.task_id) === String(taskId));
    return String(metricsSubmission?.status || '').trim().toLowerCase() || null;
  };

  const isCampaignWithPendingMetrics = (submission) => {
    const status = normalizeSubmissionStatus(submission?.status);
    const isCampaign = submission?.task?.category === 'campanha';
    if (!isCampaign || status !== 'approved') return false;

    const metricsStatus = getCampaignMetricsStatus(submission);
    return metricsStatus !== 'approved';
  };

  const pendingSubmissions = submissions.filter((s) => {
    const status = normalizeSubmissionStatus(s.status);
    return ['pending', 'application_pending', 'application_approved', 'proof_pending'].includes(status)
      || isCampaignWithPendingMetrics(s);
  });
  const approvedSubmissions = submissions.filter((s) => {
    const status = normalizeSubmissionStatus(s.status);
    if (status !== 'approved') return false;
    return !isCampaignWithPendingMetrics(s);
  });
  const rejectedSubmissions = submissions.filter((s) => {
    const status = normalizeSubmissionStatus(s.status);
    return ['application_rejected', 'rejected'].includes(status);
  });

  const renderSubmissionCard = (submission) => (
    (() => {
      const status = normalizeSubmissionStatus(submission.status);
      const proofDeadline = submission?.task?.delivery_deadline
        ? new Date(submission.task.delivery_deadline)
        : null;
      const hasProofDeadline = proofDeadline && !Number.isNaN(proofDeadline.getTime());
      const postingDeadline = submission?.task?.posting_deadline
        ? new Date(submission.task.posting_deadline)
        : null;
      const hasPostingDeadline = postingDeadline && !Number.isNaN(postingDeadline.getTime());
      const isApprovedCampaign = status === 'approved' && submission?.task?.category === 'campanha';
      const metricsStatus = isApprovedCampaign ? getCampaignMetricsStatus(submission) : null;
      const category = submission?.task?.category;
      const categoryLabel = CATEGORY_NAMES[category] || category || 'Tarefa';
      const categoryColorClass = CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-700 border-gray-200';
      const offeredValue = Number(submission?.task?.offered_value || 0);
      const pointsValue = Number(submission?.points_awarded || submission?.task?.points || 0);
      const hasMoneyReward = offeredValue > 0;
      return (
    <Card
      key={submission.id}
      className="shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border-emerald-200 bg-white"
      onClick={() => setSelectedSubmission(submission)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`${categoryColorClass} border`}>
                {categoryLabel}
              </Badge>
            </div>
            <CardTitle className="text-lg leading-tight">
              {submission.task?.title || 'Tarefa'}
            </CardTitle>
            {submission.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                {submission.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 rounded-full border border-amber-200 shrink-0">
            {hasMoneyReward ? (
              <CircleDollarSign className="w-4 h-4 text-amber-600" />
            ) : (
              <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
            )}
            <span className="font-bold text-amber-700">
              {hasMoneyReward
                ? `R$ ${offeredValue.toLocaleString('pt-BR')}`
                : pointsValue.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm pt-1">
          <div className="flex items-center gap-2 text-gray-500 flex-wrap">
            {status === 'application_approved' && hasProofDeadline && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md border bg-purple-100 text-purple-700 border-purple-200">
                <Clock className="w-4 h-4" />
                <span>Prova até {format(proofDeadline, "dd MMM", { locale: ptBR })}</span>
              </div>
            )}

            {isApprovedCampaign && metricsStatus !== 'approved' && hasPostingDeadline && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md border bg-emerald-100 text-emerald-700 border-emerald-200">
                <Clock className="w-4 h-4" />
                <span>Postagem até {format(postingDeadline, "dd MMM", { locale: ptBR })}</span>
              </div>
            )}
          </div>

          <div className="shrink-0">
            {['pending', 'application_pending'].includes(status) && (
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                <Clock className="w-3 h-3 mr-1" />
                Inscrição em análise
              </Badge>
            )}
            {status === 'application_approved' && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                <Clock className="w-3 h-3 mr-1" />
                Aprovado p/ fazer
              </Badge>
            )}
            {status === 'proof_pending' && (
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                <Clock className="w-3 h-3 mr-1" />
                Prova em análise
              </Badge>
            )}
            {status === 'approved' && (
              isApprovedCampaign ? (
                metricsStatus === 'approved' ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Concluída
                  </Badge>
                ) : metricsStatus === 'pending' ? (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    <Clock className="w-3 h-3 mr-1" />
                    Métricas em análise
                  </Badge>
                ) : metricsStatus === 'rejected' ? (
                  <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                    <Clock className="w-3 h-3 mr-1" />
                    Reenviar métricas
                  </Badge>
                ) : (
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                    <Clock className="w-3 h-3 mr-1" />
                    Pendente métricas
                  </Badge>
                )
              ) : (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Concluída
                </Badge>
              )
            )}
            {['application_rejected', 'rejected'].includes(status) && (
              <Badge className="bg-red-100 text-red-700 border-red-200">
                <XCircle className="w-3 h-3 mr-1" />
                {status === 'application_rejected' ? 'Inscrição rejeitada' : 'Prova rejeitada'}
              </Badge>
            )}
          </div>
        </div>

        {submission.rejection_reason && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-medium text-red-700 mb-1">Motivo da rejeição</p>
            <p className="text-sm text-red-600 line-clamp-3">{submission.rejection_reason}</p>
          </div>
        )}

        <ProofPreview proofUrl={submission.proof_url} />
      </CardContent>
    </Card>
      )
    })()
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

  if (error) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
        <div className="max-w-6xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-8">
              <h3 className="text-lg font-semibold text-red-700 mb-2">Erro ao carregar submissões</h3>
              <p className="text-sm text-red-600">{error?.message || 'Não foi possível carregar seu histórico agora.'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Minhas Submissões</h1>
          <p className="text-gray-600">Acompanhe o status das suas tarefas enviadas</p>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-8">
            <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white">
              Pendentes ({pendingSubmissions.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              Aprovadas ({approvedSubmissions.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              Rejeitadas ({rejectedSubmissions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-0">
            {pendingSubmissions.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Nenhuma submissão pendente
                  </h3>
                  <p className="text-gray-500">
                    Suas inscrições e provas em andamento aparecerão aqui.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingSubmissions.map(renderSubmissionCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-0">
            {approvedSubmissions.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Nenhuma submissão aprovada ainda
                  </h3>
                  <p className="text-gray-500">
                    Continue completando tarefas para ganhar pontos!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {approvedSubmissions.map(renderSubmissionCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="mt-0">
            {rejectedSubmissions.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Nenhuma submissão rejeitada
                  </h3>
                  <p className="text-gray-500">
                    Ótimo trabalho! Continue assim.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rejectedSubmissions.map(renderSubmissionCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {selectedSubmission && (
        <TaskDetailsModal
          task={selectedSubmission.task || { id: selectedSubmission.task_id, title: 'Tarefa' }}
          onClose={() => setSelectedSubmission(null)}
          isTaskClaimed={['application_pending', 'application_approved', 'proof_pending', 'pending'].includes(normalizeSubmissionStatus(selectedSubmission.status))}
          isTaskApproved={normalizeSubmissionStatus(selectedSubmission.status) === 'approved'}
          currentSubmission={selectedSubmission}
        />
      )}
    </div>
  );
}
