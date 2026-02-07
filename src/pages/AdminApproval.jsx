import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle, XCircle, Download, ExternalLink,
  Clock, User, Calendar, FileText } from
"lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminApproval() {
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const { data: pendingSubmissions, isLoading } = useQuery({
    queryKey: ['pending-submissions'],
    queryFn: () => base44.entities.TaskSubmission.filter({ status: 'pendente' }, '-created_date'),
    initialData: [],
    enabled: currentUser?.role === 'admin'
  });

  const { data: recentApproved } = useQuery({
    queryKey: ['recent-approved'],
    queryFn: () => base44.entities.TaskSubmission.filter({ status: 'aprovada' }, '-validated_at', 20),
    initialData: [],
    enabled: currentUser?.role === 'admin'
  });

  const { data: recentRejected } = useQuery({
    queryKey: ['recent-rejected'],
    queryFn: () => base44.entities.TaskSubmission.filter({ status: 'rejeitada' }, '-validated_at', 20),
    initialData: [],
    enabled: currentUser?.role === 'admin'
  });

  const { data: taskDetails } = useQuery({
    queryKey: ['task-details', selectedTaskId],
    queryFn: async () => {
      const tasks = await base44.entities.Task.list();
      return tasks.find(t => t.id === selectedTaskId);
    },
    enabled: !!selectedTaskId
  });

  const approveSubmissionMutation = useMutation({
    mutationFn: async (submissionId) => {
      const submission = pendingSubmissions.find((s) => s.id === submissionId);

      // Buscar task para pegar os pontos
      const tasks = await base44.entities.Task.list();
      const task = tasks.find((t) => t.id === submission.task_id);

      // Atualizar submissão
      await base44.entities.TaskSubmission.update(submissionId, {
        status: 'aprovada',
        points_earned: task?.points || 0,
        validated_at: new Date().toISOString()
      });

      // Atualizar pontos do usuário
      const users = await base44.entities.User.list();
      const user = users.find((u) => u.email === submission.user_email);

      if (user) {
        await base44.entities.User.update(user.id, {
          total_points: (user.total_points || 0) + (task?.points || 0),
          tasks_completed: (user.tasks_completed || 0) + 1
        });
      }
      
      // Criar notificação
      await base44.entities.Notification.create({
        user_email: submission.user_email,
        title: "🎉 Tarefa Aprovada!",
        message: `Sua tarefa foi aprovada! Você ganhou ${task?.points || 0} pontos.`,
        type: "submissao_aprovada",
        related_task_id: submission.task_id,
        related_task_title: submission.task_title,
        is_read: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-approved'] });
      setSelectedSubmission(null);
    }
  });

  const rejectSubmissionMutation = useMutation({
    mutationFn: async ({ submissionId, reason }) => {
      const submission = pendingSubmissions.find((s) => s.id === submissionId);
      
      await base44.entities.TaskSubmission.update(submissionId, {
        status: 'rejeitada',
        rejection_reason: reason,
        validated_at: new Date().toISOString()
      });
      
      // Criar notificação
      if (submission) {
        await base44.entities.Notification.create({
          user_email: submission.user_email,
          title: "Tarefa não aprovada",
          message: `Sua tarefa não foi aprovada. Motivo: ${reason}`,
          type: "submissao_rejeitada",
          related_task_id: submission.task_id,
          related_task_title: submission.task_title,
          is_read: false
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-rejected'] });
      setSelectedSubmission(null);
      setRejectionReason("");
      alert('Submissão rejeitada com sucesso. O Ecoante receberá o feedback.');
    }
  });

  const revertSubmissionMutation = useMutation({
    mutationFn: async (submission) => {
      // Se estava aprovada, precisa remover os pontos do usuário
      if (submission.status === 'aprovada') {
        const users = await base44.entities.User.list();
        const user = users.find((u) => u.email === submission.user_email);
        
        if (user) {
          await base44.entities.User.update(user.id, {
            total_points: Math.max(0, (user.total_points || 0) - (submission.points_earned || 0)),
            tasks_completed: Math.max(0, (user.tasks_completed || 0) - 1)
          });
        }
      }

      // Reverter para pendente
      await base44.entities.TaskSubmission.update(submission.id, {
        status: 'pendente',
        validated_at: null,
        rejection_reason: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-approved'] });
      queryClient.invalidateQueries({ queryKey: ['recent-rejected'] });
      alert('Decisão revertida! A submissão voltou para pendente.');
    }
  });

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>);

  }

  const renderSubmissionCard = (submission, showActions = false, showRevert = false) =>
  <Card
    key={submission.id}
    className="shadow-md hover:shadow-lg transition-all duration-300 border-gray-200 bg-white">

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{submission.task_title}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedTaskId(submission.task_id);
                  setTaskDetailsOpen(true);
                }}
                className="text-emerald-600 hover:text-emerald-700"
              >
                <FileText className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{submission.user_name}</span>
              <span className="text-gray-400">•</span>
              <span>{submission.user_email}</span>
            </div>
          </div>
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {submission.description &&
      <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Descrição:</p>
            <p className="text-sm text-gray-600">{submission.description}</p>
          </div>
      }

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Provas enviadas:</p>
          <div className="flex flex-col gap-2">
            {submission.proof_url &&
          <a
            href={submission.proof_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700">

                <ExternalLink className="w-4 h-4" />
                Link da prova
              </a>
          }
            {submission.proof_file_url &&
          <a
            href={submission.proof_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">

                <Download className="w-4 h-4" />
                Baixar arquivo
              </a>
          }
            {submission.insights_file_url &&
          <a
            href={submission.insights_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700">

                <Download className="w-4 h-4" />
                Baixar insights
              </a>
          }
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 pt-2 border-t">
          <Calendar className="w-4 h-4" />
          Enviado em {format(new Date(submission.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>

        {showActions &&
      <div className="flex gap-3 pt-4">
            <Button
          onClick={() => approveSubmissionMutation.mutate(submission.id)}
          className="flex-1 bg-green-600 hover:bg-green-700"
          disabled={approveSubmissionMutation.isPending}>

              <CheckCircle className="w-4 h-4 mr-2" />
              Aprovar
            </Button>
            <Button
          onClick={() => setSelectedSubmission(submission)}
          variant="destructive"
          className="flex-1">

              <XCircle className="w-4 h-4 mr-2" />
              Rejeitar
            </Button>
          </div>
      }

        {showRevert &&
      <div className="pt-4">
            <Button
          onClick={() => revertSubmissionMutation.mutate(submission)}
          variant="outline"
          className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
          disabled={revertSubmissionMutation.isPending}>

              Reverter Decisão
            </Button>
          </div>
      }
      </CardContent>
    </Card>;


  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Aprovação de Tarefas

          </h1>
          <p className="text-gray-600 mt-2">Valide as submissões dos Ecoantes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-lg border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Pendentes</p>
                  <p className="text-3xl font-bold text-yellow-700">{pendingSubmissions.length}</p>
                </div>
                <Clock className="w-12 h-12 text-yellow-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Aprovadas Hoje</p>
                  <p className="text-3xl font-bold text-green-700">
                    {recentApproved.filter((s) => {
                      const today = new Date().toDateString();
                      return new Date(s.validated_at).toDateString() === today;
                    }).length}
                  </p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Rejeitadas Hoje</p>
                  <p className="text-3xl font-bold text-red-700">
                    {recentRejected.filter((s) => {
                      const today = new Date().toDateString();
                      return new Date(s.validated_at).toDateString() === today;
                    }).length}
                  </p>
                </div>
                <XCircle className="w-12 h-12 text-red-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pendentes" className="space-y-6">
          <TabsList className="bg-emerald-50 p-1">
            <TabsTrigger value="pendentes" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white">
              Pendentes ({pendingSubmissions.length})
            </TabsTrigger>
            <TabsTrigger value="aprovadas" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              Aprovadas Recentes
            </TabsTrigger>
            <TabsTrigger value="rejeitadas" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              Rejeitadas Recentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="space-y-4">
            {pendingSubmissions.length === 0 ?
            <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma submissão pendente</p>
              </div> :

            <div className="grid md:grid-cols-2 gap-6">
                {pendingSubmissions.map((sub) => renderSubmissionCard(sub, true))}
              </div>
            }
          </TabsContent>

          <TabsContent value="aprovadas" className="space-y-4">
            {recentApproved.length === 0 ?
            <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma submissão aprovada recentemente</p>
              </div> :

            <div className="grid md:grid-cols-2 gap-6">
                {recentApproved.map((sub) => renderSubmissionCard(sub, false, true))}
              </div>
            }
          </TabsContent>

          <TabsContent value="rejeitadas" className="space-y-4">
            {recentRejected.length === 0 ?
            <div className="text-center py-12">
                <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma submissão rejeitada recentemente</p>
              </div> :

            <div className="grid md:grid-cols-2 gap-6">
                {recentRejected.map((sub) => renderSubmissionCard(sub, false, true))}
              </div>
            }
          </TabsContent>
        </Tabs>

        <Dialog open={taskDetailsOpen} onOpenChange={setTaskDetailsOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Tarefa</DialogTitle>
            </DialogHeader>
            {taskDetails && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-xl mb-2">{taskDetails.title}</h3>
                  <Badge className="bg-emerald-100 text-emerald-700">
                    {taskDetails.points} pontos
                  </Badge>
                </div>
                
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Descrição:</p>
                  <p className="text-sm text-gray-600">{taskDetails.description}</p>
                </div>

                {taskDetails.requirements && taskDetails.requirements.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Requisitos:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {taskDetails.requirements.map((req, idx) => (
                        <li key={idx} className="text-sm text-gray-600">{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {taskDetails.deadline && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600">Prazo</p>
                      <p className="text-sm font-medium">{format(new Date(taskDetails.deadline), "dd/MM/yyyy", { locale: ptBR })}</p>
                    </div>
                  )}
                  {taskDetails.max_participants && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-gray-600">Vagas</p>
                      <p className="text-sm font-medium">{taskDetails.current_participants || 0} / {taskDetails.max_participants}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {selectedSubmission &&
        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Rejeitar Submissão</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Tarefa:</strong> {selectedSubmission.task_title}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <strong>Ecoante:</strong> {selectedSubmission.user_name}
                  </p>
                </div>
                
                <p className="text-sm text-gray-600">
                  Explique o motivo da rejeição. Seja claro e construtivo para ajudar o Ecoante a melhorar:
                </p>
                
                <div>
                  <Label htmlFor="reason" className="text-base font-semibold">
                    Motivo da Rejeição *
                  </Label>
                  <Textarea
                  id="reason"
                  placeholder="Exemplo: A prova enviada não demonstra claramente a realização da tarefa. Por favor, envie um print ou link que mostre..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="h-32 mt-2"
                  required />

                  <p className="text-xs text-gray-500 mt-2">
                    💡 Dica: Seja específico sobre o que está faltando ou incorreto
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedSubmission(null);
                    setRejectionReason("");
                  }}
                  className="flex-1">

                    Cancelar
                  </Button>
                  <Button
                  variant="destructive"
                  onClick={() => rejectSubmissionMutation.mutate({
                    submissionId: selectedSubmission.id,
                    reason: rejectionReason
                  })}
                  disabled={!rejectionReason.trim() || rejectSubmissionMutation.isPending}
                  className="flex-1">

                    {rejectSubmissionMutation.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      </div>
    </div>);

}