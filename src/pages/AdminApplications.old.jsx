import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  UserCheck,
  Users,
  CheckCircle,
  XCircle,
  ExternalLink,
  Instagram,
  Eye,
  Calendar,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function AdminApplications() {
  const queryClientHook = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState("all");
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [viewingTaskId, setViewingTaskId] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingApplicationId, setRejectingApplicationId] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const { data: tasks } = useQuery({
    queryKey: ['application-tasks'],
    queryFn: async () => {
      const allTasks = await base44.entities.Task.filter({ requires_application: true });
      return allTasks;
    },
    initialData: [],
    enabled: currentUser?.role === 'admin'
  });

  const { data: applications } = useQuery({
    queryKey: ['task-applications', selectedTaskId],
    queryFn: async () => {
      if (selectedTaskId === 'all') {
        return base44.entities.TaskApplication.list('-applied_at');
      }
      return base44.entities.TaskApplication.filter({ task_id: selectedTaskId }, '-applied_at');
    },
    initialData: [],
    enabled: currentUser?.role === 'admin'
  });

  const { data: taskDetails } = useQuery({
    queryKey: ['task-details', viewingTaskId],
    queryFn: async () => {
      const allTasks = await base44.entities.Task.list();
      return allTasks.find(t => t.id === viewingTaskId);
    },
    enabled: !!viewingTaskId
  });

  const selectCandidateMutation = useMutation({
    mutationFn: async (applicationId) => {
      const application = applications.find(a => a.id === applicationId);
      await base44.entities.TaskApplication.update(applicationId, {
        status: 'selecionado',
        reviewed_at: new Date().toISOString()
      });
      
      // Incrementa current_participants apenas quando aprovado
      if (application) {
        const task = await base44.entities.Task.filter({ id: application.task_id });
        if (task[0] && task[0].max_participants) {
          await base44.entities.Task.update(application.task_id, {
            current_participants: (task[0].current_participants || 0) + 1,
          });
        }
        
        // Cria notificação para o usuário
        await base44.entities.Notification.create({
          user_email: application.user_email,
          title: "🎉 Candidatura Aprovada!",
          message: `Sua candidatura foi aprovada! Você já pode realizar a tarefa.`,
          type: "candidatura_aprovada",
          related_task_id: application.task_id,
          related_task_title: application.task_title,
          is_read: false
        });
      }
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ['task-applications'] });
      queryClientHook.invalidateQueries({ queryKey: ['tasks'] });
      queryClientHook.invalidateQueries({ queryKey: ['application-tasks'] });
      alert('Candidato selecionado! Ele poderá realizar a tarefa agora.');
    }
  });

  const revertApplicationMutation = useMutation({
    mutationFn: async (applicationId) => {
      const application = applications.find(a => a.id === applicationId);
      const wasPreviouslySelected = application?.status === 'selecionado';
      
      await base44.entities.TaskApplication.update(applicationId, {
        status: 'pendente',
        reviewed_at: null,
        selection_notes: null
      });
      
      // Decrementa current_participants se estava selecionado antes
      if (wasPreviouslySelected && application) {
        const task = await base44.entities.Task.filter({ id: application.task_id });
        if (task[0] && task[0].max_participants && task[0].current_participants > 0) {
          await base44.entities.Task.update(application.task_id, {
            current_participants: task[0].current_participants - 1,
          });
        }
      }
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ['task-applications'] });
      queryClientHook.invalidateQueries({ queryKey: ['tasks'] });
      queryClientHook.invalidateQueries({ queryKey: ['application-tasks'] });
      alert('Decisão revertida! A inscrição voltou para pendente.');
    }
  });

  const rejectCandidateMutation = useMutation({
    mutationFn: async ({ applicationId, notes }) => {
      const application = applications.find(a => a.id === applicationId);
      await base44.entities.TaskApplication.update(applicationId, {
        status: 'rejeitado',
        reviewed_at: new Date().toISOString(),
        selection_notes: notes || null
      });
      
      // Cria notificação para o usuário
      if (application) {
        await base44.entities.Notification.create({
          user_email: application.user_email,
          title: "Candidatura não aprovada",
          message: notes || "Sua candidatura não foi aprovada desta vez, mas você pode tentar novamente!",
          type: "candidatura_rejeitada",
          related_task_id: application.task_id,
          related_task_title: application.task_title,
          is_read: false
        });
      }
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ['task-applications'] });
      setRejectDialogOpen(false);
      setRejectingApplicationId(null);
      setRejectionNotes("");
      alert('Candidato não selecionado.');
    }
  });

  const handleRejectClick = (applicationId) => {
    setRejectingApplicationId(applicationId);
    setRejectDialogOpen(true);
  };

  const handleRejectSubmit = () => {
    if (rejectingApplicationId) {
      rejectCandidateMutation.mutate({ 
        applicationId: rejectingApplicationId, 
        notes: rejectionNotes 
      });
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#3c0b14' }}>Acesso Negado</h1>
          <p style={{ color: '#929292' }}>Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  const pendingApplications = applications.filter((a) => a.status === 'pendente');
  const selectedApplications = applications.filter((a) => a.status === 'selecionado');
  const rejectedApplications = applications.filter((a) => a.status === 'rejeitado');

  const renderApplicationCard = (application) => {
    const isPending = application.status === 'pendente';
    const isReviewed = application.status === 'selecionado' || application.status === 'rejeitado';

    return (
      <Card key={application.id} className="shadow-md hover:shadow-lg transition-all duration-300 bg-white" style={{ borderColor: '#096e4c20' }}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1" style={{ color: '#3c0b14' }}>{application.user_name}</h3>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm" style={{ color: '#929292' }}>
                  Tarefa: {application.task_title}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setViewingTaskId(application.task_id);
                    setTaskDetailsOpen(true);
                  }}
                  className="h-6 px-2"
                  style={{ color: '#096e4c' }}
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </div>
              {application.status === 'pendente' && (
                <Badge className="border-2" style={{ background: '#f6c83520', color: '#f6c835', borderColor: '#f6c835' }}>
                  Aguardando Análise
                </Badge>
              )}
              {application.status === 'selecionado' && (
                <Badge className="border-2" style={{ background: '#00c33120', color: '#00c331', borderColor: '#00c331' }}>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Selecionado
                </Badge>
              )}
              {application.status === 'rejeitado' && (
                <Badge className="border-2" style={{ background: '#92929220', color: '#929292', borderColor: '#929292' }}>
                  Não Selecionado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {application.instagram_handle && (
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#e833ae10' }}>
                <Instagram className="w-4 h-4" style={{ color: '#e833ae' }} />
                <div>
                  <p className="text-xs" style={{ color: '#929292' }}>Instagram</p>
                  <p className="text-sm font-medium" style={{ color: '#3c0b14' }}>
                    @{application.instagram_handle}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#0077ad10' }}>
              <Users className="w-4 h-4" style={{ color: '#0077ad' }} />
              <div>
                <p className="text-xs" style={{ color: '#929292' }}>Seguidores</p>
                <p className="text-sm font-medium" style={{ color: '#3c0b14' }}>
                  {application.followers_count ? application.followers_count.toLocaleString('pt-BR') : 0}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-1" style={{ color: '#3c0b14' }}>Justificativa:</p>
            <p className="text-sm p-3 rounded-lg" style={{ background: '#096e4c05', color: '#3c0b14' }}>
              {application.justification}
            </p>
          </div>

          {application.portfolio_links && application.portfolio_links.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: '#3c0b14' }}>Portfólio:</p>
              <div className="flex flex-col gap-2">
                {application.portfolio_links.map((link, index) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm hover:underline"
                    style={{ color: '#096e4c' }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {link.length > 50 ? link.substring(0, 50) + '...' : link}
                  </a>
                ))}
              </div>
            </div>
          )}

          {application.selection_notes && application.status === 'rejeitado' && (
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: '#3c0b14' }}>Motivo da Não Seleção:</p>
              <p className="text-sm p-3 rounded-lg" style={{ background: '#ce161c05', color: '#3c0b14' }}>
                {application.selection_notes}
              </p>
            </div>
          )}

          <div className="text-xs pt-3 border-t flex items-center gap-2" style={{ color: '#929292', borderColor: '#096e4c20' }}>
            <Calendar className="w-3 h-3" />
            Inscrito em {format(new Date(application.applied_at || application.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>

          {isPending && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => selectCandidateMutation.mutate(application.id)}
                className="flex-1 text-white"
                style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                disabled={selectCandidateMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Selecionar
              </Button>
              <Button
                onClick={() => handleRejectClick(application.id)}
                variant="outline"
                className="flex-1"
                disabled={rejectCandidateMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Não Selecionar
              </Button>
            </div>
          )}

          {isReviewed && (
            <div className="pt-2">
              <Button
                onClick={() => revertApplicationMutation.mutate(application.id)}
                variant="outline"
                className="w-full"
                style={{ borderColor: '#ff6a2d', color: '#ff6a2d' }}
                disabled={revertApplicationMutation.isPending}
              >
                Reverter Decisão
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ 
            background: 'linear-gradient(135deg, #a6539f 0%, #e833ae 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Seleção de Candidatos 🎯
          </h1>
          <p style={{ color: '#929292' }}>Avalie e selecione os Ecoantes para as campanhas</p>
        </div>

        <Card className="mb-6 shadow-lg bg-white/80" style={{ borderColor: '#096e4c20' }}>
          <CardHeader>
            <CardTitle style={{ color: '#3c0b14' }}>Filtrar por Tarefa</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas as tarefas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Tarefas</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-md bg-white" style={{ borderColor: '#f6c83540' }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#f6c83520' }}>
                  <Eye className="w-6 h-6" style={{ color: '#f6c835' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#929292' }}>Pendentes</p>
                  <p className="text-3xl font-bold" style={{ color: '#f6c835' }}>
                    {pendingApplications.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md bg-white" style={{ borderColor: '#00c33140' }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#00c33120' }}>
                  <CheckCircle className="w-6 h-6" style={{ color: '#00c331' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#929292' }}>Selecionados</p>
                  <p className="text-3xl font-bold" style={{ color: '#00c331' }}>
                    {selectedApplications.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md bg-white" style={{ borderColor: '#92929240' }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#92929220' }}>
                  <XCircle className="w-6 h-6" style={{ color: '#929292' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#929292' }}>Não Selecionados</p>
                  <p className="text-3xl font-bold" style={{ color: '#929292' }}>
                    {rejectedApplications.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pendentes" className="space-y-6">
          <TabsList className="p-1" style={{ background: '#a6539f10' }}>
            <TabsTrigger value="pendentes">
              Pendentes ({pendingApplications.length})
            </TabsTrigger>
            <TabsTrigger value="selecionados">
              Selecionados ({selectedApplications.length})
            </TabsTrigger>
            <TabsTrigger value="rejeitados">
              Não Selecionados ({rejectedApplications.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="space-y-4">
            {pendingApplications.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="w-16 h-16 mx-auto mb-4" style={{ color: '#929292' }} />
                <p className="text-lg" style={{ color: '#929292' }}>Nenhuma inscrição pendente</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {pendingApplications.map(renderApplicationCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="selecionados" className="space-y-4">
            {selectedApplications.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#929292' }} />
                <p className="text-lg" style={{ color: '#929292' }}>Nenhum candidato selecionado ainda</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {selectedApplications.map(renderApplicationCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejeitados" className="space-y-4">
            {rejectedApplications.length === 0 ? (
              <div className="text-center py-12">
                <XCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#929292' }} />
                <p className="text-lg" style={{ color: '#929292' }}>Nenhum candidato não selecionado</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {rejectedApplications.map(renderApplicationCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={{ color: '#3c0b14' }}>Não Selecionar Candidato</DialogTitle>
              <DialogDescription style={{ color: '#929292' }}>
                Adicione uma observação sobre o motivo da não seleção (opcional)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rejection-notes" style={{ color: '#3c0b14' }}>
                  Motivo da não seleção
                </Label>
                <Textarea
                  id="rejection-notes"
                  placeholder="Ex: Perfil não se enquadra no público-alvo da campanha..."
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  className="h-32"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectionNotes("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRejectSubmit}
                disabled={rejectCandidateMutation.isPending}
                style={{ background: '#ce161c', color: 'white' }}
              >
                {rejectCandidateMutation.isPending ? 'Processando...' : 'Confirmar Não Seleção'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={taskDetailsOpen} onOpenChange={setTaskDetailsOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Tarefa</DialogTitle>
            </DialogHeader>
            {taskDetails && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-xl mb-2">{taskDetails.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    {taskDetails.category === 'campanha' && (
                      <Badge className="border-2" style={{ background: '#f6c83520', color: '#f6c835', borderColor: '#f6c835' }}>
                        💰 Campanha Paga
                      </Badge>
                    )}
                    {taskDetails.campaign_type === 'resposta_rapida' && (
                      <Badge className="border-2 animate-pulse" style={{ background: '#ff6a2d20', color: '#ff6a2d', borderColor: '#ff6a2d' }}>
                        🔥 Resposta Rápida
                      </Badge>
                    )}
                    {taskDetails.category !== 'campanha' && (
                      <Badge style={{ background: '#096e4c20', color: '#096e4c' }}>
                        {taskDetails.points} pontos
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#3c0b14' }}>Descrição:</p>
                  <p className="text-sm" style={{ color: '#929292' }}>{taskDetails.description}</p>
                </div>

                {taskDetails.category === 'campanha' && taskDetails.content_types && taskDetails.content_types.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2" style={{ color: '#3c0b14' }}>Tipos de Conteúdo:</p>
                    <div className="flex flex-wrap gap-2">
                      {taskDetails.content_types.map((type, idx) => (
                        <Badge key={idx} variant="outline" style={{ borderColor: '#096e4c', color: '#096e4c' }}>
                          {type}
                        </Badge>
                      ))}
                      {taskDetails.content_type_other && (
                        <Badge variant="outline" style={{ borderColor: '#096e4c', color: '#096e4c' }}>
                          Outro: {taskDetails.content_type_other}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {taskDetails.requirements && taskDetails.requirements.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2" style={{ color: '#3c0b14' }}>Requisitos:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {taskDetails.requirements.map((req, idx) => (
                        <li key={idx} className="text-sm" style={{ color: '#929292' }}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {taskDetails.profile_requirements && (
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#3c0b14' }}>Requisitos Desejáveis de Perfil:</p>
                    <p className="text-sm" style={{ color: '#929292' }}>{taskDetails.profile_requirements}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {taskDetails.category === 'campanha' && taskDetails.payment_value && (
                    <div className="p-3 rounded-lg" style={{ background: '#f6c83510' }}>
                      <p className="text-xs" style={{ color: '#929292' }}>Valor por Influenciador</p>
                      <p className="text-sm font-bold" style={{ color: '#f6c835' }}>
                        R$ {taskDetails.payment_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {taskDetails.campaign_type && (
                    <div className="p-3 rounded-lg" style={{ background: '#a6539f10' }}>
                      <p className="text-xs" style={{ color: '#929292' }}>Tipo de Campanha</p>
                      <p className="text-sm font-medium" style={{ color: '#3c0b14' }}>
                        {taskDetails.campaign_type === 'comum' && 'Comum'}
                        {taskDetails.campaign_type === 'resposta_rapida' && 'Resposta Rápida'}
                        {taskDetails.campaign_type === 'slot_aberto' && 'Slot Aberto'}
                      </p>
                    </div>
                  )}
                  {taskDetails.deadline && (
                    <div className="p-3 rounded-lg" style={{ background: '#0077ad10' }}>
                      <p className="text-xs" style={{ color: '#929292' }}>Prazo para Entrega</p>
                      <p className="text-sm font-medium" style={{ color: '#3c0b14' }}>
                        {format(new Date(taskDetails.deadline), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                  {taskDetails.max_participants && (
                    <div className="p-3 rounded-lg" style={{ background: '#a6539f10' }}>
                      <p className="text-xs" style={{ color: '#929292' }}>Vagas</p>
                      <p className="text-sm font-medium" style={{ color: '#3c0b14' }}>
                        {taskDetails.current_participants || 0} / {taskDetails.max_participants}
                      </p>
                    </div>
                  )}
                  {taskDetails.min_followers && (
                    <div className="p-3 rounded-lg" style={{ background: '#e833ae10' }}>
                      <p className="text-xs" style={{ color: '#929292' }}>Mínimo Seguidores</p>
                      <p className="text-sm font-medium" style={{ color: '#3c0b14' }}>
                        {taskDetails.min_followers.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                  {taskDetails.target_audience && (
                    <div className="p-3 rounded-lg" style={{ background: '#096e4c10' }}>
                      <p className="text-xs" style={{ color: '#929292' }}>Público-Alvo</p>
                      <p className="text-sm font-medium" style={{ color: '#3c0b14' }}>
                        {taskDetails.target_audience}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}