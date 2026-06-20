// @ts-nocheck
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/useTasks";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions } from "@/hooks/useMetrics";
import { useUserScore, useUserScoreHistory } from "@/hooks/useScores";
import { Trophy, Target, CheckCircle, Star, ChevronRight, Zap, FileCheck, ArrowUpRight, ExternalLink, CalendarDays, Music2, Mic, Users, PartyPopper } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getCurrentQuarterKey } from "@/services/scores.service";
import { C, heading, body } from '@/lib/theme';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORY_THRESHOLDS = [
  { key: 'voz_e_violao', name: 'Voz e Violão', min: 0, max: 200, icon: Music2, color: C.lime },
  { key: 'dueto', name: 'Dueto', min: 201, max: 500, icon: Mic, color: C.pink },
  { key: 'fanfarra', name: 'Fanfarra', min: 501, max: 1000, icon: Users, color: C.blue },
  { key: 'carnaval', name: 'Carnaval', min: 1001, max: 1500, icon: PartyPopper, color: C.orange }
];

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
  return { bg: 'rgba(255,255,216,0.08)', color: `rgba(255,255,216,0.8)`, label: 'Em análise' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [selectedQuarter, setSelectedQuarter] = React.useState(getCurrentQuarterKey());
  const { data: allTasks = [] } = useTasks();
  const { data: submissions = [] } = useMySubmissions(user?.id);
  const { data: userScore } = useUserScore(user?.id, selectedQuarter);
  const { data: userScoreHistory = [] } = useUserScoreHistory(user?.id, 10);

  const approvedSubmissions = submissions.filter((s) => s.status === 'approved');
  const pendingSubmissions = submissions.filter((s) => ['pending', 'application_pending', 'proof_pending', 'application_approved'].includes(s.status));

  // Conta quantas campanhas pagas foram feitas (máximo 3)
  const campaignsCompleted = React.useMemo(() => {
    const campaignSubmissions = approvedSubmissions.filter(sub => {
      const task = allTasks.find(t => t.id === sub.task_id);
      return task && task.category === 'campanha';
    });
    return Math.min(campaignSubmissions.length, 3);
  }, [approvedSubmissions, allTasks]);

  const currentPoints = userScore?.total_points || 0;
  const currentCategory = profile?.current_category || 'voz_e_violao';
  const categoryValue = CATEGORY_VALUES[currentCategory] || 0;

  const progressPercentage = Math.min(currentPoints / 1500 * 100, 100);

  const currentCategoryIndex = CATEGORY_THRESHOLDS.findIndex((cat) =>
    currentPoints >= cat.min && currentPoints <= cat.max
  );
  
  const activeCategory = CATEGORY_THRESHOLDS[currentCategoryIndex !== -1 ? currentCategoryIndex : 3];

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
    { label: 'Aprovadas', value: approvedSubmissions.length, accent: C.lime, bg: 'rgba(204,255,68,0.08)' },
    { label: 'Em Análise', value: pendingSubmissions.length, accent: C.blue, bg: 'rgba(68,102,255,0.08)' },
    { label: 'Campanhas', value: profile?.campaigns_participated || 0, accent: C.purple, bg: 'rgba(170,102,255,0.08)' },
    { label: 'Seus Pontos', value: currentPoints, accent: C.orange, bg: 'rgba(255,136,51,0.08)' },
  ];

  const recentSubmissions = submissions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);
    
  const lastApprovedProof = approvedSubmissions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.proof_url;

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>
      {/* HEADER FIXO - SEMELHANTE AO TASKS */}
      <div className="flex items-center justify-between px-8 py-4 sticky top-0 z-10" style={{ backgroundColor: `${C.black}F5`, backdropFilter: "blur(16px)", borderBottom: `1px solid rgba(255,255,222,0.05)` }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={14} style={{ color: C.lime }} />
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="bg-transparent outline-none cursor-pointer"
            style={{ ...heading, fontSize: 13, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {quarterOptions.map((quarterKey) => (
              <option key={quarterKey} value={quarterKey} style={{ background: C.card, color: C.cream }}>
                {quarterKey}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.black }}>
            <Star size={11} fill={C.black} />
            <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{currentPoints} pts</span>
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6 max-w-5xl mx-auto">
        {/* BOAS VINDAS & PONTOS GERAIS */}
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div>
            <p style={{ fontSize: 14, color: `${C.cream}50`, marginBottom: 4 }}>Olá,</p>
            <h1 style={{ ...heading, fontSize: 52, fontWeight: 900, color: C.cream, lineHeight: 0.92, letterSpacing: "-0.03em" }}>{displayName} <span role="img" aria-label="wave" style={{ fontSize: 44, fontWeight: 400 }}>👋</span></h1>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span style={{ fontSize: 13, color: `${C.cream}50` }}>No trimestre selecionado você está no nível</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ backgroundColor: activeCategory?.color || C.lime, color: C.black }}>
                {activeCategory?.icon && <activeCategory.icon size={12} />}
                <span style={{ fontSize: 11, fontWeight: 700 }}>{activeCategory?.name}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {[
                `${approvedSubmissions.length} tarefas concluídas`, 
                `R$ ${categoryValue.toLocaleString('pt-BR')} previstos`, 
                selectedQuarter
              ].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs" style={{ border: `1px solid rgba(255,255,222,0.14)`, color: `${C.cream}65` }}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div style={{ ...heading, fontSize: 80, fontWeight: 900, color: C.cream, lineHeight: 1, letterSpacing: "-0.05em" }}>{currentPoints}</div>
            <div style={{ fontSize: 11, color: `${C.cream}40`, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>pontos totais</div>
          </div>
        </div>

        {/* BARRA DE PROGRESSO */}
        <div className="mb-6 p-6 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
          <div className="flex items-center justify-between mb-7">
            <span style={{ ...heading, fontSize: 11, fontWeight: 700, color: `${C.cream}50`, textTransform: "uppercase", letterSpacing: "0.12em" }}>Jornada de Níveis</span>
            <span style={{ fontSize: 11, color: `${C.cream}30` }}>{selectedQuarter}</span>
          </div>
          
          <div className="relative">
            <div className="relative h-2.5 rounded-full w-full" style={{ backgroundColor: "rgba(255,255,222,0.07)" }}>
              <div className="absolute left-0 top-0 h-full rounded-l-full transition-all duration-500 ease-out" style={{ width: `${progressPercentage}%`, background: `linear-gradient(90deg, ${C.blue} 0%, ${C.lime} 100%)` }} />
              {[25, 50, 75].map((pct) => (
                <div key={pct} className="absolute top-0 h-full w-px z-10" style={{ left: `${pct}%`, backgroundColor: `${C.black}CC` }} />
              ))}
              <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full z-20 transition-all duration-500" style={{ left: `calc(${progressPercentage}% - 8px)`, backgroundColor: C.lime, boxShadow: `0 0 10px ${C.lime}CC, 0 0 24px ${C.lime}66` }} />
            </div>

            <div className="grid grid-cols-4 gap-3 mt-6">
              {CATEGORY_THRESHOLDS.map((cat) => {
                let fill = 0;
                if (currentPoints >= cat.max) fill = 100;
                else if (currentPoints <= cat.min) fill = 0;
                else fill = Math.round(((currentPoints - cat.min) / (cat.max - cat.min)) * 100);

                const isCompleted = currentPoints > cat.max || fill === 100;
                const isCurrent = currentPoints >= cat.min && currentPoints <= cat.max;

                const iconBg    = isCompleted ? C.lime : isCurrent ? C.darkGreen : "rgba(255,255,222,0.05)";
                const iconColor = isCompleted ? C.black : isCurrent ? C.orange : `${C.cream}20`;
                const nameColor = isCompleted ? C.lime  : isCurrent ? C.cream   : `${C.cream}25`;
                const borderSty = isCurrent ? `1px solid ${C.orange}40` : (!isCompleted ? `1px solid rgba(255,255,222,0.07)` : "none");

                return (
                  <div key={cat.name} className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 transition-all" style={{ backgroundColor: iconBg, border: borderSty, boxShadow: isCompleted ? `0 0 20px ${C.lime}33` : "none" }}>
                      <cat.icon size={18} style={{ color: iconColor }} />
                    </div>
                    <div style={{ ...heading, fontSize: 12, fontWeight: 700, color: nameColor, marginBottom: 2 }}>{cat.name}</div>
                    <div style={{ fontSize: 10, color: `${C.cream}30` }}>{cat.max} pts</div>
                    <div className="h-0.5 w-12 rounded-full mt-2.5" style={{ backgroundColor: "rgba(255,255,222,0.06)" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fill}%`, backgroundColor: isCompleted ? C.lime : isCurrent ? C.orange : "transparent" }} />
                    </div>
                    <div style={{ fontSize: 9, color: `${C.cream}30`, marginTop: 3 }}>{fill}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AÇÕES RÁPIDAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => navigate(createPageUrl("Tasks"))} className="group p-6 rounded-2xl text-left transition-all duration-200 hover:brightness-110" style={{ backgroundColor: C.darkGreen, border: `1px solid ${C.orange}28` }}>
            <div className="flex justify-between items-start mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${C.orange}18` }}><Zap size={19} style={{ color: C.orange }} /></div>
              <ChevronRight size={16} style={{ color: `${C.orange}70` }} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream, marginBottom: 4 }}>Novas Tarefas</div>
            <div style={{ fontSize: 12, color: `${C.cream}55` }}>Ganhe mais pontos explorando as disponíveis</div>
          </button>

          <button onClick={() => navigate(createPageUrl("MySubmissions"))} className="group p-6 rounded-2xl text-left transition-all duration-200 hover:brightness-110" style={{ backgroundColor: C.card, border: `1px solid ${C.lime}18` }}>
            <div className="flex justify-between items-start mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${C.lime}12` }}><FileCheck size={19} style={{ color: C.lime }} /></div>
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
              <div key={label} className="p-5 rounded-2xl" style={{ backgroundColor: bg, border: `1px solid rgba(255,255,222,0.03)` }}>
                <div style={{ ...heading, fontSize: 32, fontWeight: 900, color: accent, lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</div>
                <div style={{ fontSize: 11, color: `${C.cream}55`, marginTop: 8 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CAMPANHAS & RECENTES */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pb-2">
          {/* Campanhas Realizadas */}
          <div className="md:col-span-2 p-5 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={14} style={{ color: C.lime }} />
              <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream }}>Campanhas Pagas Realizadas</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span style={{ ...heading, fontSize: 60, fontWeight: 900, color: C.cream, lineHeight: 1, letterSpacing: "-0.05em" }}>{campaignsCompleted}</span>
              <span style={{ fontSize: 26, color: `${C.cream}28`, fontWeight: 200 }}>/</span>
              <span style={{ ...heading, fontSize: 30, fontWeight: 600, color: `${C.cream}30` }}>3</span>
            </div>
            <p style={{ fontSize: 12, color: `${C.cream}45`, marginBottom: 24 }}>
              {campaignsCompleted >= 3 ? 'Limite de campanhas atingido!' : `${3 - campaignsCompleted} campanha(s) restante(s)`}
            </p>
            <div className="flex gap-3">
              {[1, 2, 3].map((step) => {
                const done = step <= campaignsCompleted;
                const curr = step === campaignsCompleted + 1;
                return (
                  <div key={step} className="flex-1">
                    <div className="h-1 rounded-full mb-3" style={{ backgroundColor: done ? C.lime : curr ? `${C.orange}55` : "rgba(255,255,222,0.07)" }} />
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: done ? C.lime : curr ? C.darkGreen : "rgba(255,255,222,0.05)", color: done ? C.black : curr ? C.orange : `${C.cream}28`, border: curr ? `1px solid ${C.orange}50` : "none", boxShadow: done ? `0 0 12px ${C.lime}44` : "none" }}>
                      {done ? <CheckCircle size={14} /> : step}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submissões Recentes */}
          <div className="md:col-span-3 p-5 rounded-2xl flex flex-col" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
            <div className="flex items-center justify-between mb-5">
              <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream }}>Submissões Recentes</span>
              <button onClick={() => navigate(createPageUrl("MySubmissions"))} className="flex items-center gap-1 transition-opacity hover:opacity-100 opacity-65" style={{ fontSize: 12, color: C.lime }}>
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
                    <div key={sub.id} className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: i < recentSubmissions.length - 1 ? `1px solid rgba(255,255,222,0.05)` : "none" }}>
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
              <div className="mt-4 pt-3" style={{ borderTop: `1px solid rgba(255,255,222,0.05)` }}>
                <a href={lastApprovedProof} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-opacity hover:opacity-100 opacity-60 w-fit" style={{ fontSize: 11, color: C.cream }}>
                  <ExternalLink size={11} />
                  Ver prova da última submissão aprovada
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}