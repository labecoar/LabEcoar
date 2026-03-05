import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingSubmissions, useApproveSubmission, useRejectSubmission } from "@/hooks/useSubmissions";
import { useAddPoints } from "@/hooks/useScores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle, XCircle, Download, ExternalLink,
  Clock, User, Calendar, FileText, Star
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

const STATUS_LABELS = {
  pending: 'Inscrição pendente',
  application_pending: 'Inscrição pendente',
  proof_pending: 'Prova pendente',
}

export default function AdminApproval() {
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const { profile } = useAuth();
  
  const { data: pendingSubmissions = [], isLoading } = usePendingSubmissions();
  const approveSubmission = useApproveSubmission();
  const rejectSubmission = useRejectSubmission();
  const addPoints = useAddPoints();
  const proofPendingSubmissions = pendingSubmissions.filter((submission) => submission.status === 'proof_pending');

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
      const pointsToAward = submission.task?.points || 0;
      
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

      alert(
        approvedSubmission?.status === 'application_approved'
          ? 'Inscrição aprovada! Agora o usuário pode enviar a prova.'
          : 'Prova aprovada com sucesso! Pontos adicionados.'
      );
      setSelectedSubmission(null);
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      alert('Erro ao aprovar submissão');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Por favor, informe o motivo da rejeição');
      return;
    }

    try {
      await rejectSubmission.mutateAsync({
        submissionId: selectedSubmission.id,
        rejectionReason: rejectionReason
      });

      alert('Submissão rejeitada');
      setSelectedSubmission(null);
      setRejectionReason('');
      setIsRejecting(false);
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      alert('Erro ao rejeitar submissão');
    }
  };

  const SubmissionCard = ({ submission }) => (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all border-2 border-gray-200 hover:border-emerald-300"
      onClick={() => setSelectedSubmission(submission)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight mb-2">
              {submission.task?.title || 'Tarefa'}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{submission.profile?.full_name || submission.profile?.email || 'Usuário'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 rounded-full border border-amber-200">
            <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
            <span className="font-bold text-amber-700">{submission.task?.points || 0}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {submission.description && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Descrição:</p>
            <p className="text-sm text-gray-700 line-clamp-2">{submission.description}</p>
          </div>
        )}

        {submission.proof_url && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Comprovante:</p>
            <img
              src={submission.proof_url}
              alt="Comprovante"
              className="w-full h-32 object-cover rounded-lg"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(submission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
          {submission.status === 'proof_pending' ? (
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
              <Clock className="w-3 h-3 mr-1" />
              Prova Pendente
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
              <Clock className="w-3 h-3 mr-1" />
              Inscrição Pendente
            </Badge>
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Aprovação Final de Provas</h1>
          <p className="text-gray-600">Valide as provas enviadas após aprovação de inscrição.</p>
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
        </div>

        {/* Lista de Submissões Pendentes */}
        {proofPendingSubmissions.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proofPendingSubmissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedSubmission && (
        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Validar Submissão</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Informações da Tarefa */}
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedSubmission.task?.title}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
                    <span className="font-semibold">{selectedSubmission.task?.points} pontos</span>
                  </div>
                  <Badge>{selectedSubmission.task?.category}</Badge>
                  <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                    {STATUS_LABELS[selectedSubmission.status] || selectedSubmission.status}
                  </Badge>
                </div>
              </div>

              {/* Informações do Usuário */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">Enviado por:</p>
                <p className="font-semibold">{selectedSubmission.profile?.full_name || 'Usuário'}</p>
                <p className="text-sm text-gray-600">{selectedSubmission.profile?.email}</p>
              </div>

              {/* Descrição da Submissão */}
              {selectedSubmission.description && (
                <div>
                  <Label className="text-base font-semibold mb-2 block">Descrição:</Label>
                  <p className="text-gray-700 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                    {selectedSubmission.description}
                  </p>
                </div>
              )}

              {/* Comprovante */}
              {selectedSubmission.proof_url && (
                <div>
                  <Label className="text-base font-semibold mb-2 block">Comprovante:</Label>
                  <img
                    src={selectedSubmission.proof_url}
                    alt="Comprovante"
                    className="w-full rounded-lg border-2 border-gray-200"
                  />
                  <a
                    href={selectedSubmission.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:underline flex items-center gap-1 mt-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir em nova aba
                  </a>
                </div>
              )}

              {/* Ações */}
              {!isRejecting ? (
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => handleApprove(selectedSubmission)}
                    disabled={approveSubmission.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {approveSubmission.isPending
                      ? 'Aprovando...'
                      : selectedSubmission.status === 'proof_pending'
                        ? 'Aprovar Prova e Finalizar'
                        : 'Aprovar Inscrição'}
                  </Button>
                  <Button
                    onClick={() => setIsRejecting(true)}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {selectedSubmission.status === 'proof_pending' ? 'Rejeitar Prova' : 'Rejeitar Inscrição'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-4">
                  <Label htmlFor="rejection-reason">Motivo da Rejeição:</Label>
                  <Textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explique o motivo da rejeição para o usuário..."
                    rows={4}
                  />
                  <div className="flex gap-3">
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
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
