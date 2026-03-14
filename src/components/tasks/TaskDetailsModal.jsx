// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateSubmission, useSubmitProof } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions, useSubmitMetricsSubmission } from "@/hooks/useMetrics";
import { useUploadFile } from "@/hooks/useStorage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Star, CircleDollarSign, UserRoundCheck, Send, Upload, BarChart3 } from "lucide-react";

const CATEGORY_NAMES = {
  campanha: "Campanha",
  resposta_rapida: "Resposta Rápida",
  oficina: "Oficina",
  folhetim: "Folhetim",
  compartilhar_ecoante: "Compartilhar Ecoante",
};

const formatTimeLeft = (expiresAt) => {
  if (!expiresAt) return null;
  const now = new Date();
  const end = new Date(expiresAt);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "Expirada";

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

const STATUS_TEXT = {
  application_pending: 'Inscrição em análise',
  application_approved: 'Inscrição aprovada',
  application_rejected: 'Inscrição rejeitada',
  proof_pending: 'Prova em análise',
  approved: 'Tarefa concluída',
  rejected: 'Prova rejeitada',
  pending: 'Inscrição em análise',
}

const PROOF_TYPE_LABELS = {
  link: 'Link',
  imagem: 'Imagem',
  image: 'Imagem',
  video: 'Vídeo',
  arquivo: 'Arquivo',
  file: 'Arquivo',
}

const getProofTypeLabel = (task) => {
  const raw = String(task?.proof_type || '').trim().toLowerCase()
  if (raw) return PROOF_TYPE_LABELS[raw] || task.proof_type

  if (Array.isArray(task?.content_formats) && task.content_formats.length > 0) {
    return task.content_formats.join(', ')
  }

  return 'Não informado'
}

export default function TaskDetailsModal({ task, onClose, isTaskClaimed, isTaskApproved, currentSubmission }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofDescription, setProofDescription] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [metricsDescription, setMetricsDescription] = useState('');
  const [metricsLink, setMetricsLink] = useState('');
  const [metricsFile, setMetricsFile] = useState(null);
  const { user } = useAuth();
  const createSubmission = useCreateSubmission();
  const submitProof = useSubmitProof();
  const submitMetrics = useSubmitMetricsSubmission();
  const uploadFile = useUploadFile();
  const { data: myMetricsSubmissions = [] } = useMyMetricsSubmissions(user?.id);

  if (!task) return null;

  const timeLeft = useMemo(() => formatTimeLeft(task.expires_at), [task.expires_at]);
  const displayCategory = CATEGORY_NAMES[task.category] || task.category;
  const displayProofType = useMemo(() => getProofTypeLabel(task), [task]);
  const offeredValue = Number(task.offered_value || task.points || 0);
  const isFull = Boolean(task.max_participants) && Number(task.current_participants || 0) >= Number(task.max_participants);
  const submissionStatus = currentSubmission?.status;
  const canApply = !currentSubmission && !isTaskApproved && !isFull;
  const canSubmitProof = submissionStatus === 'application_approved';
  const isWaiting = ['application_pending', 'proof_pending', 'pending'].includes(submissionStatus);
  const isCampaignTask = task?.category === 'campanha';
  const currentMetricsSubmission = useMemo(
    () => myMetricsSubmissions.find((item) => String(item.task_id) === String(task.id)) || null,
    [myMetricsSubmissions, task.id]
  );
  const metricsStatus = currentMetricsSubmission?.status;
  const canSubmitMetrics = isCampaignTask && submissionStatus === 'approved' && (!currentMetricsSubmission || metricsStatus === 'rejected');
  const postingDeadline = task.posting_deadline ? new Date(task.posting_deadline) : null;
  const hasValidPostingDeadline = postingDeadline && !Number.isNaN(postingDeadline.getTime());
  const metricsWindowStart = hasValidPostingDeadline
    ? new Date(postingDeadline.getTime() + 5 * 24 * 60 * 60 * 1000)
    : null;
  const metricsWindowEnd = hasValidPostingDeadline
    ? new Date(postingDeadline.getTime() + 8 * 24 * 60 * 60 * 1000)
    : null;
  const now = new Date();
  const isInsideMetricsWindow =
    metricsWindowStart && metricsWindowEnd
      ? now >= metricsWindowStart && now <= metricsWindowEnd
      : true;
  const hasMetricsWindowPassed = metricsWindowEnd ? now > metricsWindowEnd : false;

  const handleApply = async (e) => {
    e.preventDefault();
    if (!canApply) return;

    setIsSubmitting(true);

    try {
      await createSubmission.mutateAsync({
        user_id: user.id,
        task_id: task.id,
        description: 'Candidatura enviada',
        proof_url: null,
      });

      alert('Candidatura enviada com sucesso! Aguarde a aprovação do administrador. ✅');
      onClose();
    } catch (error) {
      console.error('Erro ao candidatar-se:', error);
      alert(`Erro ao enviar candidatura.\n\nDetalhes: ${error?.message || 'Sem detalhes.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendProof = async (e) => {
    e.preventDefault();
    if (!canSubmitProof || !currentSubmission?.id) return;

    if (!proofFile) {
      alert('Selecione um arquivo de prova para enviar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { url } = await uploadFile.mutateAsync({ file: proofFile, userId: user.id });

      await submitProof.mutateAsync({
        submissionId: currentSubmission.id,
        proofData: {
          description: proofDescription,
          proof_url: url,
        },
      });

      alert('Prova enviada com sucesso! Aguarde a aprovação final do administrador. ✅');
      onClose();
    } catch (error) {
      console.error('Erro ao enviar prova:', error);
      alert(`Erro ao enviar prova da tarefa.\n\nDetalhes: ${error?.message || 'Sem detalhes.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMetrics = async (e) => {
    e.preventDefault();
    if (!canSubmitMetrics || !metricsFile) return;
    if (!isInsideMetricsWindow) {
      alert('As métricas só podem ser enviadas entre o 5º e o 8º dia após a postagem.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { url } = await uploadFile.mutateAsync({ file: metricsFile, userId: user.id });

      await submitMetrics.mutateAsync({
        user,
        task,
        metricsFileUrl: url,
        metricsLink,
        description: metricsDescription,
      });

      alert('Métricas enviadas com sucesso! Aguarde a análise do administrador.');
      setMetricsDescription('');
      setMetricsLink('');
      setMetricsFile(null);
      onClose();
    } catch (error) {
      console.error('Erro ao enviar métricas:', error);
      alert(`Erro ao enviar métricas.\n\nDetalhes: ${error?.message || 'Sem detalhes.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#3c0b14]">{task.title}</DialogTitle>
          <DialogDescription>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 border text-xs">
                {displayCategory}
              </Badge>
              <Badge className="bg-orange-100 text-orange-700 border-orange-300 border text-xs">
                {task.campaign_type === 'resposta_rapida' ? 'Resposta Rápida' : 'Comum'}
              </Badge>
              {task.requires_application && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-300 border text-xs">
                  Requer Inscrição e Seleção
                </Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Pagamento</p>
              <div className="flex items-center gap-2">
                <CircleDollarSign className="w-4 h-4 text-amber-600" />
                <p className="text-xl font-bold text-amber-600">R$ {offeredValue.toLocaleString('pt-BR')}</p>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Vagas</p>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <p className="text-xl font-bold text-blue-600">
                  {task.current_participants || 0}{task.max_participants ? ` / ${task.max_participants}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-fuchsia-200 p-3 space-y-1.5">
            <h3 className="font-semibold text-[#3c0b14] inline-flex items-center gap-2">
              <UserRoundCheck className="w-4 h-4 text-fuchsia-600" />
              Perfil Desejado
            </h3>
            <p className="text-xs text-gray-700">Experiência com sustentabilidade</p>
            <ul className="text-xs text-gray-500 list-disc pl-5 space-y-0.5">
              <li>Mínimo de {task.min_followers || 0} seguidores</li>
              <li>Tipo de prova: {displayProofType}</li>
              {Array.isArray(task.content_formats) && task.content_formats.length > 0 && (
                <li>Conteúdo: {task.content_formats.join(', ')}</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1 text-[#3c0b14]">Descrição</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
            {task.posting_deadline && (
              <p className="text-xs text-gray-500 mt-2">
                Data limite de postagem: {new Date(task.posting_deadline).toLocaleDateString('pt-BR')} {new Date(task.posting_deadline).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="pt-3 border-t">
            <div className="rounded-xl border border-fuchsia-300 p-3">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-full bg-fuchsia-500 text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="font-bold text-[#3c0b14]">Etapa 1: Candidatar-se</p>
                  <p className="text-xs text-gray-500">Envie sua candidatura para análise</p>
                </div>
              </div>

              <form onSubmit={handleApply}>
                <Button
                  type="submit"
                  disabled={isSubmitting || !canApply}
                  className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isTaskApproved || submissionStatus === 'approved'
                    ? 'Tarefa já concluída'
                    : canSubmitProof
                      ? 'Inscrição aprovada - envie a prova abaixo'
                      : isWaiting
                        ? STATUS_TEXT[submissionStatus] || 'Inscrição em análise'
                        : submissionStatus === 'application_rejected'
                          ? 'Inscrição rejeitada'
                          : submissionStatus === 'rejected'
                            ? 'Prova rejeitada'
                      : isFull
                        ? 'Vagas encerradas'
                        : isSubmitting
                          ? 'Enviando candidatura...'
                          : 'Candidatar-se para esta Vaga'}
                </Button>
              </form>
            </div>
          </div>

          {canSubmitProof && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-3">
              <p className="font-semibold text-emerald-700">Etapa 2: Enviar prova de conclusão</p>
              <form onSubmit={handleSendProof} className="space-y-3">
                <div>
                  <Label htmlFor="proof-description">Descrição da prova (opcional)</Label>
                  <Textarea
                    id="proof-description"
                    value={proofDescription}
                    onChange={(e) => setProofDescription(e.target.value)}
                    placeholder="Explique como você concluiu a tarefa..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="proof-file">Arquivo da prova</Label>
                  <input
                    id="proof-file"
                    type="file"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || uploadFile.isPending || submitProof.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isSubmitting || uploadFile.isPending || submitProof.isPending
                    ? 'Enviando prova...'
                    : 'Enviar prova para aprovação final'}
                </Button>
              </form>
            </div>
          )}

          {isCampaignTask && submissionStatus === 'approved' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-3">
              <p className="font-semibold text-sky-700 inline-flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Etapa 3: Postar e enviar métricas
              </p>
              <p className="text-xs text-gray-600">
                Você está autorizado a postar. Lembre-se de enviar um arquivo com comprovação da data da postagem.
              </p>

              {metricsWindowStart && metricsWindowEnd && (
                <div className="text-xs rounded-lg p-3 border bg-amber-50 border-amber-200 text-amber-800">
                  Janela de envio de métricas: de {metricsWindowStart.toLocaleDateString('pt-BR')} até {metricsWindowEnd.toLocaleDateString('pt-BR')}.
                </div>
              )}

              {!isInsideMetricsWindow && !hasMetricsWindowPassed && (
                <div className="text-xs rounded-lg p-3 border bg-blue-50 border-blue-200 text-blue-800">
                  O envio ainda não está disponível. Aguarde até o 5º dia após a postagem.
                </div>
              )}

              {hasMetricsWindowPassed && (
                <div className="text-xs rounded-lg p-3 border bg-red-50 border-red-200 text-red-800">
                  A janela para envio de métricas foi encerrada (após o 8º dia).
                </div>
              )}

              {!currentMetricsSubmission || metricsStatus === 'rejected' ? (
                <form onSubmit={handleSendMetrics} className="space-y-3">
                  <div>
                    <Label htmlFor="metrics-link">Link do post (opcional)</Label>
                    <Input
                      id="metrics-link"
                      type="url"
                      value={metricsLink}
                      onChange={(e) => setMetricsLink(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="metrics-description">Descrição das métricas (opcional)</Label>
                    <Textarea
                      id="metrics-description"
                      value={metricsDescription}
                      onChange={(e) => setMetricsDescription(e.target.value)}
                      placeholder="Explique os dados enviados..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="metrics-file">Arquivo de métricas</Label>
                    <input
                      id="metrics-file"
                      type="file"
                      onChange={(e) => setMetricsFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || uploadFile.isPending || submitMetrics.isPending || !metricsFile || !isInsideMetricsWindow}
                    className="w-full bg-sky-600 hover:bg-sky-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isSubmitting || uploadFile.isPending || submitMetrics.isPending
                      ? 'Enviando métricas...'
                      : currentMetricsSubmission?.status === 'rejected'
                        ? 'Reenviar métricas'
                        : 'Enviar métricas para aprovação'}
                  </Button>
                </form>
              ) : (
                <div className="space-y-2">
                  {metricsStatus === 'pending' && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      Métricas em análise
                    </Badge>
                  )}
                  {metricsStatus === 'approved' && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      Métricas aprovadas - pagamento a caminho
                    </Badge>
                  )}
                </div>
              )}

              {currentMetricsSubmission?.status === 'rejected' && currentMetricsSubmission?.rejection_reason && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Motivo da rejeição das métricas</p>
                  <p className="text-sm text-red-600">{currentMetricsSubmission.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          {currentSubmission?.rejection_reason && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Motivo da rejeição</p>
              <p className="text-sm text-red-600">{currentSubmission.rejection_reason}</p>
            </div>
          )}

          {task.expires_at && (
            <div className="flex items-center justify-end text-xs text-gray-500 gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Expira em <strong>{timeLeft}</strong> ({new Date(task.expires_at).toLocaleString('pt-BR')})
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
