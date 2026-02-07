import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FileText, MessageSquare, Clock, Archive, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminContentManagement() {
  const queryClient = useQueryClient();
  
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'campanha',
    folhetim_type: '',
    content_types: [],
    content_type_other: '',
    points: 100,
    payment_value: null,
    deadline: '',
    expires_in_value: 1,
    expires_in_unit: 'days',
    status: 'ativa',
    proof_required: 'link',
    max_participants: null,
    current_participants: 0,
    is_urgent: false,
    campaign_type: 'comum',
    requires_application: false,
    profile_requirements: '',
    min_followers: null,
    target_audience: ''
  });

  const isCampaign = taskForm.category === 'campanha';
  const totalCampaignCost = isCampaign && taskForm.payment_value && taskForm.max_participants 
    ? taskForm.payment_value * taskForm.max_participants 
    : null;

  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['all-tasks-admin'],
    queryFn: () => base44.entities.Task.list('-created_date'),
    initialData: []
  });

  const calculateExpiresAt = (value, unit) => {
    const now = new Date();
    switch (unit) {
      case 'minutes':
        return new Date(now.getTime() + value * 60 * 1000).toISOString();
      case 'hours':
        return new Date(now.getTime() + value * 60 * 60 * 1000).toISOString();
      case 'days':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const isTaskExpired = (task) => {
    if (!task.expires_at) return false;
    return new Date(task.expires_at) < new Date();
  };

  const activeTasks = tasks.filter(t => !isTaskExpired(t) && t.status === 'ativa');
  const expiredTasks = tasks.filter(t => isTaskExpired(t) || t.status === 'expirada' || t.status === 'concluida');

  const [forumForm, setForumForm] = useState({
    title: '',
    description: '',
    category: 'geral'
  });

  const [editingTask, setEditingTask] = useState(null);

  const createTaskMutation = useMutation({
    mutationFn: (data) => {
      const expires_at = calculateExpiresAt(data.expires_in_value, data.expires_in_unit);
      const { expires_in_value, expires_in_unit, ...taskData } = data;
      const is_urgent = data.campaign_type === 'resposta_rapida';
      return base44.entities.Task.create({ ...taskData, expires_at, is_urgent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks-admin'] });
      alert('✅ Tarefa criada com sucesso!');
      setTaskForm({
        title: '',
        description: '',
        category: 'campanha',
        folhetim_type: '',
        content_types: [],
        content_type_other: '',
        points: 100,
        payment_value: null,
        deadline: '',
        expires_in_value: 1,
        expires_in_unit: 'days',
        status: 'ativa',
        proof_required: 'link',
        max_participants: null,
        current_participants: 0,
        is_urgent: false,
        campaign_type: 'comum',
        requires_application: false,
        profile_requirements: '',
        min_followers: null,
        target_audience: ''
      });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const expires_at = calculateExpiresAt(data.expires_in_value, data.expires_in_unit);
      const { expires_in_value, expires_in_unit, ...taskData } = data;
      const is_urgent = data.campaign_type === 'resposta_rapida';
      return base44.entities.Task.update(id, { ...taskData, expires_at, is_urgent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks-admin'] });
      alert('✅ Tarefa atualizada com sucesso!');
      setEditingTask(null);
      setTaskForm({
        title: '',
        description: '',
        category: 'campanha',
        folhetim_type: '',
        content_types: [],
        content_type_other: '',
        points: 100,
        payment_value: null,
        deadline: '',
        expires_in_value: 1,
        expires_in_unit: 'days',
        status: 'ativa',
        proof_required: 'link',
        max_participants: null,
        current_participants: 0,
        is_urgent: false,
        campaign_type: 'comum',
        requires_application: false,
        profile_requirements: '',
        min_followers: null,
        target_audience: ''
      });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => base44.entities.Task.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks-admin'] });
      alert('✅ Tarefa excluída com sucesso!');
    }
  });

  const createForumTopicMutation = useMutation({
    mutationFn: (data) => base44.entities.ForumTopic.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      alert('✅ Tópico criado com sucesso!');
      setForumForm({
        title: '',
        description: '',
        category: 'geral'
      });
    }
  });

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

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: taskForm });
    } else {
      createTaskMutation.mutate(taskForm);
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      category: task.category,
      folhetim_type: task.folhetim_type || '',
      content_types: task.content_types || [],
      content_type_other: task.content_type_other || '',
      points: task.points,
      payment_value: task.payment_value || null,
      deadline: task.deadline || '',
      expires_in_value: 1,
      expires_in_unit: 'days',
      status: task.status,
      proof_required: task.proof_required,
      max_participants: task.max_participants,
      current_participants: task.current_participants,
      is_urgent: task.is_urgent,
      campaign_type: task.campaign_type,
      requires_application: task.requires_application,
      profile_requirements: task.profile_requirements || '',
      min_followers: task.min_followers,
      target_audience: task.target_audience || ''
    });
  };

  const handleDeleteTask = (taskId) => {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  const handleCreateForumTopic = (e) => {
    e.preventDefault();
    createForumTopicMutation.mutate({
      ...forumForm,
      author_email: currentUser.email,
      author_name: currentUser.display_name || currentUser.full_name || 'Admin',
      last_activity: new Date().toISOString()
    });
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ 
            background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Gerenciamento de Conteúdo 📋
          </h1>
          <p style={{ color: '#929292' }}>Crie tarefas e tópicos do fórum para os Ecoantes</p>
        </div>

        <Tabs defaultValue="tasks" className="space-y-6">
          <TabsList className="p-1" style={{ background: '#096e4c10' }}>
            <TabsTrigger value="tasks">
              <FileText className="w-4 h-4 mr-2" />
              Criar Tarefa
            </TabsTrigger>
            <TabsTrigger value="active">
              <Clock className="w-4 h-4 mr-2" />
              Ativas ({activeTasks.length})
            </TabsTrigger>
            <TabsTrigger value="expired">
              <Archive className="w-4 h-4 mr-2" />
              Concluídas ({expiredTasks.length})
            </TabsTrigger>
            <TabsTrigger value="forum">
              <MessageSquare className="w-4 h-4 mr-2" />
              Criar Tópico Fórum
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card className="shadow-lg bg-white" style={{ borderColor: '#096e4c20' }}>
              <CardHeader style={{ borderBottom: '1px solid #096e4c20' }}>
                <CardTitle className="flex items-center gap-2" style={{ color: '#3c0b14' }}>
                  <PlusCircle className="w-5 h-5" style={{ color: '#096e4c' }} />
                  {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateTask} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Título *</Label>
                      <Input
                        id="title"
                        required
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        placeholder="Ex: Post sobre Dia da Terra"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria *</Label>
                      <Select value={taskForm.category} onValueChange={(value) => setTaskForm({ ...taskForm, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="campanha">💰 Campanha (Paga)</SelectItem>
                          <SelectItem value="oficina">📚 Oficina (50 pts)</SelectItem>
                          <SelectItem value="folhetim">📖 Folhetim (75 pts)</SelectItem>
                          <SelectItem value="compartilhar_ecoante">📢 Compartilhar Ecoante (150 pts)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {taskForm.category === 'folhetim' && (
                      <div className="space-y-2">
                        <Label htmlFor="folhetim_type">Tipo de Folhetim *</Label>
                        <Select value={taskForm.folhetim_type} onValueChange={(value) => setTaskForm({ ...taskForm, folhetim_type: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="compartilhar">Compartilhar</SelectItem>
                            <SelectItem value="criar">Criar Conteúdo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Textarea
                      id="description"
                      required
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      placeholder="Descreva a tarefa em detalhes..."
                      className="h-32"
                    />
                  </div>

                  {isCampaign && (
                    <div className="space-y-3 p-4 rounded-lg" style={{ background: '#096e4c10' }}>
                      <Label className="text-base font-semibold" style={{ color: '#096e4c' }}>
                        Tipo de Conteúdo a Produzir
                      </Label>
                      <p className="text-sm" style={{ color: '#929292' }}>Selecione um ou mais formatos</p>
                      <div className="space-y-2">
                        {['Reels', 'Vídeo no TikTok', 'Stories', 'Carrossel'].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`content-${type}`}
                              checked={taskForm.content_types.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setTaskForm({ ...taskForm, content_types: [...taskForm.content_types, type] });
                                } else {
                                  setTaskForm({ ...taskForm, content_types: taskForm.content_types.filter(t => t !== type) });
                                }
                              }}
                            />
                            <Label htmlFor={`content-${type}`} className="cursor-pointer font-normal">
                              {type}
                            </Label>
                          </div>
                        ))}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="content-outro"
                            checked={taskForm.content_types.includes('Outro')}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTaskForm({ ...taskForm, content_types: [...taskForm.content_types, 'Outro'] });
                              } else {
                                setTaskForm({ 
                                  ...taskForm, 
                                  content_types: taskForm.content_types.filter(t => t !== 'Outro'),
                                  content_type_other: ''
                                });
                              }
                            }}
                          />
                          <Label htmlFor="content-outro" className="cursor-pointer font-normal">
                            Outro
                          </Label>
                        </div>
                        {taskForm.content_types.includes('Outro') && (
                          <Input
                            placeholder="Especifique o tipo de conteúdo..."
                            value={taskForm.content_type_other}
                            onChange={(e) => setTaskForm({ ...taskForm, content_type_other: e.target.value })}
                            className="ml-6"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    {!isCampaign ? (
                      <div className="space-y-2">
                        <Label htmlFor="points">Pontos *</Label>
                        <Input
                          id="points"
                          type="number"
                          required={!isCampaign}
                          value={taskForm.points}
                          onChange={(e) => setTaskForm({ ...taskForm, points: parseInt(e.target.value) })}
                        />
                        <p className="text-xs" style={{ color: '#929292' }}>
                          Para oficinas, folhetim e sidequests
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="payment_value">Valor Oferecido (R$) *</Label>
                        <Input
                          id="payment_value"
                          type="number"
                          required={isCampaign}
                          value={taskForm.payment_value || ''}
                          onChange={(e) => setTaskForm({ ...taskForm, payment_value: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="Ex: 10000"
                        />
                        <p className="text-xs" style={{ color: '#929292' }}>
                          Valor por influenciador
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="proof_required">Tipo de Prova *</Label>
                      <Select value={taskForm.proof_required} onValueChange={(value) => setTaskForm({ ...taskForm, proof_required: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="link">Link</SelectItem>
                          <SelectItem value="screenshot">Screenshot</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                          <SelectItem value="insights">Insights</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: '#ff6a2d' }} />
                      Tempo de Expiração *
                    </Label>
                    <p className="text-xs" style={{ color: '#929292' }}>Após esse tempo, a tarefa não ficará mais disponível para novos participantes</p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={taskForm.expires_in_value}
                        onChange={(e) => setTaskForm({ ...taskForm, expires_in_value: parseInt(e.target.value) || 1 })}
                        className="w-24"
                      />
                      <Select value={taskForm.expires_in_unit} onValueChange={(value) => setTaskForm({ ...taskForm, expires_in_unit: value })}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutos</SelectItem>
                          <SelectItem value="hours">Horas</SelectItem>
                          <SelectItem value="days">Dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deadline">Prazo para Entrega (opcional)</Label>
                    <p className="text-xs" style={{ color: '#929292' }}>Data limite para envio da prova após aceitar a tarefa</p>
                    <Input
                      id="deadline"
                      type="date"
                      value={taskForm.deadline}
                      onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_participants">
                        Máximo de Participantes {isCampaign && '*'}
                      </Label>
                      <Input
                        id="max_participants"
                        type="number"
                        required={isCampaign}
                        value={taskForm.max_participants || ''}
                        onChange={(e) => setTaskForm({ ...taskForm, max_participants: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder={isCampaign ? "Número de vagas" : "Deixe vazio para ilimitado"}
                      />
                      {isCampaign && totalCampaignCost && (
                        <p className="text-sm font-bold" style={{ color: '#096e4c' }}>
                          Custo total: R$ {totalCampaignCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="campaign_type">Tipo de Campanha</Label>
                      <Select value={taskForm.campaign_type} onValueChange={(value) => setTaskForm({ ...taskForm, campaign_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comum">Comum</SelectItem>
                          <SelectItem value="resposta_rapida">Resposta Rápida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requires_application"
                      checked={taskForm.requires_application}
                      onCheckedChange={(checked) => setTaskForm({ ...taskForm, requires_application: checked })}
                    />
                    <Label htmlFor="requires_application" className="cursor-pointer">Requer inscrição</Label>
                  </div>

                  {taskForm.requires_application && (
                    <div className="space-y-4 p-4 rounded-lg" style={{ background: '#0077ad10' }}>
                      <h3 className="font-semibold" style={{ color: '#0077ad' }}>Requisitos de Inscrição</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="profile_requirements">Requisitos Desejáveis de Perfil</Label>
                        <Textarea
                          id="profile_requirements"
                          value={taskForm.profile_requirements}
                          onChange={(e) => setTaskForm({ ...taskForm, profile_requirements: e.target.value })}
                          placeholder="Ex: Experiência com conteúdo sustentável..."
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="min_followers">Mínimo de Seguidores</Label>
                          <Input
                            id="min_followers"
                            type="number"
                            value={taskForm.min_followers || ''}
                            onChange={(e) => setTaskForm({ ...taskForm, min_followers: e.target.value ? parseInt(e.target.value) : null })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="target_audience">Público-Alvo</Label>
                          <Input
                            id="target_audience"
                            value={taskForm.target_audience}
                            onChange={(e) => setTaskForm({ ...taskForm, target_audience: e.target.value })}
                            placeholder="Ex: Jovens interessados em sustentabilidade"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {editingTask && (
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingTask(null);
                          setTaskForm({
                            title: '',
                            description: '',
                            category: 'campanha',
                            content_types: [],
                            content_type_other: '',
                            points: 100,
                            payment_value: null,
                            deadline: '',
                            expires_in_value: 1,
                            expires_in_unit: 'days',
                            status: 'ativa',
                            proof_required: 'link',
                            max_participants: null,
                            current_participants: 0,
                            is_urgent: false,
                            campaign_type: 'comum',
                            requires_application: false,
                            profile_requirements: '',
                            min_followers: null,
                            target_audience: ''
                          });
                        }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button 
                      type="submit" 
                      className="text-white"
                      style={{ 
                        background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)',
                        flex: editingTask ? '1' : 'auto',
                        width: editingTask ? 'auto' : '100%'
                      }}
                      disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                    >
                      {editingTask 
                        ? (updateTaskMutation.isPending ? 'Salvando...' : 'Salvar Alterações')
                        : (createTaskMutation.isPending ? 'Criando...' : 'Criar Tarefa')
                      }
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card className="shadow-lg bg-white" style={{ borderColor: '#096e4c20' }}>
              <CardHeader style={{ borderBottom: '1px solid #096e4c20' }}>
                <CardTitle className="flex items-center gap-2" style={{ color: '#3c0b14' }}>
                  <Clock className="w-5 h-5" style={{ color: '#00c331' }} />
                  Tarefas Ativas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {activeTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 mx-auto mb-3" style={{ color: '#929292' }} />
                    <p style={{ color: '#929292' }}>Nenhuma tarefa ativa no momento</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeTasks.map((task) => {
                      const expiresAt = task.expires_at ? new Date(task.expires_at) : null;
                      const timeLeft = expiresAt ? expiresAt - new Date() : null;
                      const hoursLeft = timeLeft ? Math.floor(timeLeft / (1000 * 60 * 60)) : null;
                      const minutesLeft = timeLeft ? Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)) : null;
                      
                      return (
                        <div key={task.id} className="p-4 rounded-lg border" style={{ borderColor: '#096e4c30' }}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold" style={{ color: '#3c0b14' }}>{task.title}</h3>
                              <p className="text-sm mt-1 line-clamp-2" style={{ color: '#929292' }}>{task.description}</p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                <Badge style={{ background: '#096e4c20', color: '#096e4c' }}>
                                  {task.points} pts
                                </Badge>
                                <Badge style={{ background: '#0077ad20', color: '#0077ad' }}>
                                  {task.category?.replace(/_/g, ' ')}
                                </Badge>
                                {task.is_urgent && (
                                  <Badge style={{ background: '#ff6a2d20', color: '#ff6a2d' }}>
                                    🔥 Urgente
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-2 mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditTask(task)}
                                  className="text-xs"
                                  style={{ borderColor: '#0077ad', color: '#0077ad' }}
                                >
                                  <Pencil className="w-3 h-3 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="text-xs"
                                  style={{ borderColor: '#ce161c', color: '#ce161c' }}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Excluir
                                </Button>
                              </div>
                            </div>
                            <div className="text-right">
                              {expiresAt && (
                                <div className="px-3 py-2 rounded-lg" style={{ background: hoursLeft < 2 ? '#ce161c20' : '#ff6a2d20' }}>
                                  <p className="text-xs" style={{ color: '#929292' }}>Expira em</p>
                                  <p className="font-bold text-sm" style={{ color: hoursLeft < 2 ? '#ce161c' : '#ff6a2d' }}>
                                    {hoursLeft > 24 ? `${Math.floor(hoursLeft / 24)}d ${hoursLeft % 24}h` : `${hoursLeft}h ${minutesLeft}m`}
                                  </p>
                                  <p className="text-xs mt-1" style={{ color: '#929292' }}>
                                    {format(expiresAt, "dd/MM HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expired">
            <Card className="shadow-lg bg-white" style={{ borderColor: '#096e4c20' }}>
              <CardHeader style={{ borderBottom: '1px solid #096e4c20' }}>
                <CardTitle className="flex items-center gap-2" style={{ color: '#3c0b14' }}>
                  <Archive className="w-5 h-5" style={{ color: '#929292' }} />
                  Tarefas Concluídas / Expiradas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {expiredTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <Archive className="w-12 h-12 mx-auto mb-3" style={{ color: '#929292' }} />
                    <p style={{ color: '#929292' }}>Nenhuma tarefa concluída ou expirada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expiredTasks.map((task) => {
                      const expiresAt = task.expires_at ? new Date(task.expires_at) : null;
                      
                      return (
                        <div key={task.id} className="p-4 rounded-lg border opacity-70" style={{ borderColor: '#92929230', background: '#f5f5f5' }}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold" style={{ color: '#3c0b14' }}>{task.title}</h3>
                              <p className="text-sm mt-1 line-clamp-2" style={{ color: '#929292' }}>{task.description}</p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                <Badge style={{ background: '#92929220', color: '#929292' }}>
                                  {task.points} pts
                                </Badge>
                                <Badge style={{ background: '#92929220', color: '#929292' }}>
                                  {task.category?.replace(/_/g, ' ')}
                                </Badge>
                                <Badge style={{ background: '#92929220', color: '#929292' }}>
                                  {task.status === 'concluida' ? '✅ Concluída' : '⏰ Expirada'}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              {expiresAt && (
                                <div className="px-3 py-2 rounded-lg" style={{ background: '#92929210' }}>
                                  <p className="text-xs" style={{ color: '#929292' }}>Expirou em</p>
                                  <p className="font-medium text-sm" style={{ color: '#929292' }}>
                                    {format(expiresAt, "dd/MM/yyyy", { locale: ptBR })}
                                  </p>
                                  <p className="text-xs" style={{ color: '#929292' }}>
                                    {format(expiresAt, "HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forum">
            <Card className="shadow-lg bg-white" style={{ borderColor: '#096e4c20' }}>
              <CardHeader style={{ borderBottom: '1px solid #096e4c20' }}>
                <CardTitle className="flex items-center gap-2" style={{ color: '#3c0b14' }}>
                  <PlusCircle className="w-5 h-5" style={{ color: '#096e4c' }} />
                  Novo Tópico do Fórum
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateForumTopic} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="forum-title">Título *</Label>
                    <Input
                      id="forum-title"
                      required
                      value={forumForm.title}
                      onChange={(e) => setForumForm({ ...forumForm, title: e.target.value })}
                      placeholder="Ex: Dicas para engajamento sustentável"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="forum-description">Descrição *</Label>
                    <Textarea
                      id="forum-description"
                      required
                      value={forumForm.description}
                      onChange={(e) => setForumForm({ ...forumForm, description: e.target.value })}
                      placeholder="Descreva o tópico..."
                      className="h-32"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="forum-category">Categoria *</Label>
                    <Select value={forumForm.category} onValueChange={(value) => setForumForm({ ...forumForm, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dicas">Dicas</SelectItem>
                        <SelectItem value="duvidas">Dúvidas</SelectItem>
                        <SelectItem value="conquistas">Conquistas</SelectItem>
                        <SelectItem value="campanhas">Campanhas</SelectItem>
                        <SelectItem value="geral">Geral</SelectItem>
                        <SelectItem value="sugestoes">Sugestões</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full text-white"
                    style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                    disabled={createForumTopicMutation.isPending}
                  >
                    {createForumTopicMutation.isPending ? 'Criando...' : 'Criar Tópico'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}