// @ts-nocheck
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions } from "@/hooks/useMetrics";
import { useUserScore, useGroupProgress } from "@/hooks/useScores";
import { Star, ChevronRight, Zap, FileCheck, CalendarDays } from "lucide-react";
import GroupProgress, { getGroupCategory } from "@/components/dashboard/GroupProgress";
import RecentSubmissionsPanel from "@/components/dashboard/RecentSubmissionsPanel";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getCurrentQuarterKey } from "@/services/scores.service";
import { C, heading } from '@/lib/theme';
import { useThemeMode } from '@/contexts/ThemeContext';
import { PageShell, PageHeader, PageHeaderLabel, PageContent } from "@/components/layout/PageShell";

const CATEGORY_VALUES = {
  voz_e_violao: 1000,
  dueto: 2000,
  fanfarra: 3500,
  carnaval: 4500
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { isLight, T } = useThemeMode();
  const { user, profile } = useAuth();
  const selectedQuarter = getCurrentQuarterKey();
  const { data: submissions = [] } = useMySubmissions(user?.id);
  const { data: myMetricsSubmissions = [] } = useMyMetricsSubmissions(user?.id);
  const { data: userScore } = useUserScore(user?.id, selectedQuarter);
  const { data: groupProgress } = useGroupProgress(selectedQuarter);

  const approvedSubmissions = submissions.filter((s) => s.status === 'approved');
  const pendingSubmissions = submissions.filter((s) => ['pending', 'application_pending', 'script_pending', 'script_approved', 'proof_pending', 'application_approved'].includes(s.status));

  const currentPoints = userScore?.total_points || 0;
  const collectivePoints = groupProgress?.collective_points || 0;
  const activeEcoantes = groupProgress?.active_ecoantes || 0;
  const currentCategory = profile?.current_category || 'voz_e_violao';
  const categoryValue = CATEGORY_VALUES[currentCategory] || 0;

  const activeCategory = getGroupCategory(collectivePoints, activeEcoantes || 1);

  const displayName = profile?.full_name?.split(' ')[0] || profile?.display_name?.split(' ')[0] || 'Ecoante';

  const TRIMESTRE_STATS = [
    { label: 'Aprovadas', value: approvedSubmissions.length, accent: isLight ? T.accent : C.lime, bg: C.card },
    { label: 'Em Análise', value: pendingSubmissions.length, accent: isLight ? T.textSub : C.cream, bg: C.card },
    { label: 'Campanhas', value: profile?.campaigns_participated || 0, accent: C.orange, bg: C.darkGreen },
    { label: 'Seus Pontos', value: currentPoints, accent: isLight ? T.accent : C.lime, bg: C.card },
  ];

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderLabel icon={CalendarDays} iconSize={14}>{selectedQuarter}</PageHeaderLabel>
        <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full shrink-0" style={{ backgroundColor: C.lime, color: C.onAccent }}>
          <Star size={11} fill={C.onAccent} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{currentPoints} pts</span>
        </div>
      </PageHeader>

      <PageContent maxWidth="max-w-7xl" className="space-y-5 md:space-y-6">
        {/* BOAS VINDAS & PONTOS GERAIS */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 14, color: isLight ? T.textMuted : `${C.cream}50`, marginBottom: 4 }}>Olá,</p>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-black leading-none tracking-tight"
              style={{ ...heading, color: C.cream }}
            >
              {displayName}{" "}
              <span role="img" aria-label="wave" className="text-2xl sm:text-3xl md:text-4xl font-normal">👋</span>
            </h1>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span style={{ fontSize: 13, color: isLight ? T.textMuted : `${C.cream}50` }}>O grupo está no nível</span>
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
                <span key={tag} className="px-3 py-1 rounded-full text-xs" style={{ border: `1px solid ${isLight ? T.border : "rgba(var(--ink),0.14)"}`, color: isLight ? T.textSub : `${C.cream}65` }}>{tag}</span>
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
            <div style={{ fontSize: 11, color: isLight ? T.textMuted : `${C.cream}40`, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>Pontos Totais</div>
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
            <div style={{ ...heading, fontSize: 20, fontWeight: 800, color: isLight ? T.textOnColor : C.cream, marginBottom: 4 }}>Novas Tarefas</div>
            <div style={{ fontSize: 12, color: isLight ? `${T.textOnColor}AA` : `${C.cream}55` }}>Ganhe mais pontos explorando as disponíveis</div>
          </button>

          <button onClick={() => navigate(createPageUrl("MySubmissions"))} className="group p-5 sm:p-6 rounded-2xl text-left transition-all duration-200 hover:brightness-110" style={{ backgroundColor: isLight ? C.blue : C.card, border: `1px solid ${C.lime}18` }}>
            <div className="flex justify-between items-start mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.lime_back }}><FileCheck size={19} style={{ color: C.lime }} /></div>
              <ChevronRight size={16} style={{ color: isLight ? `${T.textOnColor}90` : `${C.lime}70` }} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div style={{ ...heading, fontSize: 20, fontWeight: 800, color: isLight ? T.textOnColor : C.cream, marginBottom: 4 }}>Minhas Tarefas</div>
            <div style={{ fontSize: 12, color: isLight ? `${T.textOnColor}B0` : `${C.cream}55` }}>{pendingSubmissions.length} pendentes</div>
          </button>
        </div>

        {/* INFORMAÇÕES DO TRIMESTRE */}
        <div>
          <h2 style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 14 }}>Informações do Trimestre</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TRIMESTRE_STATS.map(({ label, value, accent, bg }) => (
              <div key={label} className="p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: bg, border: `1px solid ${isLight ? T.borderMid : "rgba(var(--ink),0.03)"}` }}>
                <div className="text-2xl sm:text-3xl font-black leading-none tracking-tight" style={{ ...heading, color: accent }}>{value}</div>
                <div style={{ fontSize: 11, color: isLight ? T.textMuted : `${C.cream}55`, marginTop: 8 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SUBMISSÕES RECENTES */}
        <div className="pb-2">
          <RecentSubmissionsPanel
            submissions={submissions}
            metricsSubmissions={myMetricsSubmissions}
            onViewAll={() => navigate(createPageUrl("MySubmissions"))}
          />
        </div>
      </PageContent>
    </PageShell>
  );
}
