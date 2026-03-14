// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/useTasks";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target, Users, Calendar, Clock, CheckCircle2,
  Star, Megaphone, Zap, BookOpen, Share2 
} from "lucide-react";
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

const normalizeSubmissionStatus = (status) => {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();

  if (normalized === 'pendente') return 'pending';
  if (normalized === 'aprovada' || normalized === 'aprovado' || normalized === 'concluida' || normalized === 'concluído') return 'approved';
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'rejected';
  if (normalized === 'em_analise' || normalized === 'em análise') return 'proof_pending';

  return normalized;
};

const getSubmissionTaskId = (submission) => {
  return submission?.task_id || submission?.task?.id || submission?.taskId || null;
}

const getDeadlineState = (expiresAtValue) => {
  if (!expiresAtValue) {
    return {
      expiresAt: null,
      isExpired: false,
      isCritical: false,
      isWarning: false,
      timeLabel: 'Sem data',
    };
  }

  const expiresAt = new Date(expiresAtValue);
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      expiresAt: null,
      isExpired: false,
      isCritical: false,
      isWarning: false,
      timeLabel: 'Data inválida',
    };
  }

  const diffMs = expiresAt.getTime() - Date.now();
  const isExpired = diffMs <= 0;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const threeDaysMs = 3 * oneDayMs;

  if (isExpired) {
    return {
      expiresAt,
      isExpired: true,
      isCritical: false,
      isWarning: false,
      timeLabel: 'Expirada',
    };
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return {
    expiresAt,
    isExpired: false,
    isCritical: diffMs <= oneDayMs,
    isWarning: diffMs > oneDayMs && diffMs <= threeDaysMs,
    timeLabel: days > 0 ? `${days}d ${hours}h` : `${hours}h`,
  };
};

export default function Tasks() {
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [selectedTask, setSelectedTask] = useState(null);
  const { user, profile } = useAuth();
  const { data: allTasks = [], isLoading } = useTasks();
  const { data: mySubmissions = [] } = useMySubmissions(user?.id);

  // Filtra tarefas que não expiraram e respeita o mínimo de seguidores
  const tasks = allTasks.filter(task => {
    if (task.expires_at && new Date(task.expires_at) < new Date()) return false;
    
    // Filtro de seguidores para campanhas
    if (task.category === 'campanha' && task.min_followers) {
      const userFollowers = profile?.followers_count || 0;
      if (userFollowers < task.min_followers) return false;
    }
    
    return true;
  });

  const filteredTasks = selectedCategory === "todas" ?
    tasks :
    tasks.filter((task) => task.category === selectedCategory);

  const getTaskSubmission = (taskId) => {
    return mySubmissions.find((sub) => String(getSubmissionTaskId(sub)) === String(taskId)) || null;
  };

  const isTaskClaimed = (taskId) => {
    const submission = getTaskSubmission(taskId);
    const status = normalizeSubmissionStatus(submission?.status);
    if (!submission) return false;
    return ['application_pending', 'application_approved', 'proof_pending', 'pending'].includes(status);
  };

  const isTaskApproved = (taskId) => {
    const submission = getTaskSubmission(taskId);
    return normalizeSubmissionStatus(submission?.status) === 'approved';
  };

  const isTaskRejected = (taskId) => {
    const submission = getTaskSubmission(taskId);
    return ['application_rejected', 'rejected'].includes(normalizeSubmissionStatus(submission?.status));
  };

  const TaskCard = ({ task }) => {
    const Icon = CATEGORY_ICONS[task.category] || Target;
    const colorClass = CATEGORY_COLORS[task.category] || "bg-gray-100 text-gray-700 border-gray-200";
    const submission = getTaskSubmission(task.id);
    const submissionStatus = normalizeSubmissionStatus(submission?.status);
    const claimed = isTaskClaimed(task.id);
    const approved = isTaskApproved(task.id);
    const rejected = isTaskRejected(task.id);
    const deadline = getDeadlineState(task.expires_at);

    return (
      <Card
        className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-gray-200 bg-white hover:border-emerald-300"
        onClick={() => setSelectedTask(task)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${colorClass} border`}>
                  <Icon className="w-3 h-3 mr-1" />
                  {CATEGORY_NAMES[task.category]}
                </Badge>
                {task.min_followers && (
                  <Badge variant="outline" className="text-xs">
                    {task.min_followers}+ seguidores
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg leading-tight">{task.title}</CardTitle>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 rounded-full border border-amber-200">
              <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
              <span className="font-bold text-amber-700">{task.points}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
            {task.description}
          </p>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-gray-500">
              {task.expires_at && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md border ${
                  deadline.isCritical
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : deadline.isWarning
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(task.expires_at), "dd MMM", { locale: ptBR })}</span>
                  <span className="font-semibold">({deadline.timeLabel})</span>
                </div>
              )}
              {task.max_participants && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{task.current_participants || 0}/{task.max_participants}</span>
                </div>
              )}
            </div>

            {approved ? (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Concluída
              </Badge>
            ) : submissionStatus === 'proof_pending' ? (
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                <Clock className="w-3 h-3 mr-1" />
                Prova em Análise
              </Badge>
            ) : submissionStatus === 'application_approved' ? (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                <Clock className="w-3 h-3 mr-1" />
                Aprovado p/ Fazer
              </Badge>
            ) : claimed ? (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                <Clock className="w-3 h-3 mr-1" />
                Inscrição em Análise
              </Badge>
            ) : rejected ? (
              <Badge className="bg-red-100 text-red-700 border-red-200">
                Rejeitada
              </Badge>
            ) : submission ? (
              <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                Em andamento
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                Disponível
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando tarefas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tarefas Disponíveis</h1>
          <p className="text-gray-600">Escolha uma tarefa e ganhe pontos!</p>
        </div>

        {/* Filtro de Categorias */}
        <div className="mb-8">
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full flex flex-wrap h-auto gap-2 bg-transparent">
              <TabsTrigger value="todas" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                Todas
              </TabsTrigger>
              <TabsTrigger value="campanha" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
                Campanhas
              </TabsTrigger>
              <TabsTrigger value="resposta_rapida" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                Respostas Rápidas
              </TabsTrigger>
              <TabsTrigger value="oficina" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                Oficinas
              </TabsTrigger>
              <TabsTrigger value="folhetim" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                Folhetins
              </TabsTrigger>
              <TabsTrigger value="compartilhar_ecoante" className="data-[state=active]:bg-pink-600 data-[state=active]:text-white">
                Compartilhar
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Lista de Tarefas */}
        {filteredTasks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Target className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Nenhuma tarefa disponível
              </h3>
              <p className="text-gray-500">
                {selectedCategory === "todas" 
                  ? "Não há tarefas disponíveis no momento."
                  : "Não há tarefas nesta categoria."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          isTaskClaimed={isTaskClaimed(selectedTask.id)}
          isTaskApproved={isTaskApproved(selectedTask.id)}
          currentSubmission={getTaskSubmission(selectedTask.id)}
        />
      )}
    </div>
  );
}
