// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScore } from "@/hooks/useScores";
import { useClaimReward, useMyRewardClaims, useRewards } from "@/hooks/useRewards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gift,
  Star,
  ShoppingCart,
  Apple,
  GraduationCap,
  Music,
  Heart,
  Smartphone,
  Package,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORY_INFO = {
  alimentacao: { name: "Alimentacao", icon: Apple, color: "bg-green-100 text-green-700 border-green-200" },
  educacao: { name: "Educacao", icon: GraduationCap, color: "bg-blue-100 text-blue-700 border-blue-200" },
  cultura: { name: "Cultura", icon: Music, color: "bg-purple-100 text-purple-700 border-purple-200" },
  bem_estar: { name: "Bem-Estar", icon: Heart, color: "bg-pink-100 text-pink-700 border-pink-200" },
  tecnologia: { name: "Tecnologia", icon: Smartphone, color: "bg-gray-100 text-gray-700 border-gray-200" },
  outros: { name: "Outros", icon: Package, color: "bg-orange-100 text-orange-700 border-orange-200" },
};

export default function Rewards() {
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [selectedReward, setSelectedReward] = useState(null);
  const { user } = useAuth();

  const { data: rewards = [], isLoading } = useRewards();
  const { data: myClaims = [] } = useMyRewardClaims(user?.id);
  const { data: userScore } = useUserScore(user?.id);
  const claimRewardMutation = useClaimReward(user?.id);

  const currentPoints = Number(userScore?.total_points || 0);

  const filteredRewards = selectedCategory === "todas"
    ? rewards
    : rewards.filter((reward) => reward.category === selectedCategory);

  const hasEnoughPoints = (reward) => currentPoints >= Number(reward.points_required || 0);

  const isAvailable = (reward) => {
    if (reward.quantity_available == null) return true;
    return Number(reward.quantity_claimed || 0) < Number(reward.quantity_available || 0);
  };

  const handleClaim = async (reward) => {
    try {
      await claimRewardMutation.mutateAsync(reward.id);
      alert("Recompensa resgatada com sucesso! ✅\nAguarde o contato da equipe com instrucoes.");
      setSelectedReward(null);
    } catch (error) {
      alert(error?.message || "Erro ao resgatar recompensa");
    }
  };

  const openOriginalImage = (imageUrl) => {
    if (!imageUrl) return;
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando recompensas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Loja de Recompensas
              </h1>
              <p className="text-gray-600 mt-2">Troque seus pontos por beneficios incriveis</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Seus pontos (trimestre atual)</p>
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                <span className="text-3xl font-bold text-gray-900">{currentPoints}</span>
              </div>
            </div>
          </div>
        </div>

        {myClaims.length > 0 && (
          <Card className="mb-8 shadow-lg border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                Meus Resgates Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {myClaims.slice(0, 4).map((claim) => (
                  <div key={claim.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-emerald-200">
                    <div>
                      <p className="font-medium text-gray-900">{claim.reward_title}</p>
                      <p className="text-sm text-gray-500">{claim.points_spent} pontos</p>
                    </div>
                    <Badge className={
                      claim.status === "entregue"
                        ? "bg-green-100 text-green-700"
                        : claim.status === "processando"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                    }>
                      {claim.status === "entregue" ? "Entregue" : claim.status === "processando" ? "Processando" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="flex flex-wrap h-auto gap-2 bg-emerald-50 p-2">
                <TabsTrigger value="todas" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  Todas
                </TabsTrigger>
                {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                  >
                    <info.icon className="w-4 h-4 mr-1" />
                    {info.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRewards.map((reward) => {
            const categoryInfo = CATEGORY_INFO[reward.category] || CATEGORY_INFO.outros;
            const CategoryIcon = categoryInfo.icon;
            const canClaim = hasEnoughPoints(reward) && isAvailable(reward);

            return (
              <Card
                key={reward.id}
                className="shadow-lg hover:shadow-xl transition-all duration-300 border-emerald-100 bg-white overflow-hidden group cursor-pointer"
                onClick={() => setSelectedReward(reward)}
              >
                {reward.image_url && (
                  <div className="h-48 w-full bg-gradient-to-br from-emerald-100 to-teal-100 overflow-hidden block text-left">
                    <img
                      src={reward.image_url}
                      alt={reward.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={`${categoryInfo.color} border font-medium`}>
                      <CategoryIcon className="w-3 h-3 mr-1" />
                      {categoryInfo.name}
                    </Badge>
                    {!isAvailable(reward) && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        Esgotado
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl group-hover:text-emerald-600 transition-colors">
                    {reward.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600 text-sm line-clamp-2">{reward.description}</p>

                  {reward.partner_name && (
                    <p className="text-xs text-gray-500">Parceiro: {reward.partner_name}</p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-emerald-100">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      <span className="text-2xl font-bold text-gray-900">{reward.points_required}</span>
                      <span className="text-sm text-gray-500">pts</span>
                    </div>
                    {canClaim ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        Disponivel
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-500">
                        {!hasEnoughPoints(reward) ? "Pontos insuficientes" : "Indisponivel"}
                      </Badge>
                    )}
                  </div>

                  {reward.quantity_available != null && (
                    <div className="text-xs text-gray-500">
                      {Math.max(0, Number(reward.quantity_available || 0) - Number(reward.quantity_claimed || 0))} de {reward.quantity_available} disponiveis
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredRewards.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 text-lg">Nenhuma recompensa disponivel nesta categoria</p>
          </div>
        )}

        {selectedReward && (
          <Dialog open={!!selectedReward} onOpenChange={() => setSelectedReward(null)}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedReward.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {selectedReward.image_url && (
                  <button
                    type="button"
                    className="w-full h-64 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl overflow-hidden block text-left"
                    onClick={() => openOriginalImage(selectedReward.image_url)}
                    title="Abrir imagem original"
                  >
                    <img
                      src={selectedReward.image_url}
                      alt={selectedReward.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Descricao</h3>
                  <p className="text-gray-600">{selectedReward.description}</p>
                </div>

                {selectedReward.partner_name && (
                  <div>
                    <h3 className="font-semibold mb-2">Parceiro</h3>
                    <p className="text-gray-600">{selectedReward.partner_name}</p>
                  </div>
                )}

                {selectedReward.validity_months && (
                  <div>
                    <h3 className="font-semibold mb-2">Validade</h3>
                    <p className="text-gray-600">{selectedReward.validity_months} meses apos o resgate</p>
                  </div>
                )}

                {selectedReward.terms && (
                  <div>
                    <h3 className="font-semibold mb-2">Termos e Condicoes</h3>
                    <p className="text-sm text-gray-600">{selectedReward.terms}</p>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Custo</p>
                    <div className="flex items-center gap-2">
                      <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                      <span className="text-3xl font-bold text-gray-900">{selectedReward.points_required}</span>
                      <span className="text-gray-500">pontos</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Voce tem</p>
                    <div className="flex items-center gap-2">
                      <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                      <span className="text-3xl font-bold text-gray-900">{currentPoints}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedReward(null)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => handleClaim(selectedReward)}
                    disabled={!hasEnoughPoints(selectedReward) || !isAvailable(selectedReward) || claimRewardMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  >
                    {claimRewardMutation.isPending ? "Resgatando..." : "Resgatar Agora"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
