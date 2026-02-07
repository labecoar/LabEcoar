import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, ExternalLink, Calendar, Award } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SubmissionDetailsModal({ submission, isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{submission.task_title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {submission.status === 'pendente' && (
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-base">
                <Clock className="w-4 h-4 mr-1" />
                Pendente de Validação
              </Badge>
            )}
            {submission.status === 'aprovada' && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-base">
                <CheckCircle className="w-4 h-4 mr-1" />
                Aprovada
              </Badge>
            )}
            {submission.status === 'rejeitada' && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-base">
                <XCircle className="w-4 h-4 mr-1" />
                Rejeitada
              </Badge>
            )}
          </div>

          {submission.points_earned && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-5 h-5 text-yellow-600" />
                  <p className="text-sm text-gray-600">Pontos</p>
                </div>
                <p className="text-2xl font-bold text-yellow-700">{submission.points_earned}</p>
              </div>
            </div>
          )}

          {submission.description && (
            <div>
              <h3 className="font-semibold mb-2">Sua Descrição</h3>
              <p className="text-gray-600 p-3 bg-gray-50 rounded-lg">{submission.description}</p>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">Prova Enviada</h3>
            <div className="space-y-2">
              {submission.proof_url && (
                <a
                  href={submission.proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  {submission.proof_url}
                </a>
              )}
              {submission.proof_file_url && (
                <a
                  href={submission.proof_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver arquivo enviado
                </a>
              )}
              {submission.insights_file_url && (
                <a
                  href={submission.insights_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver métricas/insights
                </a>
              )}
            </div>
          </div>

          {submission.rejection_reason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-700 mb-2">Motivo da Rejeição</h3>
              <p className="text-red-600">{submission.rejection_reason}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-500 pt-4 border-t">
            <Calendar className="w-4 h-4" />
            Enviado em {format(new Date(submission.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>

          <Button onClick={onClose} className="w-full" variant="outline">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}