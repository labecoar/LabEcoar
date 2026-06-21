// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions } from "@/hooks/useMetrics";
import { useUserScore } from "@/hooks/useScores";
import { Clock, CheckCircle, XCircle, Star, ExternalLink, CircleDollarSign, FileCheck, Plus, AlertCircle, Upload, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskDetailsModal from "../components/tasks/TaskDetailsModal";
import { getProofApprovalMetricsWindow, getMetricsResubmissionDeadline } from '@/lib/metrics-window';
import { C, heading, body } from '@/lib/theme';
import { createPageUrl } from "@/utils";

const normalizeSubmissionStatus = (status) => {
  if (status === 'pendente') return 'pending';
  if (status === 'aprovada') return 'approved';
  if (status === 'rejeitada') return 'rejected';
  return status;
};

const CATEGORY_NAMES = {
  campanha: 'Campanha',
  resposta_rapida: 'Resposta Rápida',
  oficina: 'Oficina',
  folhetim: 'Folhetim',
  compartilhar_ecoante: 'Compartilhar Ecoante',
  sidequest_teste: 'Missão',
};

const CATEGORY_COLORS = {
  campanha: 'bg-green-100 text-green-700 border-green-200',
  resposta_rapida: 'bg-orange-100 text-orange-700 border-orange-200',
  oficina: 'bg-purple-100 text-purple-700 border-purple-200',
  folhetim: 'bg-blue-100 text-blue-700 border-blue-200',
  compartilhar_ecoante: 'bg-pink-100 text-pink-700 border-pink-200',
  sidequest_teste: 'bg-amber-100 text-amber-700 border-amber-200',
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function ProofPreview({ proofUrl }) {
  if (!proofUrl) return null;

  return (
    <div className="pt-2">
      <a
        href={proofUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-900 underline"
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalLink className="w-4 h-4" />
        Ver anexo
      </a>
    </div>
  );
}

export default function MySubmissions() {
  const navigate = useNavigate();
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [activeTab, setActiveTab] = useState('todas');
  const { user } = useAuth();
  const { data: submissions = [], isLoading, error } = useMySubmissions(user?.id);
  const { data: myMetricsSubmissions = [] } = useMyMetricsSubmissions(user?.id);
  const { data: userScore } = useUserScore(user?.id);

  const getSubmissionTaskId = (submission) => {
    return submission?.task_id || submission?.task?.id || null;
  };

  const getCampaignMetricsStatus = (submission) => {
    const taskId = getSubmissionTaskId(submission);
    if (!taskId) return null;

    const metricsSubmission = myMetricsSubmissions.find((item) => String(item.task_id) === String(taskId));
    return String(metricsSubmission?.status || '').trim().toLowerCase() || null;
  };

  const getCampaignMetricsWindowEnd = (submission) => {
    return getProofApprovalMetricsWindow(submission?.validated_at || submission?.updated_at).end;
  };

  const getCampaignMetricsResubmissionDeadline = (submission) => {
    const taskId = getSubmissionTaskId(submission);
    if (!taskId) return null;

    const metricsSubmission = myMetricsSubmissions.find((item) => String(item.task_id) === String(taskId));
    const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();
    if (metricsStatus !== 'rejected') return null;

    return getMetricsResubmissionDeadline(metricsSubmission?.reviewed_at);
  };

  const isCampaignWithPendingMetrics = (submission) => {
    const status = normalizeSubmissionStatus(submission?.status);
    const isCampaign = submission?.task?.category === 'campanha';
    if (!isCampaign || status !== 'approved') return false;

    const metricsStatus = getCampaignMetricsStatus(submission);
    return metricsStatus !== 'approved';
  };

  const isExpiredSubmission = (submission) => {
    const status = normalizeSubmissionStatus(submission?.status);
    const taskCategory = submission?.task?.category;

    if (taskCategory === 'campanha' && status === 'approved') {
      const metricsStatus = getCampaignMetricsStatus(submission);

      if (metricsStatus === 'approved') return false;

      const metricsWindowEnd = getCampaignMetricsWindowEnd(submission);
      const resubmissionDeadline = getCampaignMetricsResubmissionDeadline(submission);
      const deadline = resubmissionDeadline || metricsWindowEnd;

      if (!deadline) return false;

      return deadline.getTime() < Date.now();
    }

    const expiresAt = toDateOrNull(submission?.task?.expires_at);
    if (!expiresAt) return false;

    return expiresAt.getTime() < Date.now();
  };

  const pendingSubmissions = submissions.filter((s) => {
    if (isExpiredSubmission(s)) return false;
    const status = normalizeSubmissionStatus(s.status);
    return ['pending', 'application_pending', 'application_approved', 'proof_pending'].includes(status)
      || isCampaignWithPendingMetrics(s);
  });
  const approvedSubmissions = submissions.filter((s) => {
    if (isExpiredSubmission(s)) return false;
    const status = normalizeSubmissionStatus(s.status);
    if (status !== 'approved') return false;
    return !isCampaignWithPendingMetrics(s);
  });
  const rejectedSubmissions = submissions.filter((s) => {
    if (isExpiredSubmission(s)) return false;
    const status = normalizeSubmissionStatus(s.status);
    return ['application_rejected', 'rejected'].includes(status);
  });
  const expiredSubmissions = submissions.filter((s) => isExpiredSubmission(s));

  let visibleSubmissions = submissions;
  if (activeTab === 'aprovadas') visibleSubmissions = approvedSubmissions;
  if (activeTab === 'andamento') visibleSubmissions = pendingSubmissions;
  if (activeTab === 'rejeitadas') visibleSubmissions = rejectedSubmissions;
  if (activeTab === 'expiradas') visibleSubmissions = expiredSubmissions;

  visibleSubmissions = [...visibleSubmissions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalPts = approvedSubmissions.reduce((a, s) => a + (Number(s.points_awarded || s.task?.points) || 0), 0);

  const getStatusDisplay = (submission) => {
    const isExpired = isExpiredSubmission(submission);
    if (isExpired) return { bg: `rgba(255,255,216,0.07)`, color: `${C.cream}80`, label: 'Expirada', icon: Clock };
    
    const status = normalizeSubmissionStatus(submission.status);
    const isApprovedCampaign = status === 'approved' && submission?.task?.category === 'campanha';
    const metricsStatus = isApprovedCampaign ? getCampaignMetricsStatus(submission) : null;

    if (status === 'approved') {
        if (isApprovedCampaign) {
            if (metricsStatus === 'approved') return { bg: `${C.lime}1A`, color: C.lime, label: 'Concluída', icon: Check };
            if (metricsStatus === 'pending') return { bg: `rgba(68,102,255,0.12)`, color: "#8899FF", label: 'Métricas em análise', icon: Clock };
            if (metricsStatus === 'rejected') return { bg: `${C.orange}1A`, color: C.orange, label: 'Reenviar métricas', icon: AlertCircle };
            return { bg: `rgba(170,102,255,0.12)`, color: "#AA66FF", label: 'Pendente métricas', icon: Clock };
        }
        return { bg: `${C.lime}1A`, color: C.lime, label: 'Aprovada', icon: Check };
    }
    
    if (['application_rejected', 'rejected'].includes(status)) {
        return { bg: "rgba(255,34,85,0.14)", color: "#FF2255", label: 'Rejeitada', icon: XCircle };
    }

    if (status === 'proof_pending') return { bg: `rgba(68,102,255,0.12)`, color: "#8899FF", label: 'Prova em análise', icon: Clock };
    if (status === 'application_approved') return { bg: `rgba(170,102,255,0.12)`, color: "#AA66FF", label: 'Aprovado p/ fazer', icon: Clock };
    
    return { bg: `${C.orange}1A`, color: C.orange, label: 'Em análise', icon: Clock };
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: C.black, display: "flex", alignItems: "center", justifyItems: "center" }}>
        <div style={{ textAlign: "center", margin: "auto" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: `2px solid ${C.lime}`, borderTopColor: "transparent",
            margin: "0 auto 16px", animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: `${C.cream}45`, fontSize: 14 }}>Carregando submissões...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: C.black, ...body, padding: "32px" }}>
        <div className="max-w-6xl mx-auto">
          <div className="p-8 rounded-2xl" style={{ backgroundColor: "rgba(255,34,85,0.08)", border: "1px solid rgba(255,34,85,0.2)" }}>
            <h3 style={{ ...heading, fontSize: 18, color: "#FF2255", marginBottom: 8 }}>Erro ao carregar submissões</h3>
            <p style={{ color: "rgba(255,34,85,0.8)", fontSize: 14 }}>{error?.message || 'Não foi possível carregar seu histórico agora.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.black, ...body }}>
      {/* Header Fixo */}
      <div className="flex items-center justify-between px-8 py-4 sticky top-0 z-10" style={{ backgroundColor: `${C.black}F5`, backdropFilter: "blur(16px)", borderBottom: `1px solid rgba(255,255,222,0.05)` }}>
        <div className="flex items-center gap-3">
          <FileCheck size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Minhas Submissões</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.black }}>
          <Star size={11} fill={C.black} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{userScore?.total_points || 0} pts</span>
        </div>
      </div>

      <div className="px-8 pt-7 pb-10 max-w-6xl mx-auto">
        {/* Hero */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 style={{ ...heading, fontSize: 40, fontWeight: 900, color: C.cream, letterSpacing: "-0.03em", lineHeight: 1 }}>Minhas Submissões</h1>
            <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>Acompanhe o status de cada envio.</p>
          </div>
          <button
            onClick={() => navigate(createPageUrl("Tasks"))}
            className="flex items-center gap-2 px-5 py-3 rounded-xl transition-all hover:brightness-110"
            style={{ backgroundColor: C.lime, color: C.black, ...heading, fontWeight: 700, fontSize: 13 }}
          >
            <Plus size={15} /> Nova Submissão
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          {[
            { label: "Total enviadas",   value: submissions.length, color: C.cream  },
            { label: "Aprovadas",        value: approvedSubmissions.length, color: C.lime   },
            { label: "Em andamento",     value: pendingSubmissions.length, color: `${C.cream}80` },
            { label: "Pontos ganhos",    value: `${totalPts} pts`, color: C.lime   },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-5 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
              <div style={{ ...heading, fontSize: 28, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
              <div style={{ fontSize: 11, color: `${C.cream}45`, marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {["todas", "aprovadas", "andamento", "rejeitadas", "expiradas"].map((f) => {
            const active = f === activeTab;
            const label = f.charAt(0).toUpperCase() + f.slice(1);
            return (
              <button key={f} onClick={() => setActiveTab(f)} className="shrink-0 px-4 py-2 rounded-xl text-sm transition-all duration-150" style={{ backgroundColor: active ? C.lime : "rgba(255,255,222,0.06)", color: active ? C.black : `${C.cream}70`, fontWeight: active ? 700 : 400, ...heading, fontSize: 13 }}>
                {label === "Andamento" ? "Em andamento" : label}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="flex flex-col gap-3">
          {visibleSubmissions.map((sub) => {
            const { bg, color, label, icon: Icon } = getStatusDisplay(sub);
            const isPaid = sub.task?.category === 'campanha' || Number(sub.task?.offered_value || 0) > 0;
            const pointsOrValue = isPaid ? `R$ ${Number(sub.task?.offered_value || 0).toLocaleString('pt-BR')}` : `+${Number(sub.points_awarded || sub.task?.points || 0)}`;

            return (
              <div key={sub.id} onClick={() => setSelectedSubmission(sub)} className="flex items-center gap-5 p-5 rounded-2xl transition-all hover:brightness-110 cursor-pointer" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
                {/* Status dot */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg, color }}>
                  <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.cream, marginBottom: 3 }} className="truncate">{sub.task?.title || 'Tarefa'}</div>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 11, color: `${C.cream}40` }}>{format(new Date(sub.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "rgba(255,255,222,0.06)", color: `${C.cream}55` }}>{CATEGORY_NAMES[sub.task?.category] || sub.task?.category}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div style={{ ...heading, fontSize: 18, fontWeight: 800, color: label === "Aprovada" || label === "Concluída" ? C.lime : `${C.cream}30`, lineHeight: 1 }}>{pointsOrValue}</div>
                    <div style={{ fontSize: 10, color: `${C.cream}30`, marginTop: 2 }}>{isPaid ? 'previstos' : 'pts'}</div>
                  </div>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: bg, color }}>
                    <Icon size={12} />
                    {label}
                  </span>
                  {sub.proof_url && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(sub.proof_url, '_blank', 'noopener,noreferrer');
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-100 opacity-40" 
                        style={{ backgroundColor: "rgba(255,255,222,0.06)", color: C.cream }}
                    >
                      <ExternalLink size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visibleSubmissions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Upload size={36} style={{ color: `${C.cream}20` }} />
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>Nenhuma submissão encontrada.</p>
          </div>
        )}
      </div>

      {selectedSubmission && (
        <TaskDetailsModal
          task={selectedSubmission.task || { id: selectedSubmission.task_id, title: 'Tarefa' }}
          onClose={() => setSelectedSubmission(null)}
          isTaskClaimed={['application_pending', 'application_approved', 'proof_pending', 'pending'].includes(normalizeSubmissionStatus(selectedSubmission.status))}
          isTaskApproved={normalizeSubmissionStatus(selectedSubmission.status) === 'approved'}
          currentSubmission={selectedSubmission}
        />
      )}
    </div>
  );
}
