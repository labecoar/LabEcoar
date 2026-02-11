import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/hooks/useTasks";
import { useMySubmissions } from "@/hooks/useSubmissions";
import { useUserScore } from "@/hooks/useScores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, CheckCircle, Star, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import RecentSubmissions from "../components/dashboard/RecentSubmissions";

const CATEGORY_THRESHOLDS = [
  { key: 'voz_e_violao', name: 'Voz e Violão', min: 0, max: 200, emoji: '🎸', color: '#f6c835', bgColor: 'bg-[#f6c835]' },
  { key: 'dueto', name: 'Dueto', min: 201, max: 500, emoji: '🎤', color: '#e833ae', bgColor: 'bg-[#e833ae]' },
  { key: 'fanfarra', name: 'Fanfarra', min: 501, max: 1000, emoji: '🎺', color: '#0077ad', bgColor: 'bg-[#0077ad]' },
  { key: 'carnaval', name: 'Carnaval', min: 1001, max: 1500, emoji: '🎉', color: '#ff6a2d', bgColor: 'bg-[#ff6a2d]' }
];

const CATEGORY_VALUES = {
  voz_e_violao: 1000,
  dueto: 2000,
  fanfarra: 3500,
  carnaval: 4500
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { data: allTasks = [] } = useTasks();
  const { data: submissions = [] } = useMySubmissions(user?.id);
  const { data: userScore } = useUserScore(user?.id);

  const approvedSubmissions = submissions.filter((s) => s.status === 'approved');
  const pendingSubmissions = submissions.filter((s) => s.status === 'pending');

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
  const categoryValue = CATEGORY_VALUES[currentCategory];

  const progressPercentage = Math.min(currentPoints / 1500 * 100, 100);

  const currentCategoryIndex = CATEGORY_THRESHOLDS.findIndex((cat) =>
    currentPoints >= cat.min && currentPoints <= cat.max
  );

  const displayName = profile?.full_name?.split(' ')[0] || 'Ecoante';

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'linear-gradient(to br, #f5fff8, #ffffff, #fff5f8)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm" style={{ color: '#929292' }}>Olá,</h2>
            <h1 className="text-2xl font-bold" style={{ color: '#3c0b14' }}>
              {displayName} 👋
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-full flex items-center gap-2 shadow-lg" style={{ background: '#3c0b14', color: 'white' }}>
              <Star className="w-5 h-5" style={{ color: '#f6c835', fill: '#f6c835' }} />
              <span className="font-bold text-lg">{currentPoints}</span>
            </div>
          </div>
        </div>

        {/* Categoria Atual e Ganho */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm" style={{ color: '#929292' }}>Este trimestre você está no nível</span>
            <div className="px-4 py-1 rounded-full text-sm font-bold shadow-md text-white" style={{ background: '#096e4c' }}>
              {CATEGORY_THRESHOLDS[currentCategoryIndex]?.emoji} {CATEGORY_THRESHOLDS[currentCategoryIndex]?.name}
            </div>
          </div>

          {/* Pontos Grandes */}
          <div className="mb-6">
            <div className="text-7xl font-black tracking-tight" style={{ color: '#3c0b14' }}>
              {currentPoints.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="px-3 py-1 rounded-full" style={{ background: '#096e4c10' }}>
                <span className="text-sm" style={{ color: '#096e4c' }}>{approvedSubmissions.length} tarefas</span>
              </div>
              <div className="px-3 py-1 rounded-full" style={{ background: '#096e4c10' }}>
                <span className="text-sm" style={{ color: '#096e4c' }}>R$ {categoryValue.toLocaleString('pt-BR')}</span>
              </div>
              <div className="px-3 py-1 rounded-full" style={{ background: '#00c33120' }}>
                <span className="text-sm font-medium" style={{ color: '#00c331' }}>{profile?.current_quarter || 'Q1-2025'}</span>
              </div>
            </div>
          </div>

          {/* Linha de Progresso */}
          <div className="relative mt-12 mb-8">
            {/* Labels das categorias */}
            <div className="flex justify-between mb-3 px-2">
              {CATEGORY_THRESHOLDS.map((category, index) =>
                <div key={category.key} className="flex flex-col items-center">
                  <div className={`text-2xl mb-1 transition-all duration-300 ${index <= currentCategoryIndex ? 'scale-110' : 'grayscale opacity-40'}`}>
                    {category.emoji}
                  </div>
                  <div className={`text-xs font-medium`} style={{ color: index === currentCategoryIndex ? '#3c0b14' : '#929292' }}>
                    {category.max}
                  </div>
                </div>
              )}
            </div>

            {/* Linha de progresso */}
            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#92929220' }}>
              <div
                className="absolute top-0 left-0 h-full transition-all duration-500 ease-out rounded-full"
                style={{ 
                  width: `${progressPercentage}%`,
                  background: 'linear-gradient(to right, #f6c835, #e833ae, #0077ad, #ff6a2d)'
                }} />

              {/* Indicador atual */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg transition-all duration-500"
                style={{ 
                  left: `calc(${progressPercentage}% - 16px)`,
                  border: `4px solid #096e4c`
                }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#096e4c' }} />
                </div>
              </div>
            </div>

            {/* Marcadores das categorias */}
            <div className="flex justify-between mt-2 px-2">
              {CATEGORY_THRESHOLDS.map((category, index) =>
                <div key={`label-${category.key}`} className="flex flex-col items-center">
                  <div className={`text-xs font-semibold`} style={{ color: index <= currentCategoryIndex ? '#3c0b14' : '#929292' }}>
                    {category.name}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Campanhas Realizadas */}
        <Card className="mb-8 shadow-lg bg-white/80 backdrop-blur-sm" style={{ borderColor: '#f6c83540' }}>
          <CardHeader className="border-b" style={{ borderColor: '#f6c83520' }}>
            <CardTitle className="text-lg flex items-center gap-2" style={{ color: '#3c0b14' }}>
              <span className="text-2xl">💰</span>
              Campanhas Pagas Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-6xl font-black" style={{ color: '#f6c835' }}>
                    {campaignsCompleted}
                  </span>
                  <span className="text-4xl text-gray-400">/</span>
                  <span className="text-4xl text-gray-400">3</span>
                </div>
                <p className="text-sm" style={{ color: '#929292' }}>
                  {campaignsCompleted >= 3 ? '🎉 Limite atingido!' : `${3 - campaignsCompleted} campanha(s) restante(s)`}
                </p>
              </div>
              
              <div className="flex gap-2">
                {[1, 2, 3].map((num) => (
                  <div
                    key={num}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all shadow-md ${
                      num <= campaignsCompleted
                        ? 'text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                    style={num <= campaignsCompleted ? { 
                      background: 'linear-gradient(135deg, #f6c835 0%, #ff6a2d 100%)' 
                    } : {}}
                  >
                    {num <= campaignsCompleted ? '✓' : num}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de ação rápida */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to={createPageUrl("Tasks")}>
            <Card className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent bg-white" style={{ ':hover': { borderColor: '#096e4c' } }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)' }}>
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold" style={{ color: '#3c0b14' }}>Novas Tarefas</h3>
                    <p className="text-sm mt-1" style={{ color: '#929292' }}>Ganhe mais pontos</p>
                  </div>
                  <ChevronRight className="w-6 h-6" style={{ color: '#096e4c' }} />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("MySubmissions")}>
            <Card className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, #0077ad 0%, #00d3fb 100%)' }}>
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold" style={{ color: '#3c0b14' }}>Minhas Tarefas</h3>
                    <p className="text-sm mt-1" style={{ color: '#929292' }}>{pendingSubmissions.length} pendentes</p>
                  </div>
                  <ChevronRight className="w-6 h-6" style={{ color: '#0077ad' }} />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("Leaderboard")}>
            <Card className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, #a6539f 0%, #e833ae 100%)' }}>
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold" style={{ color: '#3c0b14' }}>Ranking</h3>
                    <p className="text-sm mt-1" style={{ color: '#929292' }}>Veja sua posição</p>
                  </div>
                  <ChevronRight className="w-6 h-6" style={{ color: '#a6539f' }} />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Informações do trimestre */}
        <Card className="mb-8 shadow-lg bg-white/80 backdrop-blur-sm" style={{ borderColor: '#096e4c20' }}>
          <CardHeader className="border-b" style={{ borderColor: '#096e4c20' }}>
            <CardTitle className="text-xl" style={{ color: '#3c0b14' }}>Informações do Trimestre</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl" style={{ background: '#f6c83520' }}>
                <div className="text-3xl font-bold" style={{ color: '#f6c835' }}>{approvedSubmissions.length}</div>
                <div className="text-sm mt-1" style={{ color: '#929292' }}>Aprovadas</div>
              </div>
              <div className="text-center p-4 rounded-xl" style={{ background: '#0077ad20' }}>
                <div className="text-3xl font-bold" style={{ color: '#0077ad' }}>{pendingSubmissions.length}</div>
                <div className="text-sm mt-1" style={{ color: '#929292' }}>Em Análise</div>
              </div>
              <div className="text-center p-4 rounded-xl" style={{ background: '#a6539f20' }}>
                <div className="text-3xl font-bold" style={{ color: '#a6539f' }}>{profile?.campaigns_participated || 0}</div>
                <div className="text-sm mt-1" style={{ color: '#929292' }}>Campanhas</div>
              </div>
              <div className="text-center p-4 rounded-xl" style={{ background: '#00c33120' }}>
                <div className="text-3xl font-bold" style={{ color: '#00c331' }}>R$ {categoryValue.toLocaleString('pt-BR')}</div>
                <div className="text-sm mt-1" style={{ color: '#929292' }}>Ganho Previsto</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Atividade Recente */}
        <RecentSubmissions submissions={submissions} />
      </div>
    </div>
  );
}