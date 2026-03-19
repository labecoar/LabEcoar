// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, CheckCircle, XCircle, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskDetailsModal from "../components/tasks/TaskDetailsModal";

const normalizeSubmissionStatus = (status) => {
  if (status === 'pendente') return 'pending';
  if (status === 'aprovada') return 'approved';
  if (status === 'rejeitada') return 'rejected';
  return status;
};

export default function MySubmissions() {
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const { user } = useAuth();
  const { data: submissions = [], isLoading } = useMySubmissions(user?.id);

  const pendingSubmissions = submissions.filter((s) => {
    const status = normalizeSubmissionStatus(s.status);
    return ['pending', 'application_pending', 'application_approved', 'proof_pending'].includes(status);
  });
  const approvedSubmissions = submissions.filter((s) => normalizeSubmissionStatus(s.status) === 'approved');
  const rejectedSubmissions = submissions.filter((s) => {
    const status = normalizeSubmissionStatus(s.status);
    return ['application_rejected', 'rejected'].includes(status);
  });

  const renderSubmissionCard = (submission) => (
    (() => {
      const status = normalizeSubmissionStatus(submission.status);
      return (
    <Card
      key={submission.id}
      className="shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border-gray-200 bg-white"
      onClick={() => setSelectedSubmission(submission)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight">
              {submission.task?.title || 'Tarefa'}
            </CardTitle>
            {submission.task?.category && (
              <p className="text-sm text-gray-500 mt-1">
                {submission.task.category}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {['pending', 'application_pending'].includes(status) && (
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                <Clock className="w-3 h-3 mr-1" />
                Inscrição Pendente
              </Badge>
            )}
            {status === 'application_approved' && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Aguardando Envio da Prova
              </Badge>
            )}
            {status === 'proof_pending' && (
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                <Clock className="w-3 h-3 mr-1" />
                Prova em Análise
              </Badge>
            )}
            {status === 'approved' && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Aprovada
              </Badge>
            )}
            {['application_rejected', 'rejected'].includes(status) && (
              <Badge className="bg-red-100 text-red-700 border-red-200">
                <XCircle className="w-3 h-3 mr-1" />
                {status === 'application_rejected' ? 'Inscrição Rejeitada' : 'Prova Rejeitada'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {submission.description && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {submission.description}
          </p>
        )}
        
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4">
            {submission.points_awarded && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-full">
                <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
                <span className="font-bold text-amber-700">{submission.points_awarded}</span>
              </div>
            )}
          </div>
          
          <div className="text-right">
            <p className="text-xs text-gray-500">Enviado em</p>
            <p className="text-sm font-medium">
              {format(new Date(submission.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        {submission.rejection_reason && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-medium text-red-700 mb-1">Motivo da rejeição:</p>
            <p className="text-sm text-red-600">{submission.rejection_reason}</p>
          </div>
        )}

        {submission.proof_url && (
          <div className="pt-2">
            <img 
              src={submission.proof_url} 
              alt="Comprovante" 
              className="w-full h-32 object-cover rounded-lg"
            />
          </div>
        )}
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
