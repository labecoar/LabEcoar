import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Flame, Target, Star, Zap, Heart } from "lucide-react";

const badges = [
  { name: 'Iniciante', icon: Star, color: 'bg-blue-100 text-blue-600', required: 1, description: 'Complete sua primeira tarefa' },
  { name: 'Dedicado', icon: Flame, color: 'bg-orange-100 text-orange-600', required: 5, description: 'Complete 5 tarefas' },
  { name: 'Compromissado', icon: Target, color: 'bg-purple-100 text-purple-600', required: 10, description: 'Complete 10 tarefas' },
  { name: 'Campeão', icon: Award, color: 'bg-yellow-100 text-yellow-600', required: 25, description: 'Complete 25 tarefas' },
  { name: 'Lenda', icon: Zap, color: 'bg-green-100 text-green-600', required: 50, description: 'Complete 50 tarefas' },
  { name: 'Eco Hero', icon: Heart, color: 'bg-emerald-100 text-emerald-600', required: 100, description: 'Complete 100 tarefas' },
];

export default function AchievementBadges({ user, tasksCompleted }) {
  return (
    <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b border-emerald-100">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Award className="w-6 h-6 text-emerald-600" />
          Conquistas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-4">
          {badges.map((badge) => {
            const isUnlocked = tasksCompleted >= badge.required;
            const BadgeIcon = badge.icon;
            
            return (
              <div
                key={badge.name}
                className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  isUnlocked
                    ? `${badge.color} border-transparent shadow-md`
                    : 'bg-gray-50 text-gray-400 border-gray-200 opacity-50'
                }`}
                title={badge.description}
              >
                <div className="flex flex-col items-center text-center">
                  <BadgeIcon className="w-8 h-8 mb-2" />
                  <p className="font-bold text-sm">{badge.name}</p>
                  <p className="text-xs mt-1">
                    {isUnlocked ? '✓ Desbloqueado' : `${badge.required} tarefas`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}