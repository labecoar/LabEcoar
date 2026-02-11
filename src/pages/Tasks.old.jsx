import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target, Users, Calendar, Clock, CheckCircle2,
  Star, Megaphone, Zap, BookOpen, Share2, Edit } from
"lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskDetailsModal from "../components/tasks/TaskDetailsModal";

const CATEGORY_ICONS = {
  campanha: Megaphone,
  resposta_rapida: Zap,
  oficina: BookOpen,
  folhetim: Share2,
  compartilhar_ecoante: Users
};

const CATEGORY_COLORS = {
  campanha: "bg-green-100 text-green-700 border-green-200",
  resposta_rapida: "bg-orange-100 text-orange-700 border-orange-200",
  oficina: "bg-purple-100 text-purple-700 border-purple-200",
  folhetim: "bg-blue-100 text-blue-700 border-blue-200",
  compartilhar_ecoante: "bg-pink-100 text-pink-700 border-pink-200"
};

const CATEGORY_NAMES = {
  campanha: "Campanha",
  resposta_rapida: "Resposta Rápida",
  oficina: "Oficina",
  folhetim: "Folhetim",
  compartilhar_ecoante: "Compartilhar Ecoante"
};

export default function Tasks() {
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [selectedTask, setSelectedTask] = useState(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const { data: allTasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.filter({ status: 'ativa' }, '-created_date'),
    initialData: []
  });

  // Filtra tarefas que não expiraram e respeita o mínimo de seguidores
  const tasks = allTasks.filter(task => {
    if (task.expires_at && new Date(task.expires_at) < new Date()) return false;
    
    // Filtro de seguidores para campanhas
    if (task.category === 'campanha' && task.min_followers) {
      const userFollowers = currentUser?.followers_count || 0;
      if (userFollowers < task.min_followers) return false;
    }
    
    return true;
  });

  const { data: mySubmissions } = useQuery({
    queryKey: ['my-submissions-check'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.TaskSubmission.filter({ user_email: user.email });
    },
    initialData: []
  });

  const { data: myApplications } = useQuery({
    queryKey: ['my-applications'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.TaskApplication.filter({ user_email: user.email });
    },
    initialData: []
  });

  // Tarefas aprovadas para realizar (selecionado mas ainda não enviou prova)
  const approvedApplications = myApplications.filter(app => app.status === 'selecionado');
  const approvedTaskIds = approvedApplications.map(app => app.task_id);
  const tasksToComplete = tasks.filter(task => approvedTaskIds.includes(task.id));

  const filteredTasks = selectedCategory === "aprovadas" ?
  tasksToComplete :
  selectedCategory === "todas" ?
  tasks :
  tasks.filter((task) => task.category === selectedCategory);

  const isTaskClaimed = (taskId) => {
    return mySubmissions.some((sub) => sub.task_id === taskId && sub.status === 'pendente');
  };

  const isTaskCompleted = (taskId) => {
    return mySubmissions.some((sub) => sub.task_id === taskId && sub.status === 'aprovada');
  };

  const isTaskApprovedForMe = (taskId) => {
    return approvedTaskIds.includes(taskId);
  };

  const hasApplicationPending = (taskId) => {
    return myApplications.some((app) => app.task_id === taskId && app.status === 'pendente');
  };

  const hasApplicationRejected = (taskId) => {
    return myApplications.some((app) => app.task_id === taskId && app.status === 'rejeitado');
  };

  const hasSubmissionRejected = (taskId) => {
    return mySubmissions.some((sub) => sub.task_id === taskId && sub.status === 'rejeitada');
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Tarefas Disponíveis

          </h1>
          <p className="text-gray-600 mt-2">Acumule pontos e avance nas categorias do Lab Ecoar</p>
        </div>

        <Card className="mb-6 shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Filtrar por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="flex flex-wrap h-auto gap-2 bg-emerald-50 p-2">
                <TabsTrigger value="todas" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  Todas
                </TabsTrigger>
                <TabsTrigger value="aprovadas" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Aprovadas ({tasksToComplete.length})
                </TabsTrigger>
                <TabsTrigger value="campanha" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
                  Campanhas
                </TabsTrigger>
                <TabsTrigger value="oficina" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  Oficinas (50 pts)
                </TabsTrigger>
                <TabsTrigger value="folhetim" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Folhetim (75 pts)
                </TabsTrigger>
                <TabsTrigger value="compartilhar_ecoante" className="data-[state=active]:bg-pink-600 data-[state=active]:text-white">
                  Compartilhar Ecoante (150 pts)
                </TabsTrigger>
                </TabsList>
                </Tabs>
                </CardContent>
                </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => {
            const CategoryIcon = CATEGORY_ICONS[task.category] || Target;
            const claimed = isTaskClaimed(task.id);
            const completed = isTaskCompleted(task.id);
            const approvedForMe = isTaskApprovedForMe(task.id);
            const applicationPending = hasApplicationPending(task.id);
            const applicationRejected = hasApplicationRejected(task.id);
            const submissionRejected = hasSubmissionRejected(task.id);
            const isFull = task.max_participants && task.current_participants >= task.max_participants;
            const isCampaign = task.category === 'campanha';

            return (
              <Card
                key={task.id}
                className="shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer bg-white/80 backdrop-blur-sm overflow-hidden group"
                style={{ borderColor: isCampaign ? '#f6c835' : '#096e4c40' }}
                onClick={() => setSelectedTask(task)}>

                <div className={`h-2 ${isCampaign ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={`${CATEGORY_COLORS[task.category]} border font-medium`}>
                      <CategoryIcon className="w-3 h-3 mr-1" />
                      {CATEGORY_NAMES[task.category]}
                      {task.category === 'folhetim' && task.folhetim_type && ` - ${task.folhetim_type === 'compartilhar' ? 'Compartilhar' : 'Criar Conteúdo'}`}
                    </Badge>
                    {task.is_urgent &&
                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 animate-pulse">
                        🔥 Urgente
                      </Badge>
                    }
                    {completed &&
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                        Concluída ✓
                      </Badge>
                    }
                    {approvedForMe && !completed && !claimed && !applicationRejected && !submissionRejected &&
                    <Badge className="bg-green-100 text-green-700 border-green-200 animate-pulse">
                        ✅ Candidatura aceita - Realizar tarefa
                      </Badge>
                    }
                    {claimed && !completed &&
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                        Em Andamento
                      </Badge>
                    }
                    {applicationPending && !claimed && !completed &&
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse">
                        ⏳ Aguardando Aprovação
                      </Badge>
                    }
                    {applicationRejected && !claimed && !completed && !approvedForMe &&
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                        ❌ Ops, sua candidatura não foi aprovada
                      </Badge>
                    }
                    {submissionRejected && !claimed && !completed &&
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                        ❌ Ops, sua tarefa não foi aprovada
                      </Badge>
                    }
                  </div>
                  <CardTitle className="text-xl group-hover:text-emerald-600 transition-colors">
                    {task.title}
                  </CardTitle>


                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600 line-clamp-2">{task.description}</p>
                  
                  <div className="flex items-center gap-4 pt-3 border-t" style={{ borderColor: isCampaign ? '#f6c83530' : '#096e4c20' }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCampaign ? 'bg-yellow-100' : 'bg-green-100'}`}>
                        {isCampaign ? (
                          <span className="text-lg">💰</span>
                        ) : (
                          <Star className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{isCampaign ? 'Pagamento' : 'Pontos'}</p>
                        <p className="font-bold" style={{ color: isCampaign ? '#f6c835' : '#00c331' }}>
                          {isCampaign 
                            ? `R$ ${(task.payment_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : task.points
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {task.expires_at && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#ff6a2d' }}>
                      <Clock className="w-4 h-4" />
                      {(() => {
                        const timeLeft = new Date(task.expires_at) - new Date();
                        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                        if (hoursLeft > 24) {
                          return `Expira em ${Math.floor(hoursLeft / 24)}d ${hoursLeft % 24}h`;
                        }
                        return `Expira em ${hoursLeft}h ${minutesLeft}m`;
                      })()}
                    </div>
                  )}

                  {task.deadline &&
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      Prazo entrega: {format(new Date(task.deadline), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  }

                  {task.max_participants &&
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      {task.current_participants || 0} / {task.max_participants} Ecoantes
                    </div>
                  }
                </CardContent>
              </Card>);

          })}
        </div>

        {filteredTasks.length === 0 &&
        <div className="text-center py-12">
            <Target className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 text-lg">Nenhuma tarefa disponível nesta categoria</p>
          </div>
        }

        {selectedTask &&
        <TaskDetailsModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          isClaimed={isTaskClaimed(selectedTask.id)}
          isCompleted={isTaskCompleted(selectedTask.id)}
          isApproved={isTaskApprovedForMe(selectedTask.id)}
          isRejected={hasApplicationRejected(selectedTask.id)}
          isSubmissionRejected={hasSubmissionRejected(selectedTask.id)} />

        }
      </div>
    </div>);

}