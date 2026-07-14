// @ts-nocheck
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLeaderboard } from "@/hooks/useScores";
import { Trophy, Medal, Star, Crown } from "lucide-react";
import { getCurrentQuarterKey } from "@/services/scores.service";
import { C, heading, body } from '@/lib/theme';

const LEADERBOARD_BASE_YEAR = 2026;

const getLeaderboardQuarterKeys = () => {
  const now = new Date();
  const currentQuarter = now.getFullYear() === LEADERBOARD_BASE_YEAR
    ? Math.floor(now.getMonth() / 3) + 1
    : 4;
  const result = [];
  for (let quarter = currentQuarter; quarter >= 1; quarter -= 1) {
    result.push(`Q${quarter}-${LEADERBOARD_BASE_YEAR}`);
  }
  return result;
};

const RANK_META = {
  1: { color: '#FFD700', bg: 'rgba(255,215,0,0.10)', border: 'rgba(255,215,0,0.25)', label: '1º lugar' },
  2: { color: '#C0C0C0', bg: 'rgba(192,192,192,0.08)', border: 'rgba(192,192,192,0.2)', label: '2º lugar' },
  3: { color: '#CD7F32', bg: 'rgba(205,127,50,0.10)', border: 'rgba(205,127,50,0.22)', label: '3º lugar' },
};

const RankIcon = ({ rank, size = 20 }) => {
  if (rank === 1) return <Crown size={size} style={{ color: '#FFD700' }} />;
  if (rank === 2) return <Medal size={size} style={{ color: '#C0C0C0' }} />;
  if (rank === 3) return <Medal size={size} style={{ color: '#CD7F32' }} />;
  return null;
};

export default function Leaderboard() {
  const { user } = useAuth();
  const quarterOptions = React.useMemo(() => getLeaderboardQuarterKeys(), []);
  const [selectedQuarter, setSelectedQuarter] = React.useState(quarterOptions[0] || getCurrentQuarterKey());
  const { data: leaderboard = [], isLoading } = useLeaderboard(100, selectedQuarter);

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 20);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: C.lime }} />
          <p style={{ color: `${C.cream}50` }}>Carregando ranking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <div className="hidden md:flex items-center px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10"
        style={{ backgroundColor: `${C.black}F5`, backdropFilter: 'blur(16px)', borderBottom: `1px solid rgba(var(--ink),0.05)` }}>
        <div className="flex items-center gap-3">
          <Trophy size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Ranking de Ecoantes
          </span>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-4xl mx-auto w-full min-w-0 space-y-8 md:space-y-10">

        {/* Hero */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none" style={{ ...heading, color: C.cream }}>
              Ranking de Ecoantes
            </h1>
            <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>
              Veja quem está liderando o movimento climático.
            </p>
          </div>

          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            style={{
              backgroundColor: 'rgba(var(--ink),0.04)',
              border: `1px solid rgba(var(--ink),0.12)`,
              color: C.cream,
              fontSize: 13,
              borderRadius: 12,
              padding: '8px 16px',
              outline: 'none',
              ...body,
              flexShrink: 0,
            }}
          >
            {quarterOptions.map((quarterKey) => (
              <option key={quarterKey} value={quarterKey} style={{ backgroundColor: C.card }}>
                {quarterKey}
              </option>
            ))}
          </select>
        </div>

        {/* Empty state */}
        {leaderboard.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Trophy size={36} style={{ color: `${C.cream}20` }} />
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>Ranking vazio</p>
            <p style={{ fontSize: 14, color: `${C.cream}30` }}>Complete tarefas para aparecer no ranking!</p>
          </div>
        )}

        {/* Top 3 */}
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {topThree.map((entry, index) => {
              const rank = index + 1;
              const meta = RANK_META[rank];
              const name = entry.profile?.full_name || entry.profile?.email || 'Usuário';

              return (
                <div key={entry.user_id} className="relative p-5 rounded-2xl flex flex-col gap-4"
                  style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>

                  {/* Rank badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RankIcon rank={rank} size={18} />
                      <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: meta.color, letterSpacing: '0.05em' }}>
                        {meta.label}
                      </span>
                    </div>
                    <span style={{ ...heading, fontSize: 28, fontWeight: 900, color: meta.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      #{rank}
                    </span>
                  </div>

                  {/* Avatar + nome */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-lg font-black"
                      style={{ backgroundColor: meta.color, color: C.onAccent }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }} className="truncate">{name}</p>
                      {entry.profile?.full_name && (
                        <p style={{ fontSize: 11, color: `${C.cream}45` }} className="truncate">{entry.profile.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between pt-3"
                    style={{ borderTop: `1px solid ${meta.border}` }}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Star size={13} style={{ color: meta.color }} />
                        <span style={{ ...heading, fontSize: 22, fontWeight: 900, color: meta.color, letterSpacing: '-0.02em' }}>
                          {(entry.total_points || 0).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p style={{ fontSize: 10, color: `${C.cream}40`, marginTop: 2 }}>pontos</p>
                    </div>
                    <div className="text-right">
                      <span style={{ ...heading, fontSize: 22, fontWeight: 900, color: `${C.cream}70`, letterSpacing: '-0.02em' }}>
                        {entry.tasks_completed || 0}
                      </span>
                      <p style={{ fontSize: 10, color: `${C.cream}40`, marginTop: 2 }}>tarefas</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Demais posições */}
        {rest.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
              <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream }}>Demais Posições</span>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.07)` }}>
              {rest.map((entry, index) => {
                const rank = index + 4;
                const isCurrentUser = entry.user_id === user?.id;
                const name = entry.profile?.full_name || entry.profile?.email || 'Usuário';

                return (
                  <div key={entry.user_id}
                    className="flex items-center gap-4 px-5 py-4 transition-all hover:brightness-110"
                    style={{
                      borderBottom: index < rest.length - 1 ? `1px solid rgba(var(--ink),0.05)` : 'none',
                      backgroundColor: isCurrentUser ? `${C.lime}08` : 'transparent',
                    }}>

                    {/* Rank number */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black"
                      style={{ backgroundColor: 'rgba(var(--ink),0.06)', color: `${C.cream}50` }}>
                      {rank}
                    </div>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                      style={{ backgroundColor: C.orange, color: C.cream }}>
                      {name.charAt(0).toUpperCase()}
                    </div>

                    {/* Nome */}
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.cream }} className="truncate">
                        {name}
                        {isCurrentUser && (
                          <span style={{ fontSize: 11, color: C.lime, fontWeight: 700, marginLeft: 6 }}>Você</span>
                        )}
                      </p>
                      {entry.profile?.full_name && (
                        <p style={{ fontSize: 11, color: `${C.cream}40` }} className="truncate">{entry.profile.email}</p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Star size={12} style={{ color: C.orange }} />
                          <span style={{ ...heading, fontSize: 16, fontWeight: 800, color: C.orange, letterSpacing: '-0.01em' }}>
                            {(entry.total_points || 0).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p style={{ fontSize: 10, color: `${C.cream}35` }}>pontos</p>
                      </div>
                      <div className="text-right">
                        <span style={{ ...heading, fontSize: 16, fontWeight: 800, color: `${C.cream}60`, letterSpacing: '-0.01em' }}>
                          {entry.tasks_completed || 0}
                        </span>
                        <p style={{ fontSize: 10, color: `${C.cream}35` }}>tarefas</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}