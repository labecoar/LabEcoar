import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SubmissionDetailsModal from "../components/mytasks/SubmissionDetailsModal";

export default function MySubmissions() {
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['my-submissions-all'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.TaskSubmission.filter({ user_email: user.email }, '-created_date');
    },
    initialData: []
  });

  const pendingSubmissions = submissions.filter((s) => s.status === 'pendente');
  const approvedSubmissions = submissions.filter((s) => s.status === 'aprovada');
  const rejectedSubmissions = submissions.filter((s) => s.status === 'rejeitada');

  const renderSubmissionCard = (submission) =>
  <Card
    key={submission.id}
    className="shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border-gray-200 bg-white"
    onClick={() => setSelectedSubmission(submission)}>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{submission.task_title}</CardTitle>
          {submission.status === 'pendente' &&
        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
              <Clock className="w-3 h-3 mr-1" />
              Pendente
            </Badge>
        }
          {submission.status === 'aprovada' &&
        <Badge className="bg-green-100 text-green-700 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Aprovada
            </Badge>
        }
          {submission.status === 'rejeitada' &&
        <Badge className="bg-red-100 text-red-700 border-red-200">
              <XCircle className="w-3 h-3 mr-1" />
              Rejeitada
            </Badge>
        }
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {submission.description &&
      <p className="text-sm text-gray-600 line-clamp-2">{submission.description}</p>
      }
        
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          {submission.points_earned &&
        <div>
              <p className="text-xs text-gray-500">Pontos</p>
              <p className="font-bold text-yellow-700">{submission.points_earned}</p>
            </div>
        }
          <div className="ml-auto">
            <p className="text-xs text-gray-500">Enviado em</p>
            <p className="text-sm font-medium">
              {format(new Date(submission.created_date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        {submission.rejection_reason &&
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-medium text-red-700 mb-1">Motivo da rejeição:</p>
            <p className="text-sm text-red-600">{submission.rejection_reason}</p>
          </div>
      }
      </CardContent>
    </Card>;


  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-500">Carregando...</p>
        </div>
      </div>);

  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Minhas Submissões

          </h1>
          <p className="text-gray-600 mt-2">Acompanhe o status das suas tarefas no trimestre</p>
        </div>

        <Tabs defaultValue="pendente" className="space-y-6">
          <TabsList className="bg-emerald-50 p-1">
            <TabsTrigger value="pendente" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white">
              Pendentes ({pendingSubmissions.length})
            </TabsTrigger>
            <TabsTrigger value="aprovada" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              Aprovadas ({approvedSubmissions.length})
            </TabsTrigger>
            <TabsTrigger value="rejeitada" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              Rejeitadas ({rejectedSubmissions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendente" className="space-y-4">
            {pendingSubmissions.length === 0 ?
            <div className="text-center py-12">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma tarefa pendente</p>
              </div> :

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingSubmissions.map(renderSubmissionCard)}
              </div>
            }
          </TabsContent>

          <TabsContent value="aprovada" className="space-y-4">
            {approvedSubmissions.length === 0 ?
            <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma tarefa aprovada ainda</p>
              </div> :

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {approvedSubmissions.map(renderSubmissionCard)}
              </div>
            }
          </TabsContent>

          <TabsContent value="rejeitada" className="space-y-4">
            {rejectedSubmissions.length === 0 ?
            <div className="text-center py-12">
                <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhuma tarefa rejeitada</p>
              </div> :

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rejectedSubmissions.map(renderSubmissionCard)}
              </div>
            }
          </TabsContent>
        </Tabs>

        {selectedSubmission &&
        <SubmissionDetailsModal
          submission={selectedSubmission}
          isOpen={!!selectedSubmission}
          onClose={() => setSelectedSubmission(null)} />

        }
      </div>
    </div>);

}