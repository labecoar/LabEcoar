import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLeaderboard } from "@/hooks/useScores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, Star } from "lucide-react";

export default function Leaderboard() {
  const { user } = useAuth();
  const { data: leaderboard = [], isLoading } = useLeaderboard(100);

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 20);

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-8 h-8 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-8 h-8 text-gray-400" />;
    if (rank === 3) return <Medal className="w-8 h-8 text-orange-500" />;
    return <Award className="w-6 h-6 text-emerald-500" />;
  };

  const getRankBg = (rank) => {
    if (rank === 1) return "bg-gradient-to-br from-yellow-400 to-orange-500";
    if (rank === 2) return "bg-gradient-to-br from-gray-300 to-gray-500";
    if (rank === 3) return "bg-gradient-to-br from-orange-400 to-red-500";
    return "bg-gradient-to-br from-emerald-400 to-teal-500";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando ranking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Ranking de Ecoantes
          </h1>
          <p className="text-gray-600 mt-2">Veja quem está liderando o movimento climático</p>
        </div>

        {/* Top 3 */}
        {topThree.length > 0 && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {topThree.map((entry, index) => {
              const rank = index + 1;
              return (
                <Card
                  key={entry.user_id}
                  className={`shadow-xl border-none overflow-hidden ${
                    rank === 1 ? 'md:col-span-3 md:row-span-1' : ''
                  }`}
                >
                  <div className={`${getRankBg(rank)} p-6 text-white`}>
                    <div className="flex items-center justify-between mb-4">
                      {getRankIcon(rank)}
                      <div className="text-right">
                        <div className="text-3xl font-black">#{rank}</div>
                        <div className="text-sm opacity-90">Posição</div>
                      </div>
                    </div>
                    <div className="mb-2">
                      <h3 className="text-2xl font-bold">
                        {entry.profile?.full_name || entry.profile?.email || 'Usuário'}
                      </h3>
                      {entry.profile?.full_name && (
                        <p className="text-sm opacity-90">{entry.profile.email}</p>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                          <span className="text-2xl font-bold text-emerald-700">
                            {entry.total_points || 0}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Pontos totais</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-teal-600">
                          {entry.tasks_completed || 0}
                        </div>
                        <p className="text-sm text-gray-600">Tarefas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Restante do Ranking */}
        {rest.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
              <CardTitle>Demais Posições</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {rest.map((entry, index) => {
                  const rank = index + 4;
                  const isCurrentUser = entry.user_id === user?.id;
                  
                  return (
                    <div
                      key={entry.user_id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        isCurrentUser ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                          {rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {entry.profile?.full_name || entry.profile?.email || 'Usuário'}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-emerald-600 font-normal">
                                (Você)
                              </span>
                            )}
                          </h4>
                          {entry.profile?.full_name && (
                            <p className="text-sm text-gray-500 truncate">
                              {entry.profile.email}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                              <span className="font-bold text-lg text-emerald-700">
                                {entry.total_points || 0}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">pontos</p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg text-teal-600">
                              {entry.tasks_completed || 0}
                            </div>
                            <p className="text-xs text-gray-500">tarefas</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {leaderboard.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Ranking vazio
              </h3>
              <p className="text-gray-500">
                Complete tarefas para aparecer no ranking!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
