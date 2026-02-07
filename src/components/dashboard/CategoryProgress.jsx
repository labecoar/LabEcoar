import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Zap, Award, TrendingUp } from "lucide-react";

const CATEGORY_INFO = {
  voz_e_violao: { 
    name: "Voz e Violão", 
    color: "from-yellow-400 to-orange-500",
    icon: "🎸",
    description: "Primeiros passos no Lab Ecoar"
  },
  dueto: { 
    name: "Dueto", 
    color: "from-pink-400 to-rose-500",
    icon: "🎤",
    description: "Engajamento constante"
  },
  fanfarra: { 
    name: "Fanfarra", 
    color: "from-blue-400 to-cyan-500",
    icon: "🎺",
    description: "Conteúdos robustos e autorais"
  },
  carnaval: { 
    name: "Carnaval", 
    color: "from-orange-400 to-red-500",
    icon: "🎉",
    description: "Liderança e alto impacto"
  }
};

const THRESHOLDS = {
  dueto: 201,
  fanfarra: 501,
  carnaval: 999
};

export default function CategoryProgress({ user, currentCategory, nextCategory, progressToNext }) {
  const currentInfo = CATEGORY_INFO[currentCategory];
  const nextInfo = nextCategory ? CATEGORY_INFO[nextCategory] : null;
  const pointsToNext = nextCategory ? THRESHOLDS[nextCategory] - (user?.total_points || 0) : 0;

  return (
    <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b border-emerald-100 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Zap className="w-6 h-6 text-yellow-500" />
          Progresso da Categoria
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{currentInfo?.icon}</span>
                <div>
                  <p className="text-2xl font-bold bg-gradient-to-r ${currentInfo?.color} bg-clip-text text-transparent">
                    {currentInfo?.name}
                  </p>
                  <p className="text-sm text-gray-500">{currentInfo?.description}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {user?.total_points || 0} pontos acumulados
              </p>
            </div>
            {nextInfo && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Próxima:</p>
                <div className="flex items-center gap-1">
                  <span className="text-xl">{nextInfo.icon}</span>
                  <p className="font-bold text-lg">{nextInfo.name}</p>
                </div>
                <p className="text-sm text-teal-600 font-medium">
                  Faltam {pointsToNext} pts
                </p>
              </div>
            )}
          </div>

          {nextInfo && (
            <>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Progresso</span>
                  <span className="font-semibold text-emerald-700">{Math.round(progressToNext)}%</span>
                </div>
                <Progress value={progressToNext} className="h-3" />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                  <Award className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                  <p className="text-xs text-gray-600 mb-1">Quando atingir</p>
                  <p className="font-bold text-emerald-700">{nextInfo.name}</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                  <p className="text-xs text-gray-600 mb-1">Ganho aumenta</p>
                  <p className="font-bold text-orange-700">+R$ {(THRESHOLDS[nextCategory] * 2).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </>
          )}

          {!nextInfo && (
            <div className="text-center p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border-2 border-orange-300">
              <span className="text-4xl mb-2 block">🏆</span>
              <p className="font-bold text-xl text-orange-700 mb-1">Categoria Máxima!</p>
              <p className="text-sm text-gray-600">Você atingiu o nível Carnaval 🎉</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}