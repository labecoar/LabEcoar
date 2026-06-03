// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScore } from "@/hooks/useScores";
import { useClaimReward, useMyRewardClaims, useRewards } from "@/hooks/useRewards";
import { useCepLookup } from "@/hooks/useCepLookup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  MapPin,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";

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
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [address, setAddress] = useState({
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });
  const { user } = useAuth();
  const { searchCep, isLoading: isCepLoading } = useCepLookup();

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

  const handleClaim = (reward) => {
    setShowAddressModal(true);
  };

  const handleCepBlur = async (cepValue) => {
    if (!cepValue) return;

    const data = await searchCep(cepValue);
    if (data) {
      setAddress((prev) => ({
        ...prev,
        endereco: data.endereco,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
      }));
    }
  };

  const handleConfirmClaim = async () => {
    // Validar endereço
    if (!address.cep || !address.endereco || !address.numero || !address.bairro || !address.cidade || !address.estado) {
      notifyWarning("Por favor, preencha todos os campos obrigatórios do endereço");
      return;
    }

    // Validar CEP (apenas números e 8 dígitos)
    if (!/^\d{5}-?\d{3}$/.test(address.cep)) {
      notifyWarning("CEP inválido. Use o formato: 12345-678");
      return;
    }

    // Validar estado (2 letras)
    if (!/^[A-Z]{2}$/.test(address.estado.toUpperCase())) {
      notifyWarning("Estado deve ter 2 letras (ex: SP, RJ)");
      return;
    }

    try {
      await claimRewardMutation.mutateAsync({ 
        rewardId: String(selectedReward.id).trim(),
        address: address
      });
      notifySuccess("Recompensa resgatada com sucesso! A equipe entrará em contato para confirmar o endereço de entrega.");
      setSelectedReward(null);
      setShowAddressModal(false);
      setAddress({
        cep: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
      });
    } catch (error) {
      notifyError(error?.message || "Erro ao resgatar recompensa");
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
                <DialogDescription>
                  Informações sobre a recompensa
                </DialogDescription>
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

        {/* MODAL DE ENDEREÇO */}
        {showAddressModal && selectedReward && (
          <Dialog open={showAddressModal} onOpenChange={() => setShowAddressModal(false)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  Endereço de Entrega
                </DialogTitle>
                <DialogDescription>
                  Para concluir seu resgate, adicione seu endereço de entrega
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-900">
                    Para concluir seu resgate, adicione seu endereço de entrega
                  </p>
                </div>

                <div className="space-y-4">
                  {/* CEP */}
                  <div>
                    <Label htmlFor="modal-cep" className="text-sm font-medium">CEP *</Label>
                    <div className="relative">
                      <Input
                        id="modal-cep"
                        placeholder="12345-678"
                        value={address.cep}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length > 5) {
                            value = value.slice(0, 5) + '-' + value.slice(5, 8);
                          }
                          setAddress({ ...address, cep: value });
                          
                          // Chamar API quando tiver 9 caracteres (5 dígitos + hífen + 3 dígitos)
                          if (value.length === 9) {
                            handleCepBlur(value);
                          }
                        }}
                        className="mt-1"
                        disabled={isCepLoading}
                        maxLength="9"
                      />
                      {isCepLoading && (
                        <Loader2 className="absolute right-3 top-3 w-5 h-5 text-emerald-600 animate-spin" />
                      )}
                    </div>
                  </div>

                  {/* Endereço */}
                  <div>
                    <Label htmlFor="modal-endereco" className="text-sm font-medium">Rua *</Label>
                    <Input
                      id="modal-endereco"
                      placeholder="Rua Principal"
                      value={address.endereco}
                      onChange={(e) => setAddress({ ...address, endereco: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  {/* Número e Complemento */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="modal-numero" className="text-sm font-medium">Número *</Label>
                      <Input
                        id="modal-numero"
                        placeholder="123"
                        value={address.numero}
                        onChange={(e) => setAddress({ ...address, numero: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="modal-complemento" className="text-sm font-medium">Complemento</Label>
                      <Input
                        id="modal-complemento"
                        placeholder="Apto 45"
                        value={address.complemento}
                        onChange={(e) => setAddress({ ...address, complemento: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Bairro */}
                  <div>
                    <Label htmlFor="modal-bairro" className="text-sm font-medium">Bairro *</Label>
                    <Input
                      id="modal-bairro"
                      placeholder="Centro"
                      value={address.bairro}
                      onChange={(e) => setAddress({ ...address, bairro: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  {/* Cidade e Estado */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="modal-cidade" className="text-sm font-medium">Cidade *</Label>
                      <Input
                        id="modal-cidade"
                        placeholder="São Paulo"
                        value={address.cidade}
                        onChange={(e) => setAddress({ ...address, cidade: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="modal-estado" className="text-sm font-medium">UF *</Label>
                      <Input
                        id="modal-estado"
                        placeholder="SP"
                        value={address.estado.toUpperCase()}
                        onChange={(e) => setAddress({ ...address, estado: e.target.value })}
                        className="mt-1 uppercase"
                        maxLength="2"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddressModal(false)}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={handleConfirmClaim}
                    disabled={claimRewardMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  >
                    {claimRewardMutation.isPending ? "Confirmando..." : "Confirmar Resgate"}
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
