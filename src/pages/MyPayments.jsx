// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPayments, usePaymentInfo, useUpsertPaymentInfo } from "@/hooks/usePayments";
import {
  DollarSign,
  CreditCard,
  Clock,
  Edit,
  TrendingUp,
  Wallet,
  Download,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { notifyError, notifySuccess } from "@/lib/toast";
import { C, heading, body } from '@/lib/theme';
import { useUserScore } from "@/hooks/useScores";

const formatCurrency = (value) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export default function MyPayments() {
  const { user, profile } = useAuth();
  const { data: paymentInfo } = usePaymentInfo(user?.id);
  const { data: payments = [] } = useMyPayments(user?.id);
  const upsertPaymentInfo = useUpsertPaymentInfo(user?.id);
  const [isEditing, setIsEditing] = useState(false);
  const [paymentData, setPaymentData] = useState({
    account_type: "corrente",
    bank_name: "",
    bank_code: "",
    agency: "",
    account_number: "",
    account_digit: "",
    cpf: "",
    full_name: "",
    pix_key: "",
    pix_type: "cpf",
  });
  const { data: userScore } = useUserScore(user?.id);

  const [savedPaymentData, setSavedPaymentData] = useState(null);

  useEffect(() => {
    const saved = paymentInfo;
    const fallbackName = profile?.display_name || profile?.full_name || user?.email || "";
    const fallbackCpf = profile?.cpf || "";

    if (saved) {
      try {
        const parsed = saved;
        setSavedPaymentData(parsed || null);
        setPaymentData((prev) => ({
          ...prev,
          ...parsed,
          full_name: parsed?.full_name || fallbackName,
          cpf: parsed?.cpf || fallbackCpf,
        }));
        return;
      } catch {
        // Ignore parse errors and keep defaults
      }
    }

    setPaymentData((prev) => ({
      ...prev,
      full_name: fallbackName,
      cpf: fallbackCpf,
    }));
    setSavedPaymentData(null);
  }, [paymentInfo, profile, user?.email]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user?.id) return;

    const cpfDigits = onlyDigits(paymentData.cpf);
    if (cpfDigits.length !== 11) {
      notifyError("CPF invalido. Informe 11 digitos.");
      return;
    }

    const sanitizedData = {
      ...paymentData,
      bank_code: onlyDigits(paymentData.bank_code).slice(0, 4),
      agency: onlyDigits(paymentData.agency).slice(0, 8),
      account_number: onlyDigits(paymentData.account_number).slice(0, 16),
      account_digit: onlyDigits(paymentData.account_digit).slice(0, 1),
      cpf: formatCpf(paymentData.cpf),
    };

    upsertPaymentInfo.mutate(sanitizedData, {
      onSuccess: (saved) => {
        setPaymentData(saved);
        setSavedPaymentData(saved);
        setIsEditing(false);
        notifySuccess("Dados bancarios salvos com sucesso.");
      },
      onError: (error) => {
        notifyError(error?.message || "Nao foi possivel salvar os dados bancarios.");
      },
    });
  };

  const hasPaymentInfo = Boolean(
    paymentData.bank_name
    && paymentData.agency
    && paymentData.account_number
    && paymentData.account_digit
    && paymentData.full_name
    && paymentData.cpf
  );

  const pagChip = (status) => {
    if (status === "pago") return { bg: `${C.lime}1A`, color: C.lime };
    if (status === "pendente") return { bg: `${C.orange}1A`, color: C.orange };
    return { bg: `${C.blue}22`, color: "#7799FF" }; // processando
  };

  const totalReceived = payments
    .filter((p) => p.status === "pago")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const awaiting = payments
    .filter((p) => p.status === "pendente" || p.status === "processando")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: C.black }}>
      <div className="hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10" style={{ backgroundColor: `${C.black}F5`, backdropFilter: "blur(16px)", borderBottom: `1px solid rgba(var(--ink),0.05)` }}>
        <div className="flex items-center gap-3">
          <CreditCard size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Meus Pagamentos</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.onAccent }}>
          <Star size={11} fill={C.onAccent} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{userScore?.total_points || 0} pts</span>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none" style={{ ...heading, color: C.cream }}>
            Meus Pagamentos
          </h1>
          <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>Histórico de recebimentos por campanhas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
          <div className="p-5 rounded-2xl" style={{ backgroundColor: C.darkGreen, border: `1px solid ${C.lime}20` }}>
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={14} style={{ color: C.lime }} />
              <span style={{ fontSize: 11, color: `${C.cream}60` }}>Total recebido</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black leading-none tracking-tight" style={{ ...heading, color: C.lime }}>
              R$ {formatCurrency(totalReceived)}
            </div>
          </div>
          <div className="p-5 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.06)` }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} style={{ color: C.orange }} />
              <span style={{ fontSize: 11, color: `${C.cream}60` }}>A receber</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black leading-none tracking-tight" style={{ ...heading, color: C.orange }}>
              R$ {formatCurrency(awaiting)}
            </div>
          </div>
          <div className="p-5 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.06)` }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} style={{ color: C.cream }} />
              <span style={{ fontSize: 11, color: `${C.cream}60` }}>Campanhas pagas</span>
            </div>
            <div style={{ ...heading, fontSize: 34, fontWeight: 900, color: C.cream, lineHeight: 1, letterSpacing: "-0.03em" }}>
              {payments.filter(p => p.status === "pago").length}
            </div>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.07)`, marginBottom: 32 }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-6 h-6 text-emerald-600" />
              <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Dados Bancários</span>
            </div>
            {!isEditing && hasPaymentInfo && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:brightness-110"
                style={{ backgroundColor: C.darkGreen, color: C.lime, ...heading, fontWeight: 700, fontSize: 12 }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </button>
            )}
          </div>

          <div className="p-6">
            {!hasPaymentInfo && !isEditing ? (
              <div className="text-center py-8 flex flex-col items-center gap-4">
                <CreditCard size={36} style={{ color: `${C.cream}20` }} />
                <p style={{ color: `${C.cream}50` }}>Você ainda não cadastrou seus dados bancários.</p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl transition-all hover:brightness-110"
                  style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 13 }}
                >
                  Cadastrar Dados Bancarios
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tipo de Conta + Banco */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>Tipo de Conta *</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl outline-none appearance-none"
                      style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                      disabled={!isEditing}
                      value={paymentData.account_type}
                      onChange={(e) => setPaymentData({ ...paymentData, account_type: e.target.value })}
                    >
                      <option value="corrente" style={{ backgroundColor: C.card }}>Conta Corrente</option>
                      <option value="poupanca" style={{ backgroundColor: C.card }}>Conta Poupança</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>Nome do Banco *</label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl outline-none"
                      style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                      placeholder="Ex: Banco do Brasil"
                      readOnly={!isEditing}
                      value={paymentData.bank_name}
                      onChange={(e) => setPaymentData({ ...paymentData, bank_name: e.target.value })}
                    />
                  </div>
                </div>

                {/* Código + Agência + Conta */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>Código do Banco</label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl outline-none"
                      style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                      placeholder="Ex: 001"
                      readOnly={!isEditing}
                      value={paymentData.bank_code}
                      onChange={(e) => setPaymentData({ ...paymentData, bank_code: onlyDigits(e.target.value).slice(0, 4) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>Agência *</label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl outline-none"
                      style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                      placeholder="Ex: 1234"
                      readOnly={!isEditing}
                      value={paymentData.agency}
                      onChange={(e) => setPaymentData({ ...paymentData, agency: onlyDigits(e.target.value).slice(0, 8) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>Conta + Dígito *</label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 px-4 py-2.5 rounded-xl outline-none"
                        style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                        placeholder="12345"
                        readOnly={!isEditing}
                        value={paymentData.account_number}
                        onChange={(e) => setPaymentData({ ...paymentData, account_number: onlyDigits(e.target.value).slice(0, 16) })}
                      />
                      <input
                        className="w-16 px-4 py-2.5 rounded-xl outline-none"
                        style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                        placeholder="6"
                        readOnly={!isEditing}
                        value={paymentData.account_digit}
                        onChange={(e) => setPaymentData({ ...paymentData, account_digit: onlyDigits(e.target.value).slice(0, 1) })}
                        maxLength={1}
                      />
                    </div>
                  </div>
                </div>

                {/* Titular + CPF */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>Nome Completo do Titular *</label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl outline-none"
                      style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                      placeholder="Como consta no banco"
                      readOnly={!isEditing}
                      value={paymentData.full_name}
                      onChange={(e) => setPaymentData({ ...paymentData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>CPF *</label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl outline-none"
                      style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                      placeholder="000.000.000-00"
                      readOnly={!isEditing}
                      value={paymentData.cpf}
                      onChange={(e) => setPaymentData({ ...paymentData, cpf: formatCpf(e.target.value) })}
                    />
                  </div>
                </div>

                {/* PIX */}
                <div style={{ borderTop: `1px solid rgba(var(--ink),0.07)`, paddingTop: 24 }}>
                  <h3 style={{ ...heading, fontSize: 13, fontWeight: 700, color: `${C.cream}60`, marginBottom: 16 }}>Chave PIX (Opcional)</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>Tipo de Chave</label>
                      <select
                        className="w-full px-4 py-2.5 rounded-xl outline-none appearance-none"
                        style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                        disabled={!isEditing}
                        value={paymentData.pix_type}
                        onChange={(e) => setPaymentData({ ...paymentData, pix_type: e.target.value })}
                      >
                        <option value="cpf" style={{ backgroundColor: C.card }}>CPF</option>
                        <option value="email" style={{ backgroundColor: C.card }}>Email</option>
                        <option value="telefone" style={{ backgroundColor: C.card }}>Telefone</option>
                        <option value="aleatoria" style={{ backgroundColor: C.card }}>Chave Aleatória</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>Chave PIX</label>
                      <input
                        className="w-full px-4 py-2.5 rounded-xl outline-none"
                        style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid ${isEditing ? "rgba(var(--ink),0.14)" : "rgba(var(--ink),0.07)"}`, color: isEditing ? C.cream : `${C.cream}80`, fontSize: 13, ...body }}
                        placeholder="Digite sua chave PIX"
                        readOnly={!isEditing}
                        value={paymentData.pix_key}
                        onChange={(e) => setPaymentData({ ...paymentData, pix_key: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Botões — só aparecem ao editar */}
                {isEditing && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (savedPaymentData) setPaymentData((prev) => ({ ...prev, ...savedPaymentData }));
                        setIsEditing(false);
                      }}
                      className="flex-1 h-12 rounded-xl transition-all hover:brightness-110"
                      style={{ backgroundColor: "rgba(var(--ink),0.04)", border: `1px solid rgba(var(--ink),0.07)`, color: `${C.cream}80`, ...heading, fontWeight: 700, fontSize: 14 }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 h-12 rounded-xl transition-all hover:brightness-110"
                      style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}
                    >
                      {upsertPaymentInfo.isPending ? "Salvando..." : "Salvar Dados"}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid rgba(var(--ink),0.07)` }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
            <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Histórico de Pagamentos</span>
          </div>
          <div className="p-6">
            {payments.length === 0 ? (
              <div className="text-center py-8 flex flex-col items-center gap-4">
                <DollarSign size={36} style={{ color: `${C.cream}20` }} />
                <p style={{ color: `${C.cream}50` }}>Nenhum pagamento registrado ainda.</p>
              </div>
            ) : (
              <>
                <div className="flex px-5 py-3 rounded-t-lg" style={{ backgroundColor: C.surface }}>
                  <div style={{ width: "40%", fontSize: 10, fontWeight: 700, color: `${C.cream}40`, letterSpacing: "0.08em" }}>Descrição</div>
                  <div style={{ width: "16%", fontSize: 10, fontWeight: 700, color: `${C.cream}40`, letterSpacing: "0.08em" }}>Campanha</div>
                  <div style={{ width: "16%", fontSize: 10, fontWeight: 700, color: `${C.cream}40`, letterSpacing: "0.08em" }}>Data</div>
                  <div style={{ width: "16%", fontSize: 10, fontWeight: 700, color: `${C.cream}40`, letterSpacing: "0.08em" }}>Valor</div>
                  <div style={{ width: "12%", fontSize: 10, fontWeight: 700, color: `${C.cream}40`, letterSpacing: "0.08em" }}>Status</div>
                </div>
                {payments.map((p, i) => {
                  const { bg, color } = pagChip(p.status);
                  return (
                    <div
                      key={p.id}
                      className="flex px-5 py-4 items-center transition-colors hover:brightness-110"
                      style={{ backgroundColor: i % 2 === 0 ? C.card : C.cardDeep, borderBottom: i < payments.length - 1 ? `1px solid rgba(var(--ink),0.04)` : "none" }}
                    >
                      <div className="flex items-center gap-3" style={{ width: "40%" }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${C.lime}12`, color: C.lime }}>
                          <DollarSign size={13} />
                        </div>
                        <span style={{ fontSize: 13, color: C.cream, fontWeight: 500 }} className="truncate">{p.metrics_submission?.task_title || 'Pagamento'}</span>
                      </div>
                      <div style={{ width: "16%" }}>
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "rgba(var(--ink),0.06)", color: `${C.cream}55` }}>{p.quarter}</span>
                      </div>
                      <div style={{ width: "16%", fontSize: 12, color: `${C.cream}45` }}>{format(new Date(p.created_at), "dd MMM yyyy", { locale: ptBR })}</div>
                      <div style={{ width: "16%", ...heading, fontSize: 15, fontWeight: 800, color: p.status === "pago" ? C.lime : `${C.cream}70` }}>
                        R$ {formatCurrency(p.amount)}
                      </div>
                      <div style={{ width: "12%" }}>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: bg, color }}>{p.status}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* <div className="flex justify-end mt-5">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:brightness-110" style={{ backgroundColor: "rgba(var(--ink),0.06)", color: `${C.cream}70`, fontSize: 12, ...body }}>
            <Download size={13} /> Exportar relatório
          </button>
        </div> */}
      </div>
    </main>
  );
}
