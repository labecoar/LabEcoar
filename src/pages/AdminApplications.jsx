// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingSubmissions, useApproveSubmission, useRejectSubmission } from "@/hooks/useSubmissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, User, Calendar, Users, Star, Instagram, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminApplications() {
  const [activeTab, setActiveTab] = useState('pending');
  const { profile } = useAuth();

  const { data: pendingSubmissions = [], isLoading } = usePendingSubmissions();
  const approveSubmission = useApproveSubmission();
  const rejectSubmission = useRejectSubmission();

  const pendingApplications = useMemo(
    () => pendingSubmissions.filter((submission) => ['application_pending', 'pending'].includes(submission.status)),
    [pendingSubmissions]
  );

  const selectedApplications = useMemo(
    () => pendingSubmissions.filter((submission) => submission.status === 'application_approved'),
    [pendingSubmissions]
  );

  const rejectedApplications = useMemo(
    () => pendingSubmissions.filter((submission) => submission.status === 'application_rejected'),
    [pendingSubmissions]
  );

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
      await approveSubmission.mutateAsync({
        submissionId: submission.id,
        pointsAwarded: submission.task?.points || 0,
      });

      alert('Inscrição aprovada! O usuário já pode enviar a prova.');
    } catch (error) {
      console.error('Erro ao aprovar inscrição:', error);
      alert('Erro ao aprovar inscrição.');
    }
  };

  const handleReject = async (submission) => {
    const reason = window.prompt('Motivo da rejeição da inscrição:');
    if (!reason || !reason.trim()) {
      alert('Informe um motivo de rejeição para continuar.');
      return;
    }

    try {
      await rejectSubmission.mutateAsync({
        submissionId: submission.id,
        rejectionReason: reason.trim(),
      });

      alert('Inscrição rejeitada.');
    } catch (error) {
      console.error('Erro ao rejeitar inscrição:', error);
      alert('Erro ao rejeitar inscrição.');
    }
  };

  const tabData = {
    pending: { label: 'Pendentes', items: pendingApplications },
    selected: { label: 'Selecionados', items: selectedApplications },
    rejected: { label: 'Não Selecionados', items: rejectedApplications },
  };

  const visibleItems = tabData[activeTab].items;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando candidatos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Seleção de Candidatos</h1>
          <p className="text-gray-600">Aprove ou rejeite inscrições nas tarefas antes do envio de provas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-yellow-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-xl">
                  <Eye className="w-5 h-5 text-yellow-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pendentes</p>
                  <p className="text-4xl font-bold text-yellow-600">{pendingApplications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Selecionados</p>
                  <p className="text-4xl font-bold text-emerald-600">{selectedApplications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 rounded-xl">
                  <XCircle className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Não Selecionados</p>
                  <p className="text-4xl font-bold text-gray-500">{rejectedApplications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 mb-6">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === 'pending' ? 'bg-white text-[#3c0b14] shadow-sm' : 'text-gray-600'}`}
            onClick={() => setActiveTab('pending')}
          >
            Pendentes ({pendingApplications.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === 'selected' ? 'bg-white text-[#3c0b14] shadow-sm' : 'text-gray-600'}`}
            onClick={() => setActiveTab('selected')}
          >
            Selecionados ({selectedApplications.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === 'rejected' ? 'bg-white text-[#3c0b14] shadow-sm' : 'text-gray-600'}`}
            onClick={() => setActiveTab('rejected')}
          >
            Não Selecionados ({rejectedApplications.length})
          </button>
        </div>

        {visibleItems.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum candidato nesta aba</h3>
              <p className="text-gray-500">Quando houver registros, eles aparecerão aqui.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 max-w-2xl">
            {visibleItems.map((submission) => (
              <Card key={submission.id} className="border border-emerald-100 shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-2xl font-semibold text-[#3c0b14] leading-tight">
                        {submission.profile?.display_name || submission.profile?.full_name || 'Usuário'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1 inline-flex items-center gap-1">
                        Tarefa: {submission.task?.title || 'Tarefa'}
                      </p>
                    </div>
                    <FileTextBadge points={submission.task?.points || 0} />
                  </div>

                  <div className="mb-3">
                    {activeTab === 'pending' && (
                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 border">Aguardando Análise</Badge>
                    )}
                    {activeTab === 'selected' && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 border">Selecionado</Badge>
                    )}
                    {activeTab === 'rejected' && (
                      <Badge className="bg-gray-100 text-gray-700 border-gray-300 border">Não Selecionado</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    <div className="rounded-md px-3 py-2 bg-pink-50 text-pink-700 border border-pink-100">
                      <p className="text-xs">Instagram</p>
                      <p className="text-sm font-semibold">{submission.profile?.instagram_handle || '@semperfil'}</p>
                    </div>
                    <div className="rounded-md px-3 py-2 bg-blue-50 text-blue-700 border border-blue-100">
                      <p className="text-xs">Seguidores</p>
                      <p className="text-sm font-semibold">{Number(submission.profile?.followers_count || 0).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm font-semibold mb-1">Justificativa:</p>
                    <div className="rounded-md bg-gray-50 border border-gray-100 p-3 text-sm text-gray-700">
                      {submission.description || 'Sem justificativa informada.'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Inscrito em {format(new Date(submission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {submission.profile?.email || 'sem email'}
                    </span>
                  </div>

                  {activeTab === 'pending' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                      <Button
                        onClick={() => handleApprove(submission)}
                        disabled={approveSubmission.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Selecionar
                      </Button>
                      <Button
                        onClick={() => handleReject(submission)}
                        disabled={rejectSubmission.isPending}
                        variant="outline"
                        className="border-gray-300"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Não Selecionar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FileTextBadge({ points }) {
  return (
    <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 rounded-full border border-amber-200">
      <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
      <span className="font-bold text-amber-700">{points}</span>
    </div>
  );
}
