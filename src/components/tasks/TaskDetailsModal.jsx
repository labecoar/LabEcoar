import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateSubmission } from "@/hooks/useSubmissions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Star, CircleDollarSign, UserRoundCheck, Send } from "lucide-react";

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

export default function TaskDetailsModal({ task, onClose, isTaskClaimed, isTaskApproved }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const createSubmission = useCreateSubmission();

  if (!task) return null;

  const timeLeft = useMemo(() => formatTimeLeft(task.expires_at), [task.expires_at]);
  const displayCategory = CATEGORY_NAMES[task.category] || task.category;
  const offeredValue = Number(task.offered_value || task.points || 0);
  const isFull = Boolean(task.max_participants) && Number(task.current_participants || 0) >= Number(task.max_participants);

  const handleApply = async (e) => {
    e.preventDefault();
    if (isTaskClaimed || isTaskApproved || isFull) return;

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
      alert('Erro ao enviar candidatura');
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
              <li>Tipo de prova: {task.proof_type || 'link'}</li>
              {Array.isArray(task.content_formats) && task.content_formats.length > 0 && (
                <li>Conteúdo: {task.content_formats.join(', ')}</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1 text-[#3c0b14]">Descrição</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
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
                  disabled={isSubmitting || isTaskClaimed || isTaskApproved || isFull}
                  className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isTaskApproved
                    ? 'Tarefa já concluída'
                    : isTaskClaimed
                      ? 'Candidatura em análise'
                      : isFull
                        ? 'Vagas encerradas'
                        : isSubmitting
                          ? 'Enviando candidatura...'
                          : 'Candidatar-se para esta Vaga'}
                </Button>
              </form>
            </div>
          </div>

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
