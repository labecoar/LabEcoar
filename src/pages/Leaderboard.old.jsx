import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";

export default function Leaderboard() {
  const { data: allSubmissions, isLoading } = useQuery({
    queryKey: ['leaderboard-data'],
    queryFn: () => base44.entities.TaskSubmission.list(),
    initialData: []
  });

  const { data: users } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: []
  });

  const calculateLeaderboard = () => {
    const userStats = {};

    allSubmissions.
    filter((s) => s.status === 'aprovada').
    forEach((submission) => {
      if (!userStats[submission.user_email]) {
        userStats[submission.user_email] = {
          email: submission.user_email,
          name: submission.user_name,
          points: 0,
          tasksCompleted: 0
        };
      }
      userStats[submission.user_email].points += submission.points_earned || 0;
      userStats[submission.user_email].tasksCompleted += 1;
    });

    return Object.values(userStats).
    sort((a, b) => b.points - a.points).
    map((user, index) => ({
      ...user,
      rank: index + 1,
      userData: users.find((u) => u.email === user.email)
    }));
  };

  const leaderboard = calculateLeaderboard();
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

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Ranking de Ecoantes

          </h1>
          <p className="text-gray-600 mt-2">Veja quem está liderando o movimento climático</p>
        </div>

        {topThree.length > 0 &&
        <div className="grid md:grid-cols-3 gap-6 mb-8">
            {topThree.map((user) =>
          <Card
            key={user.email}
            className={`shadow-xl border-none overflow-hidden ${
            user.rank === 1 ? 'md:scale-110 md:z-10' : ''}`
            }>

                <div className={`h-24 ${getRankBg(user.rank)} relative`}>
                  <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
                    <div className="w-20 h-20 rounded-full bg-white p-1 shadow-lg">
                      <div className={`w-full h-full rounded-full ${getRankBg(user.rank)} flex items-center justify-center text-white text-2xl font-bold`}>
                        {user.name?.charAt(0).toUpperCase() || 'E'}
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-4 left-4">
                    {getRankIcon(user.rank)}
                  </div>
                </div>
                <CardContent className="pt-14 text-center">
                  <h3 className="font-bold text-xl mb-1">{user.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    @{user.userData?.instagram_handle || user.email.split('@')[0]}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-yellow-50 rounded-lg">
                      <span className="text-sm text-gray-600">Pontos</span>
                      <span className="font-bold text-yellow-700">{user.points}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-emerald-50 rounded-lg">
                      <span className="text-sm text-gray-600">Tarefas</span>
                      <span className="font-bold text-emerald-700">{user.tasksCompleted}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
          )}
          </div>
        }

        <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-emerald-100">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Ranking Geral
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-emerald-100">
              {rest.map((user) =>
              <div
                key={user.email}
                className="p-4 hover:bg-emerald-50 transition-colors duration-200">

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-400">#{user.rank}</span>
                    </div>
                    <div className={`w-12 h-12 rounded-full ${getRankBg(user.rank)} flex items-center justify-center text-white text-lg font-bold shadow-md`}>
                      {user.name?.charAt(0).toUpperCase() || 'E'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{user.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        @{user.userData?.instagram_handle || user.email.split('@')[0]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-yellow-700">{user.points} pts</p>
                      <p className="text-sm text-gray-600">{user.tasksCompleted} tarefas</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {leaderboard.length === 0 &&
        <div className="text-center py-12">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 text-lg">Nenhum Ecoante no ranking ainda</p>
          </div>
        }
      </div>
    </div>);

}