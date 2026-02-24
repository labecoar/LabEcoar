import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  SelectValue } from
"@/components/ui/select";
import {
  DollarSign, CreditCard, CheckCircle, Clock,
  AlertCircle, Calendar, Edit, TrendingUp, Award } from
"lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORY_VALUES = {
  voz_e_violao: { value: 1000, name: 'Voz e Violão', emoji: '🎸', color: 'from-yellow-400 to-orange-500', range: '50-200 pts' },
  dueto: { value: 2000, name: 'Dueto', emoji: '🎤', color: 'from-pink-400 to-rose-500', range: '201-500 pts' },
  fanfarra: { value: 3500, name: 'Fanfarra', emoji: '🎺', color: 'from-blue-400 to-cyan-500', range: '501-1000 pts' },
  carnaval: { value: 4500, name: 'Carnaval', emoji: '🎉', color: 'from-orange-400 to-red-500', range: '999+ pts' }
};

export default function MyPayments() {
  const [user, setUser] = useState(null);
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
    pix_type: "cpf"
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    fetchUser();
  }, []);

  const { data: paymentInfo } = useQuery({
    queryKey: ['payment-info', user?.email],
    queryFn: async () => {
      const infos = await base44.entities.PaymentInfo.filter({ user_email: user.email });
      return infos[0] || null;
    },
    enabled: !!user?.email
  });

  const { data: payments } = useQuery({
    queryKey: ['my-payments', user?.email],
    queryFn: () => base44.entities.Payment.filter({ user_email: user.email }, '-created_date'),
    initialData: [],
    enabled: !!user?.email
  });

  useEffect(() => {
    if (paymentInfo) {
      setPaymentData(paymentInfo);
    }
  }, [paymentInfo]);

  const savePaymentInfoMutation = useMutation({
    mutationFn: async (data) => {
      if (paymentInfo) {
        return base44.entities.PaymentInfo.update(paymentInfo.id, {
          ...data,
          user_email: user.email
        });
      } else {
        return base44.entities.PaymentInfo.create({
          ...data,
          user_email: user.email
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-info'] });
      setIsEditing(false);
      alert('Dados bancários salvos com sucesso! ✅');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    savePaymentInfoMutation.mutate(paymentData);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'processando':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'erro':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pago':
        return <CheckCircle className="w-4 h-4" />;
      case 'processando':
        return <Clock className="w-4 h-4" />;
      case 'erro':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const currentCategory = user?.current_category || 'voz_e_violao';
  const categoryInfo = CATEGORY_VALUES[currentCategory];
  const currentPoints = user?.total_points || 0;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Meus Pagamentos

          </h1>
          <p className="text-gray-600 mt-2">Gerencie seus dados bancários e acompanhe seus pagamentos</p>
        </div>

        {/* Card de Ganho Previsto */}
        <Card className="shadow-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 mb-8">
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Ganho Previsto no Trimestre {user?.current_quarter}</p>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-5xl font-black text-emerald-700">
                    R$ {categoryInfo?.value.toLocaleString('pt-BR')}
                  </h2>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${categoryInfo?.color} text-white font-bold shadow-lg`}>
                    <span className="text-xl">{categoryInfo?.emoji}</span>
                    <span>{categoryInfo?.name}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Com base nos seus {currentPoints} pontos atuais
                </p>
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
                    isCurrentCategory ?
                    'bg-white border-emerald-500 shadow-md scale-105' :
                    'bg-white/50 border-gray-200'}`
                    }>

                    <div className="text-center">
                      <div className="text-2xl mb-2">{info.emoji}</div>
                      <p className="font-bold text-sm text-gray-900 mb-1">{info.name}</p>
                      <p className="text-xs text-gray-600 mb-2">{info.range}</p>
                      <p className={`text-lg font-bold ${isCurrentCategory ? 'text-emerald-700' : 'text-gray-700'}`}>
                        R$ {info.value.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>);

              })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">Como funciona o pagamento?</p>
                  <p className="text-sm text-blue-700">
                    Ao final do trimestre, você receberá o valor da categoria em que terminar. 
                    Quanto mais pontos você acumular, maior será sua categoria e seu ganho! 
                    Os pontos são zerados a cada trimestre, mas você sempre começa na categoria que conquistou.
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
                  <p className="text-3xl font-bold text-green-700">
                    R$ {payments.filter((p) => p.status === 'pago').reduce((sum, p) => sum + p.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
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
                  <p className="text-3xl font-bold text-yellow-700">
                    R$ {payments.filter((p) => p.status === 'pendente' || p.status === 'processando').reduce((sum, p) => sum + p.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
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
              Dados Bancários
            </CardTitle>
            {!isEditing && paymentInfo &&
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}>

                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            }
          </CardHeader>
          <CardContent className="pt-6">
            {!paymentInfo && !isEditing ?
            <div className="text-center py-8">
                <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">Você ainda não cadastrou seus dados bancários</p>
                <Button
                onClick={() => setIsEditing(true)}
                className="bg-gradient-to-r from-emerald-500 to-teal-600">

                  Cadastrar Dados Bancários
                </Button>
              </div> :
            isEditing ?
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="account_type">Tipo de Conta *</Label>
                    <Select
                    value={paymentData.account_type}
                    onValueChange={(value) => setPaymentData({ ...paymentData, account_type: value })}>

                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Conta Corrente</SelectItem>
                        <SelectItem value="poupanca">Conta Poupança</SelectItem>
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
                    required />

                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bank_code">Código do Banco</Label>
                    <Input
                    id="bank_code"
                    placeholder="Ex: 001"
                    value={paymentData.bank_code}
                    onChange={(e) => setPaymentData({ ...paymentData, bank_code: e.target.value })} />

                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agency">Agência *</Label>
                    <Input
                    id="agency"
                    placeholder="Ex: 1234"
                    value={paymentData.agency}
                    onChange={(e) => setPaymentData({ ...paymentData, agency: e.target.value })}
                    required />

                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account_number">Conta + Dígito *</Label>
                    <div className="flex gap-2">
                      <Input
                      id="account_number"
                      placeholder="12345"
                      value={paymentData.account_number}
                      onChange={(e) => setPaymentData({ ...paymentData, account_number: e.target.value })}
                      required
                      className="flex-1" />

                      <Input
                      placeholder="6"
                      value={paymentData.account_digit}
                      onChange={(e) => setPaymentData({ ...paymentData, account_digit: e.target.value })}
                      required
                      className="w-16"
                      maxLength={1} />

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
                    required />

                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={paymentData.cpf}
                    onChange={(e) => setPaymentData({ ...paymentData, cpf: e.target.value })}
                    required />

                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Chave PIX (Opcional)</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="pix_type">Tipo de Chave</Label>
                      <Select
                      value={paymentData.pix_type}
                      onValueChange={(value) => setPaymentData({ ...paymentData, pix_type: value })}>

                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="telefone">Telefone</SelectItem>
                          <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pix_key">Chave PIX</Label>
                      <Input
                      id="pix_key"
                      placeholder="Digite sua chave PIX"
                      value={paymentData.pix_key}
                      onChange={(e) => setPaymentData({ ...paymentData, pix_key: e.target.value })} />

                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="flex-1">

                    Cancelar
                  </Button>
                  <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600"
                  disabled={savePaymentInfoMutation.isPending}>

                    {savePaymentInfoMutation.isPending ? 'Salvando...' : 'Salvar Dados'}
                  </Button>
                </div>
              </form> :

            <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Tipo de Conta</p>
                    <p className="font-medium">{paymentInfo.account_type === 'corrente' ? 'Conta Corrente' : 'Conta Poupança'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Banco</p>
                    <p className="font-medium">{paymentInfo.bank_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Agência</p>
                    <p className="font-medium">{paymentInfo.agency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Conta</p>
                    <p className="font-medium">{paymentInfo.account_number}-{paymentInfo.account_digit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Titular</p>
                    <p className="font-medium">{paymentInfo.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">CPF</p>
                    <p className="font-medium">{paymentInfo.cpf}</p>
                  </div>
                  {paymentInfo.pix_key &&
                <div className="md:col-span-2">
                      <p className="text-sm text-gray-600">Chave PIX</p>
                      <p className="font-medium">{paymentInfo.pix_key}</p>
                    </div>
                }
                </div>
              </div>
            }
          </CardContent>
        </Card>

        <Card className="shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-emerald-100">
            <CardTitle>Histórico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {payments.length === 0 ?
            <div className="text-center py-8">
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Nenhum pagamento registrado ainda</p>
              </div> :

            <div className="space-y-4">
                {payments.map((payment) =>
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-emerald-200 transition-colors">

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={getStatusColor(payment.status)}>
                          {getStatusIcon(payment.status)}
                          <span className="ml-1">
                            {payment.status === 'pago' ? 'Pago' : payment.status === 'processando' ? 'Processando' : payment.status === 'erro' ? 'Erro' : 'Pendente'}
                          </span>
                        </Badge>
                        <span className="font-medium">{payment.quarter}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{payment.category.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{payment.points} pontos</span>
                        {payment.paid_at &&
                    <>
                            <span className="text-gray-400">•</span>
                            <span>{format(new Date(payment.paid_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                          </>
                    }
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-700">
                        R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {payment.payment_method &&
                  <p className="text-sm text-gray-500">via {payment.payment_method}</p>
                  }
                    </div>
                  </div>
              )}
              </div>
            }
          </CardContent>
        </Card>
      </div>
    </div>);

}