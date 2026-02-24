import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateSubmission } from "@/hooks/useSubmissions";
import { useUploadFile } from "@/hooks/useStorage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Star, Upload } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TaskDetailsModal({ task, onClose, isTaskClaimed }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const { user } = useAuth();
  const createSubmission = useCreateSubmission();
  const uploadFile = useUploadFile();

  if (!task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let proofUrl = null;

      // Upload de arquivo se houver
      if (file) {
        const { url } = await uploadFile.mutateAsync({ file, userId: user.id });
        proofUrl = url;
      }

      // Criar submissão
      await createSubmission.mutateAsync({
        user_id: user.id,
        task_id: task.id,
        description,
        proof_url: proofUrl,
      });

      alert('Tarefa enviada com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao enviar tarefa:', error);
      alert('Erro ao enviar tarefa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{task.title}</DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge>{task.category}</Badge>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="font-semibold">{task.points} pontos</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Descrição */}
          <div>
            <h3 className="font-semibold mb-2">Descrição:</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
          </div>

          {/* Informações */}
          <div className="grid grid-cols-2 gap-4">
            {task.expires_at && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Expira em {format(new Date(task.expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            )}
            {task.max_participants && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>{task.current_participants || 0}/{task.max_participants} participantes</span>
              </div>
            )}
          </div>

          {/* Formulário de submissão */}
          {!isTaskClaimed && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Enviar Comprovante</h3>

              <div>
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva como você completou a tarefa..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="file">Comprovante (imagem)</Label>
                <input
                  type="file"
                  id="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !file}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Enviando...' : 'Enviar Tarefa'}
              </Button>
            </form>
          )}

          {isTaskClaimed && (
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-blue-700 font-medium">Esta tarefa já foi enviada e está em análise</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
