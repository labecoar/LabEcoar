// @ts-nocheck
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/useTasks";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { useUserScore, useUserScoreHistory, useGroupProgress } from "@/hooks/useScores";
import { Trophy, CheckCircle, Star, ChevronRight, Zap, FileCheck, ArrowUpRight, ExternalLink, CalendarDays } from "lucide-react";
import GroupProgress, { getGroupCategory } from "@/components/dashboard/GroupProgress";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getCurrentQuarterKey } from "@/services/scores.service";
import { C, heading, body } from '@/lib/theme';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageShell, PageHeader, PageContent } from "@/components/layout/PageShell";

const CATEGORY_VALUES = {
  voz_e_violao: 1000,
  dueto: 2000,
  fanfarra: 3500,
  carnaval: 4500
};

const getStatusChip = (status) => {
  const norm = String(status).toLowerCase();
  if (norm === 'approved') return { bg: 'rgba(204,255,68,0.12)', color: C.lime, label: 'Aprovada' };
  if (norm === 'rejected' || norm === 'application_rejected') return { bg: 'rgba(255,34,85,0.12)', color: '#FF2255', label: 'Rejeitada' };
  return { bg: 'rgba(var(--ink),0.08)', color: `rgba(var(--ink),0.8)`, label: 'Em análise' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [selectedQuarter, setSelectedQuarter] = React.useState(getCurrentQuarterKey());
  const { data: allTasks = [] } = useTasks();
  const { data: submissions = [] } = useMySubmissions(user?.id);
  const { data: userScore } = useUserScore(user?.id, selectedQuarter);
  const { data: userScoreHistory = [] } = useUserScoreHistory(user?.id, 10);
  const { data: groupProgress } = useGroupProgress(selectedQuarter);

  const approvedSubmissions = submissions.filter((s) => s.status === 'approved');
  const pendingSubmissions = submissions.filter((s) => ['pending', 'application_pending', 'proof_pending', 'application_approved'].includes(s.status));

  const totalCampaigns = React.useMemo(() => {
    return allTasks.filter(t => t.category === 'campanha').length;
  }, [allTasks]);

  const campaignsCompleted = React.useMemo(() => {
    const campaignSubmissions = approvedSubmissions.filter(sub => {
      const task = allTasks.find(t => t.id === sub.task_id);
      return task && task.category === 'campanha';
    });
    return Math.min(campaignSubmissions.length, totalCampaigns);
  }, [approvedSubmissions, allTasks, totalCampaigns]);

  const currentPoints = userScore?.total_points || 0;
  const collectivePoints = groupProgress?.collective_points || 0;
  const activeEcoantes = groupProgress?.active_ecoantes || 0;
  const currentCategory = profile?.current_category || 'voz_e_violao';
  const categoryValue = CATEGORY_VALUES[currentCategory] || 0;

  const activeCategory = getGroupCategory(collectivePoints, activeEcoantes || 1);

  const displayName = profile?.full_name?.split(' ')[0] || profile?.display_name?.split(' ')[0] || 'Ecoante';

  const quarterOptions = React.useMemo(() => {
    const keys = Array.from(new Set([getCurrentQuarterKey(), ...userScoreHistory.map((item) => item.quarter_key)].filter(Boolean)));
    return keys.sort((a, b) => {
      const [aQ, aYear] = String(a).split('-');
      const [bQ, bYear] = String(b).split('-');
      const aSort = Number(aYear) * 10 + Number(String(aQ).replace('Q', ''));
      const bSort = Number(bYear) * 10 + Number(String(bQ).replace('Q', ''));
      return bSort - aSort;
    });
  }, [userScoreHistory]);

  const TRIMESTRE_STATS = [
    { label: 'Aprovadas', value: approvedSubmissions.length, accent: C.lime, bg: C.card },
    { label: 'Em Análise', value: pendingSubmissions.length, accent: C.cream, bg: C.card },
    { label: 'Campanhas', value: profile?.campaigns_participated || 0, accent: C.orange, bg: C.darkGreen },
    { label: 'Seus Pontos', value: currentPoints, accent: C.lime, bg: C.card },
  ];

  const recentSubmissions = submissions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const lastApprovedProof = approvedSubmissions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.proof_url;

  return (
    <PageShell>
      <PageHeader>
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays size={14} className="shrink-0" style={{ color: C.lime }} />
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="bg-transparent outline-none cursor-pointer min-w-0 max-w-[140px] sm:max-w-none truncate"
            style={{ ...heading, fontSize: 13, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {quarterOptions.map((quarterKey) => (
              <option key={quarterKey} value={quarterKey} style={{ background: C.card, color: C.cream }}>
                {quarterKey}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full shrink-0" style={{ backgroundColor: C.lime, color: C.onAccent }}>
          <Star size={11} fill={C.onAccent} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{currentPoints} pts</span>
        </div>
      </PageHeader>

      <PageContent maxWidth="max-w-5xl" className="space-y-5 md:space-y-6">
        {/* BOAS VINDAS & PONTOS GERAIS */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 14, color: `${C.cream}50`, marginBottom: 4 }}>Olá,</p>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-black leading-none tracking-tight"
              style={{ ...heading, color: C.cream }}
            >
              {displayName}{" "}
              <span role="img" aria-label="wave" className="text-2xl sm:text-3xl md:text-4xl font-normal">👋</span>
            </h1>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span style={{ fontSize: 13, color: `${C.cream}50` }}>O grupo está no nível</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ backgroundColor: C.lime, color: C.onAccent }}>
                {activeCategory?.icon && <activeCategory.icon size={12} />}
                <span style={{ fontSize: 11, fontWeight: 700 }}>{activeCategory?.name}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {[
                `${approvedSubmissions.length} tarefas concluídas`,
                selectedQuarter
              ].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs" style={{ border: `1px solid rgba(var(--ink),0.14)`, color: `${C.cream}65` }}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <div
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tighter"
              style={{ ...heading, color: C.cream }}
            >
              {collectivePoints.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 11, color: `${C.cream}40`, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>Pontos Totais</div>
          </div>
        </div>

        <GroupProgress selectedQuarter={selectedQuarter} />

        {/* AÇÕES RÁPIDAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => navigate(createPageUrl("Tasks"))} className="group p-5 sm:p-6 rounded-2xl text-left transition-all duration-200 hover:brightness-110" style={{ backgroundColor: C.darkGreen, border: `1px solid ${C.orange}28` }}>
            <div className="flex justify-between items-start mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.orange_back }}><Zap size={19} style={{ color: C.orange }} /></div>
              <ChevronRight size={16} style={{ color: `${C.orange}70` }} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream, marginBottom: 4 }}>Novas Tarefas</div>
            <div style={{ fontSize: 12, color: `${C.cream}55` }}>Ganhe mais pontos explorando as disponíveis</div>
          </button>

          <button onClick={() => navigate(createPageUrl("MySubmissions"))} className="group p-5 sm:p-6 rounded-2xl text-left transition-all duration-200 hover:brightness-110" style={{ backgroundColor: C.card, border: `1px solid ${C.lime}18` }}>
            <div className="flex justify-between items-start mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.lime_back }}><FileCheck size={19} style={{ color: C.lime }} /></div>
              <ChevronRight size={16} style={{ color: `${C.lime}70` }} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream, marginBottom: 4 }}>Minhas Tarefas</div>
            <div style={{ fontSize: 12, color: `${C.cream}55` }}>{pendingSubmissions.length} pendentes</div>
          </button>
        </div>

        {/* INFORMAÇÕES DO TRIMESTRE */}
        <div>
          <h2 style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 14 }}>Informações do Trimestre</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TRIMESTRE_STATS.map(({ label, value, accent, bg }) => (
              <div key={label} className="p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: bg, border: `1px solid rgba(var(--ink),0.03)` }}>
                <div className="text-2xl sm:text-3xl font-black leading-none tracking-tight" style={{ ...heading, color: accent }}>{value}</div>
                <div style={{ fontSize: 11, color: `${C.cream}55`, marginTop: 8 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CAMPANHAS & RECENTES */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pb-2">

          {/* Campanhas Realizadas */}
          <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.06)` }}>
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={14} style={{ color: C.lime }} />
              <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream }}>Campanhas Pagas Realizadas</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl sm:text-5xl md:text-6xl font-black leading-none tracking-tighter" style={{ ...heading, color: C.cream }}>{campaignsCompleted}</span>
              <span style={{ fontSize: 26, color: `${C.cream}28`, fontWeight: 200 }}>/</span>
              <span className="text-2xl sm:text-3xl font-semibold" style={{ ...heading, color: `${C.cream}30` }}>{totalCampaigns}</span>
            </div>
            <p style={{ fontSize: 12, color: `${C.cream}45`, marginBottom: 24 }}>
              {totalCampaigns === 0
                ? 'Nenhuma campanha disponível neste trimestre.'
                : campaignsCompleted >= totalCampaigns
                  ? 'Limite de campanhas atingido!'
                  : `${totalCampaigns - campaignsCompleted} campanha(s) restante(s)`}
            </p>
            <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${Math.min(totalCampaigns, 5)}, minmax(0, 1fr))` }}>
              {Array.from({ length: totalCampaigns }, (_, i) => i + 1).map((step) => {
                const done = step <= campaignsCompleted;
                const curr = step === campaignsCompleted + 1;
                return (
                  <div key={step} className="flex flex-col items-center min-w-[36px]">
                    <div className="h-1 rounded-full mb-3 w-full" style={{ backgroundColor: done ? C.lime : curr ? C.orange : "rgba(var(--ink),0.07)" }} />
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: done ? C.lime : curr ? C.darkGreen : "rgba(var(--ink),0.05)", color: done ? C.black : curr ? C.orange : `${C.cream}28`, border: curr ? `1px solid ${C.orange}50` : "none", boxShadow: done ? `0 0 12px ${C.lime}44` : "none" }}>
                      {done ? <CheckCircle size={14} /> : step}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submissões Recentes */}
          <div className="md:col-span-3 p-4 sm:p-5 rounded-2xl flex flex-col min-w-0" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.06)` }}>
            <div className="flex items-center justify-between mb-5 gap-2">
              <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream }}>Submissões Recentes</span>
              <button onClick={() => navigate(createPageUrl("MySubmissions"))} className="flex items-center gap-1 transition-opacity hover:opacity-100 opacity-65 shrink-0" style={{ fontSize: 12, color: C.lime }}>
                Ver todas <ArrowUpRight size={12} />
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              {recentSubmissions.length === 0 ? (
                <div className="text-center text-sm" style={{ color: `${C.cream}40` }}>
                  Nenhuma submissão recente.
                </div>
              ) : (
                recentSubmissions.map((sub, i) => {
                  const { bg, color, label } = getStatusChip(sub.status);
                  const taskTitle = allTasks.find(t => t.id === sub.task_id)?.title || 'Tarefa';
                  const timeStr = format(new Date(sub.created_at), "dd/MM 'às' HH:mm", { locale: ptBR });

                  return (
                    <div key={sub.id} className="flex items-start justify-between gap-3 sm:gap-4 py-3" style={{ borderBottom: i < recentSubmissions.length - 1 ? `1px solid rgba(var(--ink),0.05)` : "none" }}>
                      <div className="flex-1 min-w-0">
                        <div className="truncate" style={{ fontSize: 13, color: C.cream, fontWeight: 500, marginBottom: 3 }}>{taskTitle}</div>
                        <div style={{ fontSize: 11, color: `${C.cream}35` }}>{timeStr}</div>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: bg, color }}>{label}</span>
                    </div>
                  );
                })
              )}
            </div>

            {lastApprovedProof && (
              <div className="mt-4 pt-3" style={{ borderTop: `1px solid rgba(var(--ink),0.05)` }}>
                <a href={lastApprovedProof} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-opacity hover:opacity-100 opacity-60 w-fit" style={{ fontSize: 11, color: C.cream }}>
                  <ExternalLink size={11} />
                  Ver prova da última submissão aprovada
                </a>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
