// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/useTasks";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions } from "@/hooks/useMetrics";
import { useUserScore } from "@/hooks/useScores";
import { Badge } from "@/components/ui/badge";
import {
  Target, Users, Calendar, Clock, CheckCircle2,
  Star, CircleDollarSign, Megaphone, Zap, BookOpen, Share2,
  Sparkles, SlidersHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskDetailsModal from "../components/tasks/TaskDetailsModal";
import { getProofMetricsWindowFromSubmission, getMetricsResubmissionDeadline } from '@/lib/metrics-window';
import { C, heading, body } from '@/lib/theme';
import { formatLaunchDateTime, isTaskScheduled } from '@/lib/task-scheduling';

const BORDER_COLOR = "rgba(255,255,222,0.07)";
const MUTED_COLOR = "rgba(255,255,222,0.45)";
const GHOST_BG = "rgba(255,255,222,0.06)";

// ─── Mapeamentos de categoria ────────────────────────────────────────────────
const CATEGORY_ICONS = {
  campanha: Megaphone,
  resposta_rapida: Zap,
  oficina: BookOpen,
  folhetim: Share2,
  compartilhar_ecoante: Users,
  sidequest_teste: Target,
};

export const CATEGORY_ACCENT = {
  campanha: C.lime,
  resposta_rapida: C.orange,
  oficina: C.purple,
  folhetim: C.blue,
  compartilhar_ecoante: C.pink,
  sidequest_teste: C.cyan,
};

const CATEGORY_NAMES = {
  campanha: "Campanha",
  resposta_rapida: "Resposta Rápida",
  oficina: "Oficina",
  folhetim: "Folhetim",
  compartilhar_ecoante: "Compartilhar",
  sidequest_teste: "Missão",
};

// ─── Helpers de lógica (inalterados) ────────────────────────────────────────
const normalizeSubmissionStatus = (status) => {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  if (normalized === 'pendente') return 'pending';
  if (normalized === 'aprovada' || normalized === 'aprovado' || normalized === 'concluida' || normalized === 'concluído') return 'approved';
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'rejected';
  if (normalized === 'em_analise' || normalized === 'em análise') return 'proof_pending';
  return normalized;
};

const getSubmissionTaskId = (submission) =>
  submission?.task_id || submission?.task?.id || submission?.taskId || null;

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isBusinessDay = (date) => {
  if (!date) return false;
  const weekDay = date.getDay();
  return weekDay !== 0 && weekDay !== 6;
};

const firstBusinessDayOnOrAfter = (baseDate) => {
  if (!baseDate) return null;
  const result = new Date(baseDate);
  while (!isBusinessDay(result)) result.setDate(result.getDate() + 1);
  return result;
};

const resolveProofDeadline = (task) => {
  if (task?.category === 'campanha') {
    const postingDeadline = toDateOrNull(task?.posting_deadline);
    if (postingDeadline) return postingDeadline;
  }
  return toDateOrNull(task?.expires_at)
    || toDateOrNull(task?.posting_deadline)
    || toDateOrNull(task?.delivery_deadline)
    || null;
};

const isAutoExpiredSubmissionRejection = (submission) => {
  if (!submission) return false;
  const status = normalizeSubmissionStatus(submission.status);
  if (!['application_rejected', 'rejected'].includes(status)) return false;
  const reason = String(submission.rejection_reason || '').trim().toLowerCase();
  if (!reason) return false;
  return reason.includes('prazo de envio da prova expirou')
    || reason.includes('vaga cancelada por inatividade')
    || reason.includes('primeira tentativa de envio da prova');
};

const getDeadlineState = (expiresAtValue) => {
  if (!expiresAtValue) return { expiresAt: null, isExpired: false, isCritical: false, isWarning: false, timeLabel: 'Sem data' };
  const expiresAt = new Date(expiresAtValue);
  if (Number.isNaN(expiresAt.getTime())) return { expiresAt: null, isExpired: false, isCritical: false, isWarning: false, timeLabel: 'Data inválida' };
  const diffMs = expiresAt.getTime() - Date.now();
  const isExpired = diffMs <= 0;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const threeDaysMs = 3 * oneDayMs;
  if (isExpired) return { expiresAt, isExpired: true, isCritical: false, isWarning: false, timeLabel: 'Expirada' };
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

// ─── Componente principal ────────────────────────────────────────────────────
export default function Tasks() {
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [selectedTask, setSelectedTask] = useState(null);
  const { user, profile } = useAuth();
  const { data: allTasks = [], isLoading } = useTasks();
  const { data: mySubmissions = [] } = useMySubmissions(user?.id);
  const { data: myMetricsSubmissions = [] } = useMyMetricsSubmissions(user?.id);
  const { data: userScore } = useUserScore(user?.id);
  const currentPoints = userScore?.total_points || 0;

  const getTaskSubmission = (taskId) =>
    mySubmissions.find((sub) => String(getSubmissionTaskId(sub)) === String(taskId)) || null;

  const getTaskMetricsSubmission = (taskId) =>
    myMetricsSubmissions.find((item) => String(item.task_id) === String(taskId)) || null;

  const shouldHideTaskFromAvailable = (task) => {
    const submission = getTaskSubmission(task.id);
    const submissionStatus = normalizeSubmissionStatus(submission?.status);
    return ['application_pending', 'pending', 'application_approved', 'application_rejected', 'proof_pending', 'approved', 'rejected'].includes(submissionStatus);
  };

  const shouldKeepCampaignVisibleForMetrics = (task) => {
    if (task?.category !== 'campanha') return false;
    const submission = getTaskSubmission(task.id);
    const submissionStatus = normalizeSubmissionStatus(submission?.status);
    if (submissionStatus !== 'approved') return false;
    const metricsSubmission = getTaskMetricsSubmission(task.id);
    const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();
    const now = Date.now();
    const metricsWindowEnd = getProofMetricsWindowFromSubmission(submission).end;

    if (!metricsSubmission) {
      if (!metricsWindowEnd) return true;
      return now <= new Date(metricsWindowEnd).getTime(); // ← corrigido
    }
    if (metricsStatus === 'pending') return true;
    if (metricsStatus === 'approved') return false;
    if (metricsStatus === 'rejected') {
      const resubmissionDeadline = getMetricsResubmissionDeadline(metricsSubmission?.reviewed_at);
      if (!resubmissionDeadline) return true;
      return now <= new Date(resubmissionDeadline).getTime(); // ← corrigido
    }
    return false;
  };

  const tasks = allTasks.filter(task => {
    if (shouldHideTaskFromAvailable(task)) return false;
    if (task.expires_at && new Date(task.expires_at) < new Date() && !shouldKeepCampaignVisibleForMetrics(task)) return false;
    if (task.min_followers) {
      const userFollowers = profile?.followers_count || 0;
      if (userFollowers < task.min_followers) return false;
    }
    return true;
  });

  const filteredTasks = (() => {
    if (selectedCategory === "todas") return tasks;
    if (selectedCategory === "agendadas") return tasks.filter(task => isTaskScheduled(task));
    return tasks.filter((task) => task.category === selectedCategory);
  })();

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

  const shouldShowExpiredStatus = (task, submission) => {
    if (!isAutoExpiredSubmissionRejection(submission)) return false;
    const proofDeadline = resolveProofDeadline(task);
    if (!proofDeadline) return false;
    return Date.now() > proofDeadline.getTime();
  };

  const isSubmissionReopenedByDateChange = (task, submission) => {
    if (!isAutoExpiredSubmissionRejection(submission)) return false;
    const proofDeadline = resolveProofDeadline(task);
    if (!proofDeadline) return false;
    return Date.now() <= proofDeadline.getTime();
  };

  const getTaskSteps = (task, submission) => {
    const steps = [];
    steps.push({ label: "Candidatar-se", date: task.posting_deadline || null });
    steps.push({ label: "Enviar link da tarefa", date: task.posting_deadline || task.expires_at || null });
    if (task.category === 'campanha') {
      const submissionStatus = normalizeSubmissionStatus(submission?.status);
      let metricsDate = null;
      let estimated = false;

      if (submissionStatus === 'approved') {
        const window = getProofMetricsWindowFromSubmission(submission);
        metricsDate = window?.end || null;
      } else {
        const baseDate = task.posting_deadline || task.expires_at || null;
        if (baseDate) {
          const window = getProofMetricsWindowFromSubmission({ proof_submitted_at: baseDate, validated_at: baseDate });
          metricsDate = window?.end || null;
          estimated = true;
        }
      }

      steps.push({ label: "Enviar métricas", date: metricsDate, estimated });
    }
    return steps;
  };

  const getCompletedStepsCount = (task, submission, metricsSubmission) => {
    const submissionStatus = normalizeSubmissionStatus(submission?.status);
    const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();
    let completed = 0;

    if (submission) completed++;

    if (['proof_pending', 'approved'].includes(submissionStatus)) completed++;
    if (task.category === 'campanha' && metricsStatus === 'approved') completed++;

    return completed;
  };

  const formatFollowersCount = (count) => {
    const num = Number(count) || 0;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1)}K`;
    return `${num}`;
  };

  // ─── TaskCard ──────────────────────────────────────────────────────────────
  const TaskCard = ({ task, index }) => {
    const COLUMN_COLORS = [
      { color: C.blue, bg: C.blue_back },
      { color: C.orange, bg: C.orange_back },
      { color: C.lime, bg: C.lime_back },
    ];
    const columnColor = COLUMN_COLORS[index % COLUMN_COLORS.length];
    const accent = columnColor.color;
    const accentBg = columnColor.bg;
    const submission = getTaskSubmission(task.id);
    const metricsSubmission = getTaskMetricsSubmission(task.id);
    const steps = getTaskSteps(task, submission);
    const completedSteps = getCompletedStepsCount(task, submission, metricsSubmission);
    const Icon = CATEGORY_ICONS[task.category] || Target;
    const accentText = accent === C.lime ? C.black : C.cream;
    const isCampaignTask = task.category === 'campanha';
    const isPaidTask = task.category === 'campanha' || Number(task.offered_value || 0) > 0;
    const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();
    const submissionStatus = normalizeSubmissionStatus(submission?.status);
    const claimed = isTaskClaimed(task.id);
    const approved = isTaskApproved(task.id);
    const rejected = isTaskRejected(task.id);
    const deadline = getDeadlineState(task.expires_at);
    const isExpiredByRule = shouldShowExpiredStatus(task, submission);
    const reopenedByDateChange = isSubmissionReopenedByDateChange(task, submission);
    const isScheduled = isTaskScheduled(task);
    const launchLabel = isScheduled ? formatLaunchDateTime(task.launch_at) : null;
    const StatusBadge = () => {
      const base = {
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, flexShrink: 0,
      };

      if (approved) {
        if (isCampaignTask) {
          if (metricsStatus === 'approved')
            return <span style={{ ...base, background: "rgba(204,255,68,0.12)", color: C.lime }}><CheckCircle2 size={11} /> Concluída</span>;
          if (metricsStatus === 'pending')
            return <span style={{ ...base, background: "rgba(68,102,255,0.12)", color: "#8899FF" }}><Clock size={11} /> Métricas em análise</span>;
          if (metricsStatus === 'rejected')
            return <span style={{ ...base, background: "rgba(255,136,51,0.12)", color: C.orange }}><Clock size={11} /> Reenviar métricas</span>;
          return <span style={{ ...base, background: "rgba(170,102,255,0.12)", color: C.purple }}><Clock size={11} /> Pendente métricas</span>;
        }
        return <span style={{ ...base, background: "rgba(204,255,68,0.12)", color: C.lime }}><CheckCircle2 size={11} /> Concluída</span>;
      }
      if (isExpiredByRule)
        return <span style={{ ...base, background: "rgba(255,255,216,0.07)", color: MUTED_COLOR }}>Expirada</span>;
      if (submissionStatus === 'proof_pending')
        return <span style={{ ...base, background: "rgba(68,102,255,0.12)", color: "#8899FF" }}><Clock size={11} /> Prova em Análise</span>;
      if (submissionStatus === 'application_approved')
        return <span style={{ ...base, background: "rgba(170,102,255,0.12)", color: C.purple }}><Clock size={11} /> Aprovado p/ Fazer</span>;
      if (claimed)
        return (
          <span style={{ ...base, background: "rgba(255,136,51,0.12)", color: C.orange }}>
            <Clock size={11} />
            {task.category === 'sidequest_teste' && submissionStatus === 'application_pending'
              ? 'Aguardando prova' : 'Inscrição em Análise'}
          </span>
        );
      if (rejected && !reopenedByDateChange)
        return <span style={{ ...base, background: "rgba(255,34,85,0.12)", color: "#FF2255" }}>Rejeitada</span>;
      if (submission && !reopenedByDateChange)
        return <span style={{ ...base, background: "rgba(255,255,216,0.07)", color: MUTED_COLOR }}>Em andamento</span>;
      if (isScheduled)
        return <span style={{ ...base, background: "rgba(170,102,255,0.12)", color: C.purple }}><Calendar size={11} /> Em breve</span>;
      return <span style={{ ...base, background: "rgba(204,255,68,0.12)", color: C.lime }}>Disponível</span>;
    };

    return (
      <div
        onClick={() => setSelectedTask(task)}
        style={{
          background: isScheduled ? 'rgba(170,102,255,0.06)' : C.card,
          borderRadius: 16,
          border: `1px solid ${isScheduled ? 'rgba(170,102,255,0.22)' : BORDER_COLOR}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          cursor: "pointer",
          transition: "all 0.2s",
          opacity: isScheduled ? 0.88 : 1,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = isScheduled ? "rgba(170,102,255,0.35)" : "rgba(204,255,68,0.25)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = isScheduled ? "rgba(170,102,255,0.22)" : BORDER_COLOR;
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* Faixa de acento */}
        <div style={{ height: 3, background: isScheduled ? C.purple : accent, flexShrink: 0 }} />

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          {isScheduled && launchLabel && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(170,102,255,0.12)",
              border: "1px solid rgba(170,102,255,0.18)",
              color: C.purple,
              fontSize: 12,
              fontWeight: 600,
            }}>
              <Calendar size={12} />
              Agendada para {launchLabel}
            </div>
          )}
          {/* Topo: emoji + destaque + pts */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {task.min_followers && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,216,0.06)", color: MUTED_COLOR, fontSize: 12, fontWeight: 500 }}>
                  <Users size={11} /> {formatFollowersCount(task.min_followers)}+ seguidores
                </span>
              )}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, flexShrink: 0,
              background: isPaidTask ? "rgba(255,136,51,0.15)" : C.lime_back,
              color: isPaidTask ? C.orange : C.lime,
            }}>
              {isPaidTask
                ? <CircleDollarSign size={11} />
                : <Star size={10} style={{ fill: C.lime }} />
              }
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {isPaidTask
                  ? `R$ ${Number(task.offered_value || 0).toLocaleString('pt-BR')}`
                  : `${Number(task.points || 0).toLocaleString('pt-BR')} pts`}
              </span>
            </div>
          </div>

          {/* Formatos de conteúdo */}
          {Array.isArray(task.content_formats) && task.content_formats.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {task.content_formats.map(fmt => (
                <span key={fmt} style={{ padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: accentBg, color: accent }}>
                  {fmt}
                </span>
              ))}
            </div>
          )}

          {/* Título + descrição */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.cream, letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: 6 }}>
              {task.title}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,216,0.45)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {task.description}
            </div>
          </div>

          {/* Data limite + vagas */}
          <div className="flex items-center gap-3">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: MUTED_COLOR }}>
              <Clock size={10} />
              {(() => {
                const dateVal = task.posting_deadline || task.expires_at || task.delivery_deadline;
                if (!dateVal) return <span style={{ color: MUTED_COLOR }}>—</span>;
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) return <span style={{ color: MUTED_COLOR }}>—</span>;
                return format(d, "dd/MM/yyyy");
              })()}
            </span>
            {task.max_participants && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: MUTED_COLOR }}>
                <Users size={10} /> {task.current_participants || 0}/{task.max_participants}
              </span>
            )}
          </div>

          {/* Mini cronograma */}
          {steps.length > 0 && (
            <div style={{ paddingTop: 10, borderTop: `1px solid ${BORDER_COLOR}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: MUTED_COLOR, textTransform: "uppercase", letterSpacing: "0.1em" }}>Cronograma</span>
                <span style={{ fontSize: 10, color: MUTED_COLOR }}>{completedSteps}/{steps.length} etapas</span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,222,0.06)", marginBottom: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, width: `${(completedSteps / steps.length) * 100}%`, background: accent, transition: "width 0.3s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: i < completedSteps ? accent : "rgba(255,255,222,0.07)",
                      border: i === completedSteps ? `1px solid ${accent}` : "none",
                    }}>
                      {i < completedSteps
                        ? <CheckCircle2 size={9} color={accentText} />
                        : <span style={{ fontSize: 8, fontWeight: 800, color: i === completedSteps ? accent : MUTED_COLOR }}>{i + 1}</span>
                      }
                    </div>
                    <span style={{ fontSize: 11, color: i < completedSteps ? `${C.cream}90` : MUTED_COLOR }}>
                      {step.label}
                      {step.date && (
                        <span style={{ color: `${C.cream}30` }}>
                          {" "}até {format(new Date(step.date), "dd/MM/yyyy 'às' HH:mm")}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${BORDER_COLOR}` }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: accentBg, color: accent, fontSize: 11, fontWeight: 600 }}>
              <Icon size={9} /> {CATEGORY_NAMES[task.category] || task.category}
            </span>
            <StatusBadge />
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: C.black, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: `2px solid ${C.lime}`, borderTopColor: "transparent",
            margin: "0 auto 16px", animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: MUTED_COLOR, fontSize: 14 }}>Carregando tarefas...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const FILTER_TABS = [
    { value: "todas", label: "Todas" },
    { value: "campanha", label: "Campanhas" },
    { value: "resposta_rapida", label: "Respostas Rápidas" },
    { value: "oficina", label: "Oficinas" },
    { value: "folhetim", label: "Folhetins" },
    { value: "compartilhar_ecoante", label: "Compartilhar" },
    { value: "sidequest_teste", label: "Missões" },
    { value: "agendadas", label: "Agendadas" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.black, ...body }}>
      {/* Header fixo */}
      <div className="flex items-center justify-between px-8 py-4 sticky top-0 z-10" style={{ backgroundColor: `${C.black}F5`, backdropFilter: "blur(16px)", borderBottom: `1px solid rgba(255,255,222,0.05)` }}>
        <div className="flex items-center gap-3">
          <Target size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Tarefas Disponíveis
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,222,0.06)", color: `${C.cream}70` }}>
            <SlidersHorizontal size={11} />
            <span style={{ fontSize: 12 }}>{filteredTasks.length} {filteredTasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.black }}>
            <Star size={11} fill={C.black} />
            <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{currentPoints} pts</span>
          </div>
        </div>
      </div>

      <div className="px-8 pt-7 pb-10 max-w-6xl mx-auto">
        {/* Título */}
        <div className="mb-6">
          <h1 style={{ ...heading, fontSize: 40, fontWeight: 900, color: C.cream, letterSpacing: "-0.03em", lineHeight: 1 }}>
            Tarefas Disponíveis
          </h1>
          <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }} className="flex items-center gap-2">
            Escolha uma tarefa e ganhe pontos!
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${C.lime_back}`, color: C.lime }}>
              +{filteredTasks.reduce((a, t) => a + (Number(t.points) || 0), 0)} pts disponíveis
            </span>
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-7 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {FILTER_TABS.map(tab => {
            const active = selectedCategory === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setSelectedCategory(tab.value)}
                className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
                style={{
                  backgroundColor: active ? C.lime : "rgba(255,255,222,0.06)",
                  color: active ? C.black : `${C.cream}70`,
                  fontWeight: active ? 700 : 400,
                  ...heading,
                  fontSize: 13,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Grid ou empty state */}
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Target size={56} color="rgba(255,255,216,0.2)" />
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>
              {selectedCategory === "todas" ? "Nenhuma tarefa disponível no momento." : "Nenhuma tarefa nessa categoria."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          isTaskClaimed={isTaskClaimed(selectedTask.id)}
          isTaskApproved={isTaskApproved(selectedTask.id)}
          currentSubmission={getTaskSubmission(selectedTask.id)}
          cardIndex={filteredTasks.findIndex(t => t.id === selectedTask.id)}
        />
      )}
    </div>
  );
}