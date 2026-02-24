import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Star,
  CheckCircle2,
  Upload,
  Link as LinkIcon,
  Clock,
  UserCheck,
  Send,
  AlertCircle,
  ThumbsUp,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TaskDetailsModal({ task, isOpen, onClose, isClaimed, isCompleted, isApproved, isRejected, isSubmissionRejected }) {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [justification, setJustification] = useState("");
  const [portfolioLinks, setPortfolioLinks] = useState("");
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  // Busca a application do usuário para esta tarefa (funciona para TODAS as tarefas agora)
  const { data: userApplication } = useQuery({
    queryKey: ['user-application', task?.id],
    queryFn: async () => {
      if (!task?.id || !currentUser?.email) return null;
      const applications = await base44.entities.TaskApplication.filter({
        task_id: task.id,
        user_email: currentUser.email
      });
      return applications[0] || null;
    },
    enabled: !!task?.id && !!currentUser?.email
  });

  // Verifica se o usuário já fez esta tarefa (submissão aprovada)
  const { data: hasCompletedTask } = useQuery({
    queryKey: ['has-completed-task', task?.id],
    queryFn: async () => {
      if (!task?.id || !currentUser?.email) return false;
      const submissions = await base44.entities.TaskSubmission.filter({
        task_id: task.id,
        user_email: currentUser.email,
        status: 'aprovada'
      });
      return submissions.length > 0;
    },
    enabled: !!task?.id && !!currentUser?.email
  });

  const submitTaskMutation = useMutation({
    mutationFn: async (submissionData) => {
      const user = await base44.auth.me();
      let uploadedFileUrl = null;

      if (file) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedFileUrl = file_url;
      }

      const submission = await base44.entities.TaskSubmission.create({
        task_id: task.id,
        task_title: task.title,
        user_email: user.email,
        user_name: user.full_name,
        proof_url: submissionData.proofUrl,
        proof_file_url: uploadedFileUrl,
        description: submissionData.description,
        status: "pendente",
        points_earned: task.points,
        submitted_at: new Date().toISOString(),
        quarter: user.current_quarter,
      });

      return submission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-submissions-check"] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions-all"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      alert("Prova enviada com sucesso! ✅");
      onClose();
    },
  });



  // Mutation para aceitar tarefa (cria application para TODAS as tarefas)
  const acceptTaskMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.TaskApplication.create({
        task_id: task.id,
        task_title: task.title,
        user_email: user.email,
        user_name: user.full_name,
        instagram_handle: user.instagram_handle || '',
        followers_count: user.followers_count || 0,
        justification: task.requires_application ? justification : "Tarefa aceita",
        portfolio_links: task.requires_application ? portfolioLinks.split('\n').map(link => link.trim()).filter(link => link.length > 0) : [],
        status: "pendente",
        applied_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-application"] });
      if (task.requires_application) {
        alert("Inscrição enviada com sucesso! Aguarde a seleção. ✅");
        setShowApplicationForm(false);
        setJustification("");
        setPortfolioLinks("");
      } else {
        alert("Tarefa aceita! Aguarde a aprovação do administrador. ✅");
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!proofUrl && !file) {
      alert("Por favor, forneça uma prova da conclusão da tarefa");
      return;
    }
    submitTaskMutation.mutate({ proofUrl, description });
    setShowSubmitForm(false);
  };

  const handleApply = (e) => {
    e.preventDefault();
    acceptTaskMutation.mutate();
  };

  const handleAcceptTask = () => {
    acceptTaskMutation.mutate();
  };

  const isFull = task?.max_participants && task?.current_participants >= task?.max_participants;
  const isSelected = userApplication?.status === 'selecionado';
  const isPending = userApplication?.status === 'pendente';
  
  // Verifica se é tarefa que só pode fazer uma vez (campanha ou sidequest)
  const isOneTimeTask = task?.category === 'campanha' || task?.category === 'sidequests';
  const cannotParticipate = isOneTimeTask && hasCompletedTask;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl" style={{ color: '#3c0b14' }}>{task?.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Badges de Status */}
          <div className="flex flex-wrap gap-2">
            {task?.category === 'campanha' && (
              <Badge className="border-2" style={{ background: '#f6c83520', color: '#f6c835', borderColor: '#f6c835' }}>
                💰 Campanha Paga
              </Badge>
            )}
            {task?.campaign_type === 'resposta_rapida' && (
              <Badge className="border-2 animate-pulse" style={{ background: '#ff6a2d20', color: '#ff6a2d', borderColor: '#ff6a2d' }}>
                🔥 Resposta Rápida
              </Badge>
            )}
            {task?.requires_application && (
              <Badge className="border-2" style={{ background: '#a6539f20', color: '#a6539f', borderColor: '#a6539f' }}>
                <UserCheck className="w-3 h-3 mr-1" />
                Requer Inscrição e Seleção
              </Badge>
            )}
            {isCompleted && (
              <Badge className="border-2" style={{ background: '#00c33120', color: '#00c331', borderColor: '#00c331' }}>
                Concluída ✓
              </Badge>
            )}
            {isClaimed && !isCompleted && (
              <Badge className="border-2" style={{ background: '#0077ad20', color: '#0077ad', borderColor: '#0077ad' }}>
                <Clock className="w-3 h-3 mr-1" />
                Prova em Análise
              </Badge>
            )}
            {isPending && (
              <Badge className="border-2" style={{ background: '#f6c83520', color: '#f6c835', borderColor: '#f6c835' }}>
                <Clock className="w-3 h-3 mr-1" />
                {task?.requires_application ? 'Inscrição em Análise' : 'Aguardando Aprovação'}
              </Badge>
            )}
            {isSelected && !isClaimed && !isCompleted && (
              <Badge className="border-2" style={{ background: '#00c33120', color: '#00c331', borderColor: '#00c331' }}>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Aprovado - Pode Realizar
              </Badge>
            )}
            {isRejected && (
              <Badge className="border-2" style={{ background: '#ce161c20', color: '#ce161c', borderColor: '#ce161c' }}>
                Não Aprovado
              </Badge>
            )}
            {isFull && !userApplication && (
              <Badge className="border-2" style={{ background: '#ce161c20', color: '#ce161c', borderColor: '#ce161c' }}>
                Vagas Esgotadas
              </Badge>
            )}
          </div>

          {/* Informações Principais */}
          <div className="grid grid-cols-2 gap-4">
            {task?.category === 'campanha' ? (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f6c83520' }}>
                <span className="text-2xl">💰</span>
                <div>
                  <p className="text-xs" style={{ color: '#929292' }}>Pagamento</p>
                  <p className="font-bold" style={{ color: '#f6c835' }}>
                    R$ {(task?.payment_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#00c33120' }}>
                <Star className="w-5 h-5" style={{ color: '#00c331' }} />
                <div>
                  <p className="text-xs" style={{ color: '#929292' }}>Pontos</p>
                  <p className="font-bold" style={{ color: '#00c331' }}>{task?.points}</p>
                </div>
              </div>
            )}

            {task?.max_participants && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#0077ad20' }}>
                <Users className="w-5 h-5" style={{ color: '#0077ad' }} />
                <div>
                  <p className="text-xs" style={{ color: '#929292' }}>Vagas</p>
                  <p className="font-bold" style={{ color: '#0077ad' }}>
                    {task?.current_participants || 0} / {task?.max_participants}
                  </p>
                </div>
              </div>
            )}

            {task?.deadline && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#e833ae20' }}>
                <Calendar className="w-5 h-5" style={{ color: '#e833ae' }} />
                <div>
                  <p className="text-xs" style={{ color: '#929292' }}>Prazo</p>
                  <p className="font-bold text-sm" style={{ color: '#e833ae' }}>
                    {format(new Date(task?.deadline), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Requisitos de Perfil (apenas para tarefas com inscrição) */}
          {task?.requires_application && task?.profile_requirements && (
            <div className="p-4 rounded-xl border-2" style={{ background: '#a6539f05', borderColor: '#a6539f' }}>
              <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: '#3c0b14' }}>
                <UserCheck className="w-5 h-5" style={{ color: '#a6539f' }} />
                Perfil Desejado
              </h3>
              <p className="text-sm" style={{ color: '#3c0b14' }}>{task?.profile_requirements}</p>
              {task?.min_followers && (
                <p className="text-sm mt-2" style={{ color: '#929292' }}>
                  • Mínimo de {task.min_followers.toLocaleString('pt-BR')} seguidores
                </p>
              )}
              {task?.target_audience && (
                <p className="text-sm" style={{ color: '#929292' }}>
                  • Público-alvo: {task.target_audience}
                </p>
              )}
            </div>
          )}

          {/* Descrição */}
          <div>
            <h3 className="font-bold mb-2" style={{ color: '#3c0b14' }}>Descrição</h3>
            <p className="text-sm" style={{ color: '#3c0b14' }}>{task?.description}</p>
          </div>

          {/* Requisitos */}
          {task?.requirements && task?.requirements.length > 0 && (
            <div>
              <h3 className="font-bold mb-2" style={{ color: '#3c0b14' }}>Requisitos</h3>
              <ul className="space-y-1">
                {task?.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm" style={{ color: '#3c0b14' }}>
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#096e4c' }} />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t-2 my-6" style={{ borderColor: '#096e4c20' }}></div>

          {/* ========== FLUXO PARA TAREFAS COM INSCRIÇÃO ========== */}
          {task?.requires_application && (
            <>
              {/* Já participou desta tarefa */}
              {cannotParticipate && (
                <div className="p-6 rounded-xl text-center border-2" style={{ background: '#92929210', borderColor: '#929292' }}>
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#929292' }} />
                  <p className="font-medium mb-1" style={{ color: '#929292' }}>Você já participou desta tarefa</p>
                  <p className="text-sm" style={{ color: '#929292' }}>
                    Esta tarefa só pode ser realizada uma vez por pessoa.
                  </p>
                </div>
              )}

              {/* ETAPA 1: Candidatar-se */}
              {!userApplication && !cannotParticipate && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#a6539f05', borderColor: '#a6539f' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: '#a6539f' }}>
                      1
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#3c0b14' }}>Etapa 1: Candidatar-se</h3>
                      <p className="text-sm" style={{ color: '#929292' }}>Envie sua candidatura para análise</p>
                    </div>
                  </div>
                  
                  {!showApplicationForm ? (
                    <Button
                      onClick={() => setShowApplicationForm(true)}
                      className="w-full text-white"
                      style={{ background: 'linear-gradient(135deg, #a6539f 0%, #e833ae 100%)' }}
                      disabled={isFull}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isFull ? 'Vagas Esgotadas' : 'Candidatar-se para esta Vaga'}
                    </Button>
                  ) : (
                    <form onSubmit={handleApply} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="justification" style={{ color: '#3c0b14' }}>
                          Por que você se enquadra nesta vaga? (opcional)
                        </Label>
                        <Textarea
                          id="justification"
                          placeholder="Explique suas qualificações, experiências relevantes, e porque você é ideal para esta campanha..."
                          value={justification}
                          onChange={(e) => setJustification(e.target.value)}
                          className="h-32"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="portfolio" style={{ color: '#3c0b14' }}>
                          Links de Portfólio (opcional)
                        </Label>
                        <Textarea
                          id="portfolio"
                          placeholder="Cole links de posts, vídeos ou trabalhos anteriores (um por linha)"
                          value={portfolioLinks}
                          onChange={(e) => setPortfolioLinks(e.target.value)}
                          className="h-24"
                        />
                        <p className="text-xs" style={{ color: '#929292' }}>
                          Adicione links do Instagram, YouTube, ou outras redes que mostrem seu trabalho
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowApplicationForm(false);
                            setJustification("");
                            setPortfolioLinks("");
                          }}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 text-white"
                          style={{ background: 'linear-gradient(135deg, #a6539f 0%, #e833ae 100%)' }}
                          disabled={acceptTaskMutation.isPending}
                        >
                          {acceptTaskMutation.isPending ? 'Enviando...' : 'Enviar Candidatura'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* ETAPA 2: Aguardando seleção */}
              {isPending && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#f6c83510', borderColor: '#f6c835' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-2xl" style={{ background: '#f6c835', color: 'white' }}>
                      ⏳
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#3c0b14' }}>Etapa 2: Aguardando Seleção</h3>
                      <p className="text-sm" style={{ color: '#929292' }}>Sua candidatura está em análise</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'white' }}>
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#f6c835' }} />
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#3c0b14' }}>Candidatura enviada com sucesso!</p>
                      <p className="text-sm" style={{ color: '#929292' }}>
                        O administrador está analisando sua inscrição. Você será notificado quando for selecionado.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ETAPA 3: Selecionado - PODE ENVIAR PROVA */}
              {(isSelected || isApproved) && !isClaimed && !isCompleted && !isSubmissionRejected && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#096e4c05', borderColor: '#096e4c' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: '#096e4c' }}>
                      3
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#00c331' }}>🎉 Etapa 3: Você Foi Aprovado!</h3>
                      <p className="text-sm" style={{ color: '#929292' }}>Realize a campanha e envie a prova</p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 rounded-lg" style={{ background: 'white' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#3c0b14' }}>
                      Parabéns! O administrador aprovou sua candidatura.
                    </p>
                    <p className="text-sm" style={{ color: '#929292' }}>
                      Agora você pode realizar a campanha conforme os requisitos e enviar a prova de conclusão.
                    </p>
                  </div>

                  {!showSubmitForm ? (
                    <Button
                      onClick={() => setShowSubmitForm(true)}
                      className="w-full text-white"
                      style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Enviar Prova de Conclusão
                    </Button>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="proofUrl" style={{ color: '#3c0b14' }}>
                          <LinkIcon className="w-4 h-4 inline mr-1" />
                          Link da Prova
                        </Label>
                        <Input
                          id="proofUrl"
                          type="url"
                          placeholder="Cole o link do post, vídeo, etc."
                          value={proofUrl}
                          onChange={(e) => setProofUrl(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="file" style={{ color: '#3c0b14' }}>
                          <Upload className="w-4 h-4 inline mr-1" />
                          Ou envie um arquivo
                        </Label>
                        <Input
                          id="file"
                          type="file"
                          accept="image/*,video/*,.pdf"
                          onChange={(e) => setFile(e.target.files[0])}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" style={{ color: '#3c0b14' }}>Descrição (opcional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Adicione observações sobre a tarefa..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="h-24"
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowSubmitForm(false)}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 text-white"
                          style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                          disabled={submitTaskMutation.isPending}
                        >
                          {submitTaskMutation.isPending ? 'Enviando...' : 'Enviar Prova'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Prova enviada */}
              {isClaimed && !isCompleted && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#0077ad10', borderColor: '#0077ad' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: '#0077ad' }}>
                      ✓
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#0077ad' }}>Prova Enviada!</h3>
                      <p className="text-sm" style={{ color: '#929292' }}>Aguardando aprovação</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'white' }}>
                    <p className="text-sm" style={{ color: '#929292' }}>
                      Sua prova foi enviada com sucesso e está sendo analisada pelo administrador.
                    </p>
                  </div>
                </div>
              )}

              {/* Concluída */}
              {isCompleted && (
                <div className="p-6 rounded-xl text-center" style={{ background: '#00c33120' }}>
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-3" style={{ color: '#00c331' }} />
                  <h3 className="font-bold text-lg mb-1" style={{ color: '#00c331' }}>Campanha Concluída!</h3>
                  <p className="text-sm" style={{ color: '#929292' }}>Parabéns! Sua campanha foi aprovada.</p>
                </div>
              )}

              {/* Não selecionado - PERMITE TENTAR DE NOVO */}
              {isRejected && !isApproved && !isSubmissionRejected && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#ce161c10', borderColor: '#ce161c' }}>
                  <p className="font-medium mb-2" style={{ color: '#ce161c' }}>Não selecionado desta vez</p>
                  <p className="text-sm mb-2" style={{ color: '#3c0b14' }}>
                    Mas você pode tentar de novo!
                  </p>
                  
                  {!showApplicationForm ? (
                    <Button
                      onClick={() => setShowApplicationForm(true)}
                      className="w-full mt-4 text-white"
                      style={{ background: 'linear-gradient(135deg, #a6539f 0%, #e833ae 100%)' }}
                      disabled={isFull}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isFull ? 'Vagas Esgotadas' : 'Nova Candidatura'}
                    </Button>
                  ) : (
                    <form onSubmit={handleApply} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="justification" style={{ color: '#3c0b14' }}>
                          Por que você se enquadra nesta vaga?
                        </Label>
                        <Textarea
                          id="justification"
                          placeholder="Explique suas qualificações, experiências relevantes, e porque você é ideal para esta campanha..."
                          value={justification}
                          onChange={(e) => setJustification(e.target.value)}
                          className="h-32"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="portfolio" style={{ color: '#3c0b14' }}>
                          Links de Portfólio (opcional)
                        </Label>
                        <Textarea
                          id="portfolio"
                          placeholder="Cole links de posts, vídeos ou trabalhos anteriores (um por linha)"
                          value={portfolioLinks}
                          onChange={(e) => setPortfolioLinks(e.target.value)}
                          className="h-24"
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowApplicationForm(false);
                            setJustification("");
                            setPortfolioLinks("");
                          }}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 text-white"
                          style={{ background: 'linear-gradient(135deg, #a6539f 0%, #e833ae 100%)' }}
                          disabled={acceptTaskMutation.isPending}
                        >
                          {acceptTaskMutation.isPending ? 'Enviando...' : 'Enviar Candidatura'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Prova rejeitada - PERMITE TENTAR DE NOVO */}
              {isSubmissionRejected && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#ce161c10', borderColor: '#ce161c' }}>
                  <p className="font-medium mb-2" style={{ color: '#ce161c' }}>Ops, sua tarefa não foi aprovada</p>
                  <p className="text-sm mb-2" style={{ color: '#3c0b14' }}>
                    Mas você pode tentar de novo!
                  </p>
                  <p className="text-sm mb-3" style={{ color: '#929292' }}>
                    Para checar o motivo, vá em <span className="font-semibold">Minhas Submissões → Rejeitada</span>
                  </p>

                  {!showSubmitForm ? (
                    <Button
                      onClick={() => setShowSubmitForm(true)}
                      className="w-full text-white"
                      style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="proofUrl" style={{ color: '#3c0b14' }}>
                          <LinkIcon className="w-4 h-4 inline mr-1" />
                          Link da Prova
                        </Label>
                        <Input
                          id="proofUrl"
                          type="url"
                          placeholder="Cole o link do post, vídeo, etc."
                          value={proofUrl}
                          onChange={(e) => setProofUrl(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="file" style={{ color: '#3c0b14' }}>
                          <Upload className="w-4 h-4 inline mr-1" />
                          Ou envie um arquivo
                        </Label>
                        <Input
                          id="file"
                          type="file"
                          accept="image/*,video/*,.pdf"
                          onChange={(e) => setFile(e.target.files[0])}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" style={{ color: '#3c0b14' }}>Descrição (opcional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Adicione observações sobre a tarefa..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="h-24"
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowSubmitForm(false)}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 text-white"
                          style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                          disabled={submitTaskMutation.isPending}
                        >
                          {submitTaskMutation.isPending ? 'Enviando...' : 'Enviar Prova'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}

          {/* ========== FLUXO PARA TAREFAS NORMAIS (sem inscrição) - AGORA COM APROVAÇÃO ========== */}
          {!task?.requires_application && (
            <>
              {/* Já participou desta tarefa */}
              {cannotParticipate && (
                <div className="p-6 rounded-xl text-center border-2" style={{ background: '#92929210', borderColor: '#929292' }}>
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#929292' }} />
                  <p className="font-medium mb-1" style={{ color: '#929292' }}>Você já participou desta tarefa</p>
                  <p className="text-sm" style={{ color: '#929292' }}>
                    Esta tarefa só pode ser realizada uma vez por pessoa.
                  </p>
                </div>
              )}

              {/* ETAPA 1: Aceitar Tarefa */}
              {!userApplication && !isCompleted && !isFull && !cannotParticipate && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#096e4c05', borderColor: '#096e4c' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: '#096e4c' }}>
                      1
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#3c0b14' }}>Etapa 1: Aceitar Tarefa</h3>
                      <p className="text-sm" style={{ color: '#929292' }}>Confirme que deseja realizar esta tarefa</p>
                    </div>
                  </div>

                  <Button
                    onClick={handleAcceptTask}
                    className="w-full text-white"
                    style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                    disabled={acceptTaskMutation.isPending}
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    {acceptTaskMutation.isPending ? 'Aceitando...' : 'Aceitar esta Tarefa'}
                  </Button>
                </div>
              )}

              {/* ETAPA 2: Aguardando Aprovação */}
              {isPending && !isCompleted && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#f6c83510', borderColor: '#f6c835' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-2xl" style={{ background: '#f6c835', color: 'white' }}>
                      ⏳
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#3c0b14' }}>Etapa 2: Aguardando Aprovação</h3>
                      <p className="text-sm" style={{ color: '#929292' }}>Sua solicitação está sendo analisada</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'white' }}>
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#f6c835' }} />
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#3c0b14' }}>Tarefa aceita!</p>
                      <p className="text-sm" style={{ color: '#929292' }}>
                        O administrador está analisando sua solicitação. Você será notificado quando for aprovado para realizar a tarefa.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ETAPA 3: Aprovado - ENVIAR PROVA */}
              {(isSelected || isApproved) && !isClaimed && !isCompleted && !isSubmissionRejected && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#096e4c05', borderColor: '#096e4c' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: '#096e4c' }}>
                      3
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#00c331' }}>🎉 Etapa 3: Aprovado!</h3>
                      <p className="text-sm" style={{ color: '#929292' }}>Realize a tarefa e envie a prova</p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 rounded-lg" style={{ background: 'white' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#3c0b14' }}>
                      Parabéns! O administrador aprovou sua solicitação.
                    </p>
                    <p className="text-sm" style={{ color: '#929292' }}>
                      Agora você pode realizar a tarefa conforme os requisitos e enviar a prova de conclusão.
                    </p>
                  </div>

                  {!showSubmitForm ? (
                    <Button
                      onClick={() => setShowSubmitForm(true)}
                      className="w-full text-white"
                      style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Enviar Prova de Conclusão
                    </Button>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="proofUrl" style={{ color: '#3c0b14' }}>
                          <LinkIcon className="w-4 h-4 inline mr-1" />
                          Link da Prova
                        </Label>
                        <Input
                          id="proofUrl"
                          type="url"
                          placeholder="Cole o link do post, vídeo, etc."
                          value={proofUrl}
                          onChange={(e) => setProofUrl(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="file" style={{ color: '#3c0b14' }}>
                          <Upload className="w-4 h-4 inline mr-1" />
                          Ou envie um arquivo
                        </Label>
                        <Input
                          id="file"
                          type="file"
                          accept="image/*,video/*,.pdf"
                          onChange={(e) => setFile(e.target.files[0])}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" style={{ color: '#3c0b14' }}>Descrição (opcional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Adicione observações sobre a tarefa..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="h-24"
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowSubmitForm(false)}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 text-white"
                          style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                          disabled={submitTaskMutation.isPending}
                        >
                          {submitTaskMutation.isPending ? 'Enviando...' : 'Enviar Prova'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Prova enviada */}
              {isClaimed && !isCompleted && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#0077ad10', borderColor: '#0077ad' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: '#0077ad' }}>
                      ✓
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#0077ad' }}>Prova Enviada!</h3>
                      <p className="text-sm" style={{ color: '#929292' }}>Aguardando aprovação</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'white' }}>
                    <p className="text-sm" style={{ color: '#929292' }}>
                      Sua prova foi enviada com sucesso e está sendo analisada pelo administrador.
                    </p>
                  </div>
                </div>
              )}

              {/* Concluída */}
              {isCompleted && (
                <div className="p-6 rounded-xl text-center" style={{ background: '#00c33120' }}>
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-3" style={{ color: '#00c331' }} />
                  <h3 className="font-bold text-lg mb-1" style={{ color: '#00c331' }}>Tarefa Concluída!</h3>
                  <p className="text-sm" style={{ color: '#929292' }}>Parabéns! Sua tarefa foi aprovada.</p>
                </div>
              )}

              {/* Não aprovado (candidatura rejeitada) - PERMITE TENTAR DE NOVO */}
              {isRejected && !isApproved && !isSubmissionRejected && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#ce161c10', borderColor: '#ce161c' }}>
                  <p className="font-medium mb-2" style={{ color: '#ce161c' }}>Candidatura não aprovada</p>
                  <p className="text-sm mb-2" style={{ color: '#3c0b14' }}>
                    Mas você pode tentar de novo!
                  </p>

                  {!showApplicationForm ? (
                    <Button
                      onClick={() => setShowApplicationForm(true)}
                      className="w-full mt-4 text-white"
                      style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                      disabled={isFull}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isFull ? 'Vagas Esgotadas' : 'Tentar Novamente'}
                    </Button>
                  ) : (
                    <form onSubmit={handleAcceptTask} className="space-y-4 mt-4">
                      <p className="text-sm" style={{ color: '#929292' }}>
                        Clique abaixo para aceitar novamente esta tarefa
                      </p>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowApplicationForm(false)}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 text-white"
                          style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                          disabled={acceptTaskMutation.isPending}
                        >
                          {acceptTaskMutation.isPending ? 'Aceitando...' : 'Aceitar Tarefa'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Prova rejeitada - PERMITE TENTAR DE NOVO */}
              {isSubmissionRejected && (
                <div className="p-6 rounded-xl border-2" style={{ background: '#ce161c10', borderColor: '#ce161c' }}>
                  <p className="font-medium mb-2" style={{ color: '#ce161c' }}>Ops, sua tarefa não foi aprovada</p>
                  <p className="text-sm mb-2" style={{ color: '#3c0b14' }}>
                    Mas você pode tentar de novo!
                  </p>
                  <p className="text-sm mb-3" style={{ color: '#929292' }}>
                    Para checar o motivo, vá em <span className="font-semibold">Minhas Submissões → Rejeitada</span>
                  </p>

                  {!showSubmitForm ? (
                    <Button
                      onClick={() => setShowSubmitForm(true)}
                      className="w-full text-white"
                      style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="proofUrl" style={{ color: '#3c0b14' }}>
                          <LinkIcon className="w-4 h-4 inline mr-1" />
                          Link da Prova
                        </Label>
                        <Input
                          id="proofUrl"
                          type="url"
                          placeholder="Cole o link do post, vídeo, etc."
                          value={proofUrl}
                          onChange={(e) => setProofUrl(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="file" style={{ color: '#3c0b14' }}>
                          <Upload className="w-4 h-4 inline mr-1" />
                          Ou envie um arquivo
                        </Label>
                        <Input
                          id="file"
                          type="file"
                          accept="image/*,video/*,.pdf"
                          onChange={(e) => setFile(e.target.files[0])}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" style={{ color: '#3c0b14' }}>Descrição (opcional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Adicione observações sobre a tarefa..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="h-24"
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowSubmitForm(false)}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 text-white"
                          style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}
                          disabled={submitTaskMutation.isPending}
                        >
                          {submitTaskMutation.isPending ? 'Enviando...' : 'Enviar Prova'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Vagas esgotadas */}
              {isFull && !userApplication && !isCompleted && (
                <div className="p-6 rounded-xl text-center border-2" style={{ background: '#ce161c10', borderColor: '#ce161c' }}>
                  <p className="font-medium mb-1" style={{ color: '#ce161c' }}>Vagas Esgotadas</p>
                  <p className="text-sm" style={{ color: '#929292' }}>
                    Não há mais vagas disponíveis para esta tarefa.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>


        </>
        );
        }