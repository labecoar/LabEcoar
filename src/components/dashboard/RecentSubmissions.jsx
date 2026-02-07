import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RecentSubmissions({ submissions }) {
  if (!submissions || submissions.length === 0) {
    return (
      <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
        <CardHeader className="border-b border-emerald-100">
          <CardTitle className="text-xl">Submissões Recentes</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma submissão ainda no trimestre</p>
            <p className="text-sm mt-1">Comece realizando tarefas!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b border-emerald-100">
        <CardTitle className="text-xl">Submissões Recentes</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {submissions.slice(0, 5).map((submission) => (
            <div 
              key={submission.id}
              className="flex items-start gap-4 p-4 rounded-xl hover:bg-emerald-50 transition-colors duration-200"
            >
              <div className="flex-shrink-0">
                {submission.status === 'pendente' && (
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                )}
                {submission.status === 'aprovada' && (
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                )}
                {submission.status === 'rejeitada' && (
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-gray-900 truncate">{submission.task_title}</h4>
                  {submission.status === 'pendente' && (
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 flex-shrink-0">
                      Pendente
                    </Badge>
                  )}
                  {submission.status === 'aprovada' && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 flex-shrink-0">
                      Aprovada
                    </Badge>
                  )}
                  {submission.status === 'rejeitada' && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 flex-shrink-0">
                      Rejeitada
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {format(new Date(submission.created_date), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                {submission.status === 'aprovada' && submission.points_earned && (
                  <p className="text-sm text-emerald-600 font-medium mt-1">
                    +{submission.points_earned} pontos
                  </p>
                )}
                {submission.proof_url && (
                  <a
                    href={submission.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 mt-2"
                  >
                    Ver prova <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}