import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function StatsCard({ title, value, icon: Icon, gradient, trend }) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-emerald-100 bg-white/80 backdrop-blur-sm overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardHeader>
      {trend && (
        <CardContent className="pt-0">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>{trend}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}