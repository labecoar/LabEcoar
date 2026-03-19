// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScore } from "@/hooks/useScores";
import { useMyPayments, usePaymentInfo, useUpsertPaymentInfo } from "@/hooks/usePayments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Edit,
  TrendingUp,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORY_VALUES = {
  voz_e_violao: { value: 1000, name: "Voz e Violao", emoji: "🎸", color: "from-yellow-400 to-orange-500", range: "50-200 pts" },
  dueto: { value: 2000, name: "Dueto", emoji: "🎤", color: "from-pink-400 to-rose-500", range: "201-500 pts" },
  fanfarra: { value: 3500, name: "Fanfarra", emoji: "🎺", color: "from-blue-400 to-cyan-500", range: "501-1000 pts" },
  carnaval: { value: 4500, name: "Carnaval", emoji: "🎉", color: "from-orange-400 to-red-500", range: "999+ pts" },
};

const getCategoryByPoints = (points = 0) => {
  if (points >= 1001) return "carnaval";
  if (points >= 501) return "fanfarra";
  if (points >= 201) return "dueto";
  return "voz_e_violao";
};

const getCurrentQuarterLabel = () => {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Q${quarter}-${now.getFullYear()}`;
};

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
  const { data: userScore } = useUserScore(user?.id);
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

  const [savedPaymentData, setSavedPaymentData] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");

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
      alert("CPF invalido. Informe 11 digitos.");
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
        setSaveMessage("Dados bancarios salvos com sucesso.");
      },
      onError: (error) => {
        alert(error?.message || "Nao foi possivel salvar os dados bancarios.");
      },
    });
  };

  useEffect(() => {
    if (!saveMessage) return;
    const timeout = setTimeout(() => setSaveMessage(""), 3500);
    return () => clearTimeout(timeout);
  }, [saveMessage]);

  const hasPaymentInfo = Boolean(
    paymentData.bank_name
    && paymentData.agency
    && paymentData.account_number
    && paymentData.account_digit
    && paymentData.full_name
    && paymentData.cpf
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "pago":
        return "bg-green-100 text-green-700 border-green-200";
      case "processando":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "erro":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pago":
        return <CheckCircle className="w-4 h-4" />;
      case "processando":
        return <Clock className="w-4 h-4" />;
      case "erro":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const currentPoints = Number(userScore?.total_points || 0);
  const currentCategory = getCategoryByPoints(currentPoints);
  const categoryInfo = CATEGORY_VALUES[currentCategory];
  const currentQuarter = getCurrentQuarterLabel();

  const totalReceived = payments
    .filter((p) => p.status === "pago")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const awaiting = payments
    .filter((p) => p.status === "pendente" || p.status === "processando")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Meus Pagamentos
          </h1>
          <p className="text-gray-600 mt-2">Gerencie seus dados bancarios e acompanhe seus pagamentos</p>
        </div>

        {saveMessage && (
          <div className="mb-6 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
            {saveMessage}
          </div>
        )}

        <Card className="shadow-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 mb-8">
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Ganho Previsto no Trimestre {currentQuarter}</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="text-5xl font-black text-emerald-700">
                    R$ {categoryInfo?.value.toLocaleString("pt-BR")}
                  </h2>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${categoryInfo?.color} text-white font-bold shadow-lg`}>
                    <span className="text-xl">{categoryInfo?.emoji}</span>
                    <span>{categoryInfo?.name}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">Com base nos seus {currentPoints} pontos atuais</p>
              </div>
              <Award className="w-16 h-16 text-emerald-600 opacity-20" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6 border-t border-emerald-200">
              {Object.entries(CATEGORY_VALUES).map(([key, info]) => {
                const isCurrentCategory = key === currentCategory;
                return (
                  <div
                    key={key}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isCurrentCategory
                        ? "bg-white border-emerald-500 shadow-md scale-105"
                        : "bg-white/50 border-gray-200"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">{info.emoji}</div>
                      <p className="font-bold text-sm text-gray-900 mb-1">{info.name}</p>
                      <p className="text-xs text-gray-600 mb-2">{info.range}</p>
                      <p className={`text-lg font-bold ${isCurrentCategory ? "text-emerald-700" : "text-gray-700"}`}>
                        R$ {info.value.toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">Como funciona o pagamento?</p>
                  <p className="text-sm text-blue-700">
                    Ao final do trimestre, voce recebera o valor da categoria em que terminar.
                    Quanto mais pontos voce acumular, maior sera sua categoria e seu ganho.
                    Os pontos sao zerados a cada trimestre, mas voce sempre comeca na categoria conquistada.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-lg border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Recebido</p>
                  <p className="text-3xl font-bold text-green-700">R$ {formatCurrency(totalReceived)}</p>
                </div>
                <DollarSign className="w-12 h-12 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Aguardando</p>
                  <p className="text-3xl font-bold text-yellow-700">R$ {formatCurrency(awaiting)}</p>
                </div>
                <Clock className="w-12 h-12 text-yellow-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Pagamentos</p>
                  <p className="text-3xl font-bold text-blue-700">{payments.length}</p>
                </div>
                <Calendar className="w-12 h-12 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm mb-8">
          <CardHeader className="border-b border-emerald-100 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-emerald-600" />
              Dados Bancarios
            </CardTitle>
            {!isEditing && hasPaymentInfo && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </CardHeader>

          <CardContent className="pt-6">
            {!hasPaymentInfo && !isEditing ? (
              <div className="text-center py-8">
                <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">Voce ainda nao cadastrou seus dados bancarios</p>
                <Button onClick={() => setIsEditing(true)} className="bg-gradient-to-r from-emerald-500 to-teal-600">
                  Cadastrar Dados Bancarios
                </Button>
              </div>
            ) : isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="account_type">Tipo de Conta *</Label>
                    <Select
                      value={paymentData.account_type}
                      onValueChange={(value) => setPaymentData({ ...paymentData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Conta Corrente</SelectItem>
                        <SelectItem value="poupanca">Conta Poupanca</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Nome do Banco *</Label>
                    <Input
                      id="bank_name"
                      placeholder="Ex: Banco do Brasil"
                      value={paymentData.bank_name}
                      onChange={(e) => setPaymentData({ ...paymentData, bank_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bank_code">Codigo do Banco</Label>
                    <Input
                      id="bank_code"
                      placeholder="Ex: 001"
                      value={paymentData.bank_code}
                      onChange={(e) => setPaymentData({ ...paymentData, bank_code: onlyDigits(e.target.value).slice(0, 4) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agency">Agencia *</Label>
                    <Input
                      id="agency"
                      placeholder="Ex: 1234"
                      value={paymentData.agency}
                      onChange={(e) => setPaymentData({ ...paymentData, agency: onlyDigits(e.target.value).slice(0, 8) })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account_number">Conta + Digito *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="account_number"
                        placeholder="12345"
                        value={paymentData.account_number}
                        onChange={(e) => setPaymentData({ ...paymentData, account_number: onlyDigits(e.target.value).slice(0, 16) })}
                        required
                        className="flex-1"
                      />
                      <Input
                        placeholder="6"
                        value={paymentData.account_digit}
                        onChange={(e) => setPaymentData({ ...paymentData, account_digit: onlyDigits(e.target.value).slice(0, 1) })}
                        required
                        className="w-16"
                        maxLength={1}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo do Titular *</Label>
                    <Input
                      id="full_name"
                      placeholder="Como consta no banco"
                      value={paymentData.full_name}
                      onChange={(e) => setPaymentData({ ...paymentData, full_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={paymentData.cpf}
                      onChange={(e) => setPaymentData({ ...paymentData, cpf: formatCpf(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Chave PIX (Opcional)</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="pix_type">Tipo de Chave</Label>
                      <Select
                        value={paymentData.pix_type}
                        onValueChange={(value) => setPaymentData({ ...paymentData, pix_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="telefone">Telefone</SelectItem>
                          <SelectItem value="aleatoria">Chave Aleatoria</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pix_key">Chave PIX</Label>
                      <Input
                        id="pix_key"
                        placeholder="Digite sua chave PIX"
                        value={paymentData.pix_key}
                        onChange={(e) => setPaymentData({ ...paymentData, pix_key: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (savedPaymentData) {
                        setPaymentData((prev) => ({ ...prev, ...savedPaymentData }));
                      }
                      setIsEditing(false);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600">
                    {upsertPaymentInfo.isPending ? "Salvando..." : "Salvar Dados"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Tipo de Conta</p>
                    <p className="font-medium">{paymentData.account_type === "corrente" ? "Conta Corrente" : "Conta Poupanca"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Banco</p>
                    <p className="font-medium">{paymentData.bank_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Agencia</p>
                    <p className="font-medium">{paymentData.agency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Conta</p>
                    <p className="font-medium">{paymentData.account_number}-{paymentData.account_digit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Titular</p>
                    <p className="font-medium">{paymentData.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">CPF</p>
                    <p className="font-medium">{paymentData.cpf}</p>
                  </div>
                  {paymentData.pix_key && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-600">Chave PIX</p>
                      <p className="font-medium">{paymentData.pix_key}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-emerald-100">
            <CardTitle>Historico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {payments.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Nenhum pagamento registrado ainda</p>
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-emerald-200 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={getStatusColor(payment.status)}>
                          {getStatusIcon(payment.status)}
                          <span className="ml-1">
                            {payment.status === "pago"
                              ? "Pago"
                              : payment.status === "processando"
                                ? "Processando"
                                : payment.status === "erro"
                                  ? "Erro"
                                  : "Pendente"}
                          </span>
                        </Badge>
                        <span className="font-medium">{payment.quarter}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{String(payment.category || "").replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{payment.points} pontos</span>
                        {payment.paid_at && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span>{format(new Date(payment.paid_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-700">
                        R$ {formatCurrency(payment.amount)}
                      </p>
                      {payment.payment_method && <p className="text-sm text-gray-500">via {payment.payment_method}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
