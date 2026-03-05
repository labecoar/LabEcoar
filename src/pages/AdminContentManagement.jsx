// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateTask, useTasks } from '@/hooks/useTasks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PlusCircle, Target, Calendar, Users, Star, Megaphone, Zap, BookOpen, Share2, FolderClosed, Clock3 } from 'lucide-react'

const CATEGORY_OPTIONS = [
  { value: 'campanha', label: 'Campanha (Paga)', points: 100 },
  { value: 'oficina', label: 'Oficina (50 pts)', points: 50 },
  { value: 'folhetim', label: 'Folhetim (75 pts)', points: 75 },
  { value: 'compartilhar_ecoante', label: 'Compartilhar Ecoante (150 pts)', points: 150 },
]

const CATEGORY_META = {
  campanha: { label: 'Campanha', icon: Megaphone, color: 'bg-green-100 text-green-700 border-green-200' },
  oficina: { label: 'Oficina', icon: BookOpen, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  folhetim: { label: 'Folhetim', icon: Share2, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  compartilhar_ecoante: { label: 'Compartilhar Ecoante', icon: Users, color: 'bg-pink-100 text-pink-700 border-pink-200' },
}

const PROOF_TYPE_LABELS = {
  link: 'Link',
  imagem: 'Imagem',
  image: 'Imagem',
  video: 'Vídeo',
  arquivo: 'Arquivo',
  file: 'Arquivo',
}

const getProofTypeLabel = (task) => {
  const raw = String(task?.proof_type || '').trim().toLowerCase()
  if (raw) return PROOF_TYPE_LABELS[raw] || task.proof_type

  if (Array.isArray(task?.content_formats) && task.content_formats.length > 0) {
    return task.content_formats.join(', ')
  }

  return 'Não informado'
}

const initialFormData = {
  title: '',
  description: '',
  category: 'campanha',
  content_formats: [],
  offered_value: '',
  proof_type: 'link',
  expiration_value: '1',
  expiration_unit: 'days',
  delivery_deadline: '',
  max_participants: '',
  campaign_type: 'comum',
  requires_application: false,
}

export default function AdminContentManagement() {
  const { profile } = useAuth()
  const { data: tasks = [], isLoading } = useTasks()
  const createTask = useCreateTask()

  const [activeTab, setActiveTab] = useState('create')
  const [formData, setFormData] = useState(initialFormData)
  const [error, setError] = useState('')

  const activeTasksCount = tasks.length
  const campaignCount = useMemo(() => tasks.filter((task) => task.category === 'campanha').length, [tasks])
  const selectedCategory = useMemo(
    () => CATEGORY_OPTIONS.find((option) => option.value === formData.category),
    [formData.category]
  )

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const toggleContentFormat = (format) => {
    setFormData((prev) => {
      const alreadySelected = prev.content_formats.includes(format)
      return {
        ...prev,
        content_formats: alreadySelected
          ? prev.content_formats.filter((item) => item !== format)
          : [...prev.content_formats, format],
      }
    })
  }

  const calculateExpirationDate = (value, unit) => {
    const amount = Number(value)
    const now = new Date()
    if (Number.isNaN(amount) || amount <= 0) return null

    const result = new Date(now)
    if (unit === 'hours') result.setHours(result.getHours() + amount)
    if (unit === 'days') result.setDate(result.getDate() + amount)
    if (unit === 'weeks') result.setDate(result.getDate() + amount * 7)
    return result.toISOString()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const title = formData.title.trim()
    const description = formData.description.trim()
    const offeredValue = Number(formData.offered_value)
    const maxParticipants = formData.max_participants === '' ? null : Number(formData.max_participants)
    const expirationValue = Number(formData.expiration_value)
    const expiresAt = calculateExpirationDate(formData.expiration_value, formData.expiration_unit)

    if (!title || !description || !formData.category) {
      setError('Preencha título, descrição e categoria.')
      return
    }

    if (Number.isNaN(offeredValue) || offeredValue <= 0) {
      setError('Informe um valor oferecido válido (maior que zero).')
      return
    }

    if (Number.isNaN(expirationValue) || expirationValue <= 0) {
      setError('Informe um tempo de expiração válido.')
      return
    }

    if (maxParticipants !== null && (Number.isNaN(maxParticipants) || maxParticipants <= 0)) {
      setError('Informe um limite de participantes válido ou deixe em branco.')
      return
    }

    try {
      await createTask.mutateAsync({
        title,
        description,
        category: formData.category,
        points: typeof selectedCategory?.points === 'number'
          ? selectedCategory.points
          : Math.max(1, Math.round(offeredValue)),
        offered_value: offeredValue,
        proof_type: formData.proof_type,
        expiration_value: expirationValue,
        expiration_unit: formData.expiration_unit,
        content_formats: formData.content_formats,
        delivery_deadline: formData.delivery_deadline || null,
        max_participants: maxParticipants,
        campaign_type: formData.campaign_type,
        requires_application: formData.requires_application,
        expires_at: expiresAt,
      })

      alert('Tarefa criada com sucesso! ✅')
      setFormData(initialFormData)
    } catch (submitError) {
      console.error('Erro ao criar tarefa:', submitError)
      setError(submitError?.message || 'Não foi possível criar a tarefa.')
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700 mb-2 inline-flex items-center gap-2">
            Gerenciamento de Conteúdo
            <FolderClosed className="w-7 h-7" />
          </h1>
          <p className="text-gray-600">Crie tarefas e tópicos do fórum para os Ecoantes</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'bg-white border-gray-300 text-[#3c0b14]'
                : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'
            }`}
          >
            Criar Tarefa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-white border-gray-300 text-[#3c0b14]'
                : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'
            }`}
          >
            Ativas ({activeTasksCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
              activeTab === 'completed'
                ? 'bg-white border-gray-300 text-[#3c0b14]'
                : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'
            }`}
          >
            Concluídas (0)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('forum')}
            className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
              activeTab === 'forum'
                ? 'bg-white border-gray-300 text-[#3c0b14]'
                : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'
            }`}
          >
            Criar Tópico Fórum
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-full">
                  <Target className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{activeTasksCount}</p>
                  <p className="text-sm text-gray-600">Tarefas Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <Megaphone className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{campaignCount}</p>
                  <p className="text-sm text-gray-600">Campanhas Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeTab === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                Nova Tarefa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Ex: Post sobre Dia da Terra"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    value={formData.description}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Descreva a tarefa em detalhes..."
                  />
                </div>

                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-700">Tipo de Conteúdo a Produzir</p>
                  <p className="text-xs text-gray-500">Selecione um ou mais formatos</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {['Reels', 'Vídeo no TikTok', 'Stories', 'Carrossel', 'Outro'].map((format) => (
                      <label key={format} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={formData.content_formats.includes(format)}
                          onChange={() => toggleContentFormat(format)}
                        />
                        <span>{format}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="offered_value">Valor Oferecido (R$) *</Label>
                    <Input
                      id="offered_value"
                      type="number"
                      min="1"
                      value={formData.offered_value}
                      onChange={(event) => setFormData((prev) => ({ ...prev, offered_value: event.target.value }))}
                      placeholder="Ex: 1000"
                    />
                    <p className="text-xs text-gray-500">Valor por influenciador</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Prova *</Label>
                    <Select
                      value={formData.proof_type}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, proof_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de prova" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link">Link</SelectItem>
                        <SelectItem value="imagem">Imagem</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                        <SelectItem value="arquivo">Arquivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="inline-flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-orange-500" />
                    Tempo de Expiração *
                  </Label>
                  <p className="text-xs text-gray-500">Após esse tempo, a tarefa não ficará mais disponível para novos participantes</p>
                  <div className="grid grid-cols-2 gap-3 max-w-xs">
                    <Input
                      type="number"
                      min="1"
                      value={formData.expiration_value}
                      onChange={(event) => setFormData((prev) => ({ ...prev, expiration_value: event.target.value }))}
                    />
                    <Select
                      value={formData.expiration_unit}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, expiration_unit: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">Horas</SelectItem>
                        <SelectItem value="days">Dias</SelectItem>
                        <SelectItem value="weeks">Semanas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_deadline">Prazo para Entrega (opcional)</Label>
                  <p className="text-xs text-gray-500">Data limite para envio da prova após aceitar a tarefa</p>
                  <Input
                    id="delivery_deadline"
                    type="date"
                    value={formData.delivery_deadline}
                    onChange={(event) => setFormData((prev) => ({ ...prev, delivery_deadline: event.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_participants">Máximo de Participantes *</Label>
                    <Input
                      id="max_participants"
                      type="number"
                      min="1"
                      value={formData.max_participants}
                      onChange={(event) => setFormData((prev) => ({ ...prev, max_participants: event.target.value }))}
                      placeholder="Número de vagas"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Campanha</Label>
                    <Select
                      value={formData.campaign_type}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, campaign_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comum">Comum</SelectItem>
                        <SelectItem value="resposta_rapida">Resposta Rápida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={formData.requires_application}
                    onChange={(event) => setFormData((prev) => ({ ...prev, requires_application: event.target.checked }))}
                  />
                  <span>Requer inscrição</span>
                </label>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
                )}

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={createTask.isPending}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  {createTask.isPending ? 'Criando...' : 'Criar Tarefa'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === 'active' && (
          <Card>
            <CardHeader>
              <CardTitle>Tarefas Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-10 text-gray-600">Carregando tarefas...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Nenhuma tarefa criada ainda.</div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const categoryMeta = CATEGORY_META[task.category] || {
                      label: task.category,
                      icon: Target,
                      color: 'bg-gray-100 text-gray-700 border-gray-200',
                    }
                    const Icon = categoryMeta.icon

                    return (
                      <div key={task.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{task.title}</h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${categoryMeta.color} border`}>
                              <Icon className="w-3 h-3 mr-1" />
                              {categoryMeta.label}
                            </Badge>
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 border">
                              <Star className="w-3 h-3 mr-1 fill-amber-600" />
                              R$ {Number(task.offered_value || task.points || 0).toLocaleString('pt-BR')}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            Vagas: {task.max_participants || 'Sem limite'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Expira em: {task.expires_at ? new Date(task.expires_at).toLocaleString('pt-BR') : 'Sem data'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" />
                            Prova: {getProofTypeLabel(task)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'completed' && (
          <Card>
            <CardHeader>
              <CardTitle>Tarefas Concluídas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Nenhuma tarefa concluída por enquanto.</p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'forum' && (
          <Card>
            <CardHeader>
              <CardTitle>Criar Tópico Fórum</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Essa etapa será implementada na próxima fase.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
