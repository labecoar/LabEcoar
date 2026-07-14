// @ts-nocheck
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScore } from "@/hooks/useScores";
import { useClaimReward, useMyRewardClaims, useRewards } from "@/hooks/useRewards";
import { useCepLookup } from "@/hooks/useCepLookup";
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
  Lock,
  Award,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";
import { C, heading, body } from '@/lib/theme';

const CATEGORY_INFO = {
  alimentacao: { name: "Alimentação", icon: Apple, colorHex: C.lime },
  educacao: { name: "Educação", icon: GraduationCap, colorHex: C.blue },
  cultura: { name: "Cultura", icon: Music, colorHex: "#AA66FF" },
  bem_estar: { name: "Bem-Estar", icon: Heart, colorHex: "#FF66B2" },
  tecnologia: { name: "Tecnologia", icon: Smartphone, colorHex: C.orange },
  outros: { name: "Outros", icon: Package, colorHex: `${C.cream}80` },
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
      <div style={{ minHeight: "100vh", background: C.black, display: "flex", alignItems: "center", justifyItems: "center" }}>
        <div style={{ textAlign: "center", margin: "auto" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: `2px solid ${C.lime}`, borderTopColor: "transparent",
            margin: "0 auto 16px", animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: `${C.cream}45`, fontSize: 14 }}>Carregando recompensas...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const inputStyle = { backgroundColor: C.black_light, border: `1px solid rgba(var(--ink),0.1)`, color: C.cream, ...body, fontSize: 14 };
  const labelStyle = { ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", display: "block", marginBottom: 6 };

  return (
    <div style={{ minHeight: "100vh", background: C.black, ...body }}>
      {/* Header Fixo */}
      <div className="hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10" style={{ backgroundColor: `${C.black}F5`, backdropFilter: "blur(16px)", borderBottom: `1px solid rgba(var(--ink),0.05)` }}>
        <div className="flex items-center gap-3">
          <Gift size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Recompensas</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.onAccent }}>
          <Star size={11} fill={C.onAccent} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{currentPoints} pts</span>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0">
        {/* Hero */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none" style={{ ...heading, color: C.cream }}>Recompensas</h1>
          <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>Converta seus pontos em prêmios reais.</p>
        </div>

        {/* Balance Card */}
        <div className="p-4 sm:p-6 rounded-2xl mb-6 md:mb-8 flex flex-col md:flex-row md:items-center gap-6 md:gap-8" style={{ background: `linear-gradient(135deg, ${C.darkGreen} 0%, ${C.black} 100%)`, border: `1px solid ${C.lime}22` }}>
          <div>
            <div style={{ fontSize: 11, color: `${C.cream}50`, marginBottom: 4 }}>Saldo disponível</div>
            <div className="text-4xl sm:text-5xl font-black leading-none tracking-tighter" style={{ ...heading, color: C.lime }}>{currentPoints}</div>
            <div style={{ fontSize: 13, color: `${C.cream}40`, marginTop: 2 }}>pontos</div>
          </div>
          <div className="flex-1 w-full max-w-md ml-auto">
            <div style={{ fontSize: 12, color: `${C.cream}50`, marginBottom: 10 }}>Seu saldo em conta</div>
            <div className="relative h-2 rounded-full w-full" style={{ backgroundColor: "rgba(var(--ink),0.07)" }}>
              <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${Math.min(100, (currentPoints / (currentPoints + 500)) * 100)}%`, background: `linear-gradient(90deg, ${C.lime} 0%, ${C.blue} 100%)` }} />
            </div>
            <div className="flex justify-between mt-2">
              <span style={{ fontSize: 11, color: `${C.cream}40` }}>0</span>
              <span style={{ fontSize: 11, color: C.lime, fontWeight: 700 }}>Continue acumulando!</span>
            </div>
          </div>
        </div>

        {myClaims.length > 0 && (
          <div className="mb-8">
            <h2 style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream, marginBottom: 16 }}>Meus Resgates Recentes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myClaims.slice(0, 4).map((claim) => (
                <div key={claim.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.06)` }}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--ink),0.04)", color: C.cream }}>
                      <ShoppingCart size={16} />
                    </div>
                    <div>
                      <p style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream }}>{claim.reward_title}</p>
                      <p style={{ fontSize: 12, color: `${C.cream}50`, marginTop: 2 }}>{claim.points_spent} pts</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{
                    backgroundColor: claim.status === "entregue" ? `${C.lime}1A` : claim.status === "processando" ? "rgba(68,102,255,0.12)" : `${C.orange}1A`,
                    color: claim.status === "entregue" ? C.lime : claim.status === "processando" ? "#8899FF" : C.orange
                  }}>
                    {claim.status === "entregue" ? "Entregue" : claim.status === "processando" ? "Processando" : "Pendente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {[{ key: "todas", name: "Todas" }, ...Object.entries(CATEGORY_INFO).map(([k, v]) => ({ key: k, name: v.name }))].map((c) => {
            const active = c.key === selectedCategory;
            return (
              <button key={c.key} onClick={() => setSelectedCategory(c.key)} className="shrink-0 px-4 py-2 rounded-xl text-sm transition-all duration-150" style={{ backgroundColor: active ? C.lime : "rgba(var(--ink),0.06)", color: active ? C.black : `${C.cream}70`, fontWeight: active ? 700 : 400, ...heading, fontSize: 13 }}>
                {c.name}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRewards.map((reward) => {
            const categoryInfo = CATEGORY_INFO[reward.category] || CATEGORY_INFO.outros;
            const CategoryIcon = categoryInfo.icon;
            const canClaim = hasEnoughPoints(reward) && isAvailable(reward);

            return (
              <div key={reward.id} className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:brightness-110 cursor-pointer" onClick={() => setSelectedReward(reward)} style={{ backgroundColor: C.card, border: `1px solid ${canClaim ? `${C.lime}18` : "rgba(var(--ink),0.06)"}`, opacity: canClaim ? 1 : 0.7 }}>
                <div className="h-1 w-full" style={{ backgroundColor: canClaim ? C.lime : "rgba(var(--ink),0.1)" }} />

                {reward.image_url && (
                  <div className="h-40 w-full bg-black/40 overflow-hidden">
                    <img
                      src={reward.image_url}
                      alt={reward.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-5 flex flex-col gap-4 flex-1">
                  <div className="flex items-start justify-between">
                    <CategoryIcon size={24} style={{ color: canClaim ? C.lime : `${C.cream}40` }} />
                    {!canClaim && <Lock size={14} style={{ color: `${C.cream}30` }} />}
                    {canClaim && <Award size={14} style={{ color: C.lime }} />}
                  </div>
                  <div className="flex-1">
                    <h3 style={{ ...heading, fontSize: 16, fontWeight: 800, color: canClaim ? C.cream : `${C.cream}70`, marginBottom: 6 }}>{reward.title}</h3>
                    <p style={{ fontSize: 12, color: `${C.cream}45`, lineHeight: 1.5 }} className="line-clamp-2">{reward.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 mt-2" style={{ borderTop: `1px solid rgba(var(--ink),0.06)` }}>
                    <div>
                      <div style={{ ...heading, fontSize: 20, fontWeight: 900, color: canClaim ? C.lime : `${C.cream}35`, lineHeight: 1 }}>{reward.points_required} pts</div>
                    </div>
                    <button
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ backgroundColor: canClaim ? C.lime : "rgba(var(--ink),0.06)", color: canClaim ? C.black : `${C.cream}30`, ...heading, cursor: canClaim ? "pointer" : "not-allowed" }}
                      disabled={!canClaim}
                      onClick={(e) => { e.stopPropagation(); if (canClaim) handleClaim(reward); }}
                    >
                      {canClaim ? "Resgatar" : `Faltam ${reward.points_required - currentPoints}`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredRewards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Gift size={36} style={{ color: `${C.cream}20` }} />
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>Nenhuma recompensa disponível.</p>
          </div>
        )}

        {/* Modal de Detalhes da Recompensa */}
        {selectedReward && (
          <Dialog open={!!selectedReward && !showAddressModal} onOpenChange={() => setSelectedReward(null)}>
            <DialogContent className="sm:max-w-xl p-0 border-0 bg-transparent overflow-hidden shadow-none [&>button]:text-[rgba(var(--ink),0.5)] [&>button]:hover:opacity-100 [&>button]:top-4 [&>button]:right-5 [&>button]:scale-125" aria-describedby={undefined} >
              <DialogTitle className="sr-only">Detalhes da Recompensa</DialogTitle>
              <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.1)` }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
                  <span style={{ ...heading, fontSize: 18, fontWeight: 700, color: C.cream }}>{selectedReward?.title}</span>
                </div>

                <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
                  {selectedReward?.image_url && (
                    <div
                      className="cursor-zoom-in"
                      onClick={() => openOriginalImage(selectedReward.image_url)}
                      title="Clique para ver em tela cheia"
                    >
                      <img
                        src={selectedReward.image_url}
                        alt={selectedReward.title}
                        className="w-full h-48 object-cover rounded-xl border border-[rgba(var(--ink),0.1)] hover:brightness-110 transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <h3 style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 8 }}>Descrição</h3>
                    <p style={{ fontSize: 13, color: `${C.cream}60`, lineHeight: 1.65 }}>{selectedReward?.description}</p>
                  </div>

                  {selectedReward?.terms && (
                    <div>
                      <h3 style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 8 }}>Termos e Condições</h3>
                      <p style={{ fontSize: 13, color: `${C.cream}60`, lineHeight: 1.65 }}>{selectedReward.terms}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid rgba(var(--ink),0.08)` }}>
                    <div>
                      <span style={{ fontSize: 11, color: `${C.cream}50`, block: "block", marginBottom: 2 }}>Custo da Recompensa</span>
                      <div style={{ ...heading, fontSize: 24, fontWeight: 900, color: C.lime }}>{selectedReward?.points_required} pts</div>
                    </div>
                    <div className="text-right">
                      <span style={{ fontSize: 11, color: `${C.cream}50`, block: "block", marginBottom: 2 }}>Seu Saldo Atual</span>
                      <div style={{ ...heading, fontSize: 24, fontWeight: 900, color: C.cream }}>{currentPoints} pts</div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setSelectedReward(null)} className="flex-1 h-12 rounded-xl transition-all hover:bg-[rgba(var(--ink),0.05)]" style={{ color: `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}>
                      Voltar
                    </button>
                    <button
                      disabled={!hasEnoughPoints(selectedReward) || !isAvailable(selectedReward)}
                      onClick={() => handleClaim(selectedReward)}
                      className="flex-1 h-12 rounded-xl transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                    >
                      {claimRewardMutation.isPending ? "Processando..." : "Resgatar Agora"}
                    </button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* MODAL DE ENDEREÇO */}
        <Dialog open={showAddressModal} onOpenChange={() => setShowAddressModal(false)}>
          <DialogContent className="sm:max-w-xl p-0 border-0 bg-transparent overflow-hidden shadow-none [&>button]:text-[rgba(var(--ink),0.5)] [&>button]:hover:opacity-100 [&>button]:top-4 [&>button]:right-5 [&>button]:scale-125" aria-describedby={undefined}>
            <DialogTitle className="sr-only">Endereço de Entrega</DialogTitle>
            <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.1)` }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
                <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>Endereço de Entrega</span>
              </div>

              <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
                {/* CEP */}
                <div>
                  <label style={labelStyle}>CEP *</label>
                  <div className="relative">
                    <input
                      style={inputStyle}
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
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      disabled={isCepLoading}
                      maxLength="9"
                    />
                    {isCepLoading && (
                      <Loader2 className="absolute right-3 top-3 w-5 h-5 text-[rgba(var(--ink),0.5)] animate-spin" />
                    )}
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <label style={labelStyle}>RUA *</label>
                  <input
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    placeholder="Rua Principal"
                    value={address.endereco}
                    onChange={(e) => setAddress({ ...address, endereco: e.target.value })}
                  />
                </div>

                {/* Número e Complemento */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>NÚMERO *</label>
                    <input
                      style={inputStyle}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      placeholder="123"
                      value={address.numero}
                      onChange={(e) => setAddress({ ...address, numero: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>COMPLEMENTO</label>
                    <input
                      style={inputStyle}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      placeholder="Apto 45"
                      value={address.complemento}
                      onChange={(e) => setAddress({ ...address, complemento: e.target.value })}
                    />
                  </div>
                </div>

                {/* Bairro */}
                <div>
                  <label style={labelStyle}>BAIRRO *</label>
                  <input
                    style={inputStyle}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    placeholder="Centro"
                    value={address.bairro}
                    onChange={(e) => setAddress({ ...address, bairro: e.target.value })}
                  />
                </div>

                {/* Cidade e Estado */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label style={labelStyle}>CIDADE *</label>
                    <input
                      style={inputStyle}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      placeholder="São Paulo"
                      value={address.cidade}
                      onChange={(e) => setAddress({ ...address, cidade: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>UF *</label>
                    <input
                      style={inputStyle}
                      className="w-full px-4 py-3 rounded-xl outline-none uppercase"
                      placeholder="SP"
                      value={address.estado.toUpperCase()}
                      onChange={(e) => setAddress({ ...address, estado: e.target.value })}
                      maxLength="2"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowAddressModal(false)} className="flex-1 h-12 rounded-xl transition-all hover:bg-[rgba(var(--ink),0.05)]" style={{ color: `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}>
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirmClaim}
                    disabled={claimRewardMutation.isPending}
                    className="flex-1 h-12 rounded-xl transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                  >
                    {claimRewardMutation.isPending ? "Confirmando..." : "Confirmar Resgate"}
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
