// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateForumTopic, useDeleteForumTopic, useForumTopics, useUpdateForumTopic } from '@/hooks/useForum'
import { useAdminTasks, useCreateTask, useDeleteTask, useUpdateTask } from '@/hooks/useTasks'
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
import {
  PlusCircle,
  Target,
  Calendar,
  Users,
  Star,
  CircleDollarSign,
  Megaphone,
  BookOpen,
  Share2,
  FolderClosed,
  Clock3,
  Pencil,
  Trash2,
  MessageSquare,
  Archive,
} from 'lucide-react'

const CATEGORY_OPTIONS = [
  { value: 'campanha', label: 'Campanha (Paga)' },
  { value: 'oficina', label: 'Oficina (50 pts)', points: 50 },
  { value: 'folhetim', label: 'Folhetim (75 pts)', points: 75 },
  { value: 'compartilhar_ecoante', label: 'Compartilhar Ecoante (150 pts)', points: 150 },
  { value: 'sidequest_teste', label: 'Sidequest Teste' },
]

const CATEGORY_META = {
  campanha: { label: 'Campanha', icon: Megaphone, color: 'bg-green-100 text-green-700 border-green-200' },
  oficina: { label: 'Oficina', icon: BookOpen, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  folhetim: { label: 'Folhetim', icon: Share2, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  compartilhar_ecoante: { label: 'Compartilhar Ecoante', icon: Users, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  sidequest_teste: { label: 'Sidequest Teste', icon: Target, color: 'bg-amber-100 text-amber-700 border-amber-200' },
}

const PROOF_TYPE_LABELS = {
  link: 'Link',
  imagem: 'Imagem',
  image: 'Imagem',
  video: 'Vídeo',
  arquivo: 'Arquivo',
  file: 'Arquivo',
}

const CONTENT_TYPE_OPTIONS = ['Reels', 'Vídeo no TikTok', 'Stories', 'Carrossel', 'Outro']
const QUICK_CAMPAIGN_MAX_BUSINESS_DAYS = 3

const initialFormData = {
  title: '',
  description: '',
  category: 'campanha',
  folhetim_type: '',
  content_formats: [],
  content_type_other: '',
  points: 50,
  offered_value: '',
  posting_deadline: '',
  without_deadline: false,
  max_participants: '',
  campaign_type: 'comum',
  requires_application: false,
  profile_requirements: '',
  min_followers: '',
  target_audience: '',
}

const initialForumForm = {
  title: '',
  description: '',
  category: 'geral',
}

const getProofTypeLabel = (task) => {
  const raw = String(task?.proof_type || '').trim().toLowerCase()
  if (raw) return PROOF_TYPE_LABELS[raw] || task.proof_type

  if (Array.isArray(task?.content_formats) && task.content_formats.length > 0) {
    return task.content_formats.join(', ')
  }

  return 'Link e/ou arquivo'
}

const isTaskExpired = (task) => {
  if (!task?.expires_at) return false
  return new Date(task.expires_at).getTime() < Date.now()
}

const countBusinessDaysUntil = (targetDateRaw, referenceDateRaw = new Date()) => {
  const targetDate = new Date(targetDateRaw)
  const referenceDate = new Date(referenceDateRaw)

  if (Number.isNaN(targetDate.getTime()) || Number.isNaN(referenceDate.getTime())) return 0

  const start = new Date(referenceDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(targetDate)
  end.setHours(0, 0, 0, 0)

  if (end <= start) return 0

  const cursor = new Date(start)
  let businessDays = 0

  while (cursor < end) {
    const day = cursor.getDay()
    const isWeekend = day === 0 || day === 6
    if (!isWeekend) {
      businessDays += 1
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return businessDays
}

const getTaskDeadlineState = (task) => {
  if (!task?.expires_at) {
    return {
      isExpired: false,
      isCritical: false,
      isWarning: false,
      timeLabel: 'Sem data',
    }
  }

  const expiresAt = new Date(task.expires_at)
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      isExpired: false,
      isCritical: false,
      isWarning: false,
      timeLabel: 'Data inválida',
    }
  }

  const diffMs = expiresAt.getTime() - Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const threeDaysMs = 3 * oneDayMs

  if (diffMs <= 0) {
    return {
      isExpired: true,
      isCritical: false,
      isWarning: false,
      timeLabel: 'Expirada',
    }
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  return {
    isExpired: false,
    isCritical: diffMs <= oneDayMs,
    isWarning: diffMs > oneDayMs && diffMs <= threeDaysMs,
    timeLabel: days > 0 ? `${days}d ${hours}h` : `${hours}h`,
  }
}

export default function AdminContentManagement() {
  const { user, profile } = useAuth()
  const { data: tasks = [], isLoading } = useAdminTasks()
  const { data: forumTopics = [], isLoading: loadingForum } = useForumTopics()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const createForumTopic = useCreateForumTopic()
  const updateForumTopic = useUpdateForumTopic()
  const deleteForumTopic = useDeleteForumTopic()

  const [activeTab, setActiveTab] = useState('create')
  const [formData, setFormData] = useState(initialFormData)
  const [editingTask, setEditingTask] = useState(null)
  const [forumForm, setForumForm] = useState(initialForumForm)
  const [editingForumTopic, setEditingForumTopic] = useState(null)
  const [error, setError] = useState('')

  const isCampaign = formData.category === 'campanha'
  const isSidequestTest = formData.category === 'sidequest_teste'
  const selectedCategory = useMemo(
    () => CATEGORY_OPTIONS.find((option) => option.value === formData.category),
    [formData.category]
  )

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status === 'active' && !isTaskExpired(task)),
    [tasks]
  )
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'active' || isTaskExpired(task)),
    [tasks]
  )

  const campaignCount = useMemo(() => activeTasks.filter((task) => task.category === 'campanha').length, [activeTasks])

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
      const nextFormats = alreadySelected
        ? prev.content_formats.filter((item) => item !== format)
        : [...prev.content_formats, format]

      return {
        ...prev,
        content_formats: nextFormats,
        content_type_other: nextFormats.includes('Outro') ? prev.content_type_other : '',
      }
    })
  }

  const calculateDerivedCampaignDeadlines = (finalDeadlineRaw) => {
    if (!finalDeadlineRaw) return { finalDeadline: null, postingDeadline: null }
    const finalDeadline = new Date(finalDeadlineRaw)
    if (Number.isNaN(finalDeadline.getTime())) {
      return { finalDeadline: null, postingDeadline: null }
    }

    return {
      finalDeadline: finalDeadline.toISOString(),
      postingDeadline: finalDeadline.toISOString(),
    }
  }

  const formatDateTimeLocalValue = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
  }

  useEffect(() => {
    if (!isCampaign) return

    const { finalDeadline } = calculateDerivedCampaignDeadlines(formData.posting_deadline)
    if (!finalDeadline) {
      setFormData((prev) => (prev.campaign_type === 'comum' ? prev : { ...prev, campaign_type: 'comum' }))
      return
    }

    const businessDaysUntilFinal = countBusinessDaysUntil(finalDeadline)
    const nextCampaignType = businessDaysUntilFinal <= QUICK_CAMPAIGN_MAX_BUSINESS_DAYS ? 'resposta_rapida' : 'comum'

    setFormData((prev) => (
      prev.campaign_type === nextCampaignType
        ? prev
        : { ...prev, campaign_type: nextCampaignType }
    ))
  }, [isCampaign, formData.posting_deadline])

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingTask(null)
    setError('')
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setActiveTab('create')
    setError('')

    setFormData({
      title: task.title || '',
      description: task.description || '',
      category: task.category || 'campanha',
      folhetim_type: task.folhetim_type || '',
      content_formats: Array.isArray(task.content_formats) ? task.content_formats : [],
      content_type_other: task.content_type_other || '',
      points: Number(task.points || 0),
      offered_value: task.offered_value ? String(task.offered_value) : '',
      posting_deadline: formatDateTimeLocalValue(task.expires_at || task.posting_deadline),
      without_deadline: task.category !== 'campanha' && !task.expires_at,
      max_participants: task.max_participants ? String(task.max_participants) : '',
      campaign_type: task.campaign_type || 'comum',
      requires_application: Boolean(task.requires_application),
      profile_requirements: task.profile_requirements || '',
      min_followers: task.min_followers ? String(task.min_followers) : '',
      target_audience: task.target_audience || '',
    })
  }

  const handleDeleteTask = async (taskId) => {
    const shouldDelete = window.confirm('Tem certeza que deseja excluir esta tarefa?')
    if (!shouldDelete) return

    try {
      await deleteTask.mutateAsync(taskId)
      if (editingTask?.id === taskId) {
        resetForm()
      }
      alert('Tarefa excluída com sucesso! ✅')
    } catch (deleteError) {
      console.error('Erro ao excluir tarefa:', deleteError)
      alert(deleteError?.message || 'Não foi possível excluir a tarefa.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const title = formData.title.trim()
    const description = formData.description.trim()
    const offeredValue = formData.offered_value === '' ? null : Number(formData.offered_value)
    const points = Number(formData.points)
    const resolvedPoints = isCampaign
      ? 0
      : isSidequestTest
        ? points
        : Number(selectedCategory?.points || 50)
    const maxParticipants = formData.max_participants === '' ? null : Number(formData.max_participants)
    const minFollowers = formData.min_followers === '' ? null : Number(formData.min_followers)
    const { finalDeadline, postingDeadline } = calculateDerivedCampaignDeadlines(formData.posting_deadline)
    const nonCampaignFinalDeadline = formData.without_deadline
      ? null
      : (formData.posting_deadline ? new Date(formData.posting_deadline).toISOString() : null)
    const businessDaysUntilFinal = isCampaign && finalDeadline
      ? countBusinessDaysUntil(finalDeadline)
      : null

    if (!title || !description || !formData.category) {
      setError('Preencha título, descrição e categoria.')
      return
    }

    if (isCampaign && (offeredValue === null || Number.isNaN(offeredValue) || offeredValue <= 0)) {
      setError('Informe um valor oferecido válido (maior que zero).')
      return
    }

    if (isSidequestTest && (Number.isNaN(points) || points <= 0)) {
      setError('Informe uma pontuação válida para a Sidequest Teste.')
      return
    }

    if (isCampaign && !finalDeadline) {
      setError('Informe a data e hora final da tarefa.')
      return
    }

    if (!isCampaign && !formData.without_deadline && !nonCampaignFinalDeadline) {
      setError('Para tarefas não-campanha, informe a data e hora final ou marque Sem data.')
      return
    }

    if (isCampaign && (businessDaysUntilFinal === null || businessDaysUntilFinal < 1)) {
      setError('Para campanhas, a data final precisa estar no mínimo no próximo dia útil.')
      return
    }

    if (maxParticipants !== null && (Number.isNaN(maxParticipants) || maxParticipants <= 0)) {
      setError('Informe um limite de participantes válido ou deixe em branco.')
      return
    }

    if (minFollowers !== null && (Number.isNaN(minFollowers) || minFollowers < 0)) {
      setError('Informe um mínimo de seguidores válido.')
      return
    }

    try {
      const taskPayload = {
        title,
        description,
        category: formData.category,
        folhetim_type: formData.category === 'folhetim' ? formData.folhetim_type || null : null,
        content_formats: formData.content_formats,
        content_type_other: formData.content_formats.includes('Outro') ? formData.content_type_other || null : null,
        points: isCampaign ? 0 : Math.max(1, Math.round(resolvedPoints)),
        offered_value: isCampaign ? offeredValue : null,
        proof_type: null,
        expiration_value: 1,
        expiration_unit: 'days',
        posting_deadline: isCampaign ? postingDeadline : nonCampaignFinalDeadline,
        delivery_deadline: isCampaign && postingDeadline ? postingDeadline.slice(0, 10) : null,
        max_participants: maxParticipants,
        campaign_type: isCampaign
          ? (businessDaysUntilFinal <= QUICK_CAMPAIGN_MAX_BUSINESS_DAYS ? 'resposta_rapida' : 'comum')
          : formData.campaign_type,
        requires_application: formData.requires_application,
        profile_requirements: formData.profile_requirements || null,
        min_followers: minFollowers,
        target_audience: formData.target_audience || null,
        expires_at: isCampaign ? finalDeadline : nonCampaignFinalDeadline,
      }

      if (editingTask) {
        await updateTask.mutateAsync({ taskId: editingTask.id, updates: taskPayload })
        alert('Tarefa atualizada com sucesso! ✅')
      } else {
        await createTask.mutateAsync(taskPayload)
        alert('Tarefa criada com sucesso! ✅')
      }

      resetForm()
    } catch (submitError) {
      console.error('Erro ao salvar tarefa:', submitError)
      setError(submitError?.message || 'Não foi possível salvar a tarefa.')
    }
  }

  const handleCreateForumTopic = async (event) => {
    event.preventDefault()

    const title = forumForm.title.trim()
    const description = forumForm.description.trim()

    if (!title || !description || !forumForm.category) {
      alert('Preencha título, descrição e categoria do tópico.')
      return
    }

    try {
      if (editingForumTopic) {
        await updateForumTopic.mutateAsync({
          topicId: editingForumTopic.id,
          updates: {
            title,
            description,
            category: forumForm.category,
          },
        })
        alert('Tópico atualizado com sucesso! ✅')
      } else {
        await createForumTopic.mutateAsync({
          title,
          description,
          category: forumForm.category,
          author_id: user?.id || null,
          author_name: profile?.display_name || profile?.full_name || 'Admin',
          author_email: profile?.email || user?.email || null,
        })
        alert('Tópico criado com sucesso! ✅')
      }

      setForumForm(initialForumForm)
      setEditingForumTopic(null)
    } catch (forumError) {
      console.error('Erro ao criar tópico:', forumError)
      alert(forumError?.message || 'Não foi possível criar o tópico.')
    }
  }

  const handleEditForumTopic = (topic) => {
    setEditingForumTopic(topic)
    setForumForm({
      title: topic.title || '',
      description: topic.description || '',
      category: topic.category || 'geral',
    })
  }

  const resetForumForm = () => {
    setForumForm(initialForumForm)
    setEditingForumTopic(null)
  }

  const handleDeleteForumTopic = async (topicId) => {
    const shouldDelete = window.confirm('Tem certeza que deseja excluir este tópico?')
    if (!shouldDelete) return

    try {
      await deleteForumTopic.mutateAsync(topicId)
      if (editingForumTopic?.id === topicId) {
        resetForumForm()
      }
      alert('Tópico excluído com sucesso! ✅')
    } catch (deleteError) {
      console.error('Erro ao excluir tópico:', deleteError)
      alert(deleteError?.message || 'Não foi possível excluir o tópico.')
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
            Ativas ({activeTasks.length})
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
            Concluídas ({completedTasks.length})
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
                  <p className="text-2xl font-bold text-gray-900">{activeTasks.length}</p>
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
                {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
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
                      onValueChange={(value) => setFormData((prev) => ({
                        ...prev,
                        category: value,
                        without_deadline: value === 'campanha' ? false : prev.without_deadline,
                      }))}
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

                {isSidequestTest && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <Label htmlFor="sidequest-points">Pontuação da Sidequest Teste *</Label>
                    <Input
                      id="sidequest-points"
                      type="number"
                      min="1"
                      value={formData.points}
                      onChange={(event) => setFormData((prev) => ({ ...prev, points: event.target.value }))}
                      placeholder="Ex: 120"
                    />
                    <p className="text-xs text-amber-700">Defina manualmente quantos pontos essa sidequest vale.</p>
                  </div>
                )}

                {formData.category === 'folhetim' && (
                  <div className="space-y-2">
                    <Label>Tipo de Folhetim</Label>
                    <Select
                      value={formData.folhetim_type}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, folhetim_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compartilhar">Compartilhar</SelectItem>
                        <SelectItem value="criar">Criar Conteúdo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                    {CONTENT_TYPE_OPTIONS.map((format) => (
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
                  {formData.content_formats.includes('Outro') && (
                    <Input
                      value={formData.content_type_other}
                      onChange={(event) => setFormData((prev) => ({ ...prev, content_type_other: event.target.value }))}
                      placeholder="Especifique o tipo de conteúdo..."
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isCampaign ? (
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
                  ) : !isSidequestTest ? (
                    <div className="space-y-2">
                      <Label>Pontos da Categoria</Label>
                      <Input value={selectedCategory?.points || 50} disabled />
                    </div>
                  ) : null}
                </div>

                {isCampaign && (
                  <div className="space-y-2">
                    <Label htmlFor="posting_deadline" className="inline-flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-orange-500" />
                      Data e Hora Final da Tarefa *
                    </Label>
                    <p className="text-xs text-gray-500">
                      O sistema usa a mesma data e hora para postagem e expiração da tarefa. Se a data final ficar em até 3 dias uteis, a campanha vira Resposta Rápida.
                    </p>
                    <Input
                      id="posting_deadline"
                      type="datetime-local"
                      value={formData.posting_deadline}
                      onChange={(event) => setFormData((prev) => ({ ...prev, posting_deadline: event.target.value }))}
                    />
                  </div>
                )}

                {!isCampaign && (
                  <div className="space-y-2">
                    <Label htmlFor="posting_deadline" className="inline-flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-orange-500" />
                      Data e Hora Final da Tarefa
                    </Label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={formData.without_deadline}
                        onChange={(event) => setFormData((prev) => ({ ...prev, without_deadline: event.target.checked }))}
                      />
                      <span>Sem data (tempo indeterminado)</span>
                    </label>
                    <Input
                      id="posting_deadline"
                      type="datetime-local"
                      value={formData.posting_deadline}
                      onChange={(event) => setFormData((prev) => ({ ...prev, posting_deadline: event.target.value }))}
                      disabled={formData.without_deadline}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_participants">Máximo de Participantes {isCampaign ? '*' : '(opcional)'}</Label>
                    <Input
                      id="max_participants"
                      type="number"
                      min="1"
                      value={formData.max_participants}
                      onChange={(event) => setFormData((prev) => ({ ...prev, max_participants: event.target.value }))}
                      placeholder="Número de vagas"
                    />
                  </div>

                  {isCampaign && (
                    <div className="space-y-2">
                      <Label>Tipo de Campanha</Label>
                      <Select
                        value={formData.campaign_type}
                        disabled
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
                  )}
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

                {formData.requires_application && (
                  <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-700">Requisitos de Inscrição</p>
                    <div className="space-y-2">
                      <Label htmlFor="profile_requirements">Requisitos de Perfil</Label>
                      <Textarea
                        id="profile_requirements"
                        rows={3}
                        value={formData.profile_requirements}
                        onChange={(event) => setFormData((prev) => ({ ...prev, profile_requirements: event.target.value }))}
                        placeholder="Ex: experiência com conteúdo sustentável..."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="min_followers">Mínimo de Seguidores</Label>
                        <Input
                          id="min_followers"
                          type="number"
                          min="0"
                          value={formData.min_followers}
                          onChange={(event) => setFormData((prev) => ({ ...prev, min_followers: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="target_audience">Público-Alvo</Label>
                        <Input
                          id="target_audience"
                          value={formData.target_audience}
                          onChange={(event) => setFormData((prev) => ({ ...prev, target_audience: event.target.value }))}
                          placeholder="Ex: jovens interessados em sustentabilidade"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3">
                  {editingTask && (
                    <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className={`${editingTask ? 'flex-1' : 'w-full'} bg-emerald-600 hover:bg-emerald-700`}
                    disabled={createTask.isPending || updateTask.isPending}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    {editingTask
                      ? (updateTask.isPending ? 'Salvando...' : 'Salvar Alterações')
                      : (createTask.isPending ? 'Criando...' : 'Criar Tarefa')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === 'active' && (
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Clock3 className="w-5 h-5 text-emerald-600" />
                Tarefas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-10 text-gray-600">Carregando tarefas...</div>
              ) : activeTasks.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Nenhuma tarefa ativa no momento.</div>
              ) : (
                <div className="space-y-3">
                  {activeTasks.map((task) => {
                    const categoryMeta = CATEGORY_META[task.category] || {
                      label: task.category,
                      icon: Target,
                      color: 'bg-gray-100 text-gray-700 border-gray-200',
                    }
                    const Icon = categoryMeta.icon
                    const deadline = getTaskDeadlineState(task)

                    return (
                      <div key={task.id} className="border rounded-lg p-4 border-gray-200 bg-white">
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
                              {task.category === 'campanha'
                                ? <CircleDollarSign className="w-3 h-3 mr-1" />
                                : <Star className="w-3 h-3 mr-1 fill-amber-600" />}
                              {task.category === 'campanha'
                                ? `R$ ${Number(task.offered_value || 0).toLocaleString('pt-BR')}`
                                : `${Number(task.points || 0).toLocaleString('pt-BR')} pts`}
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
                          {task.expires_at && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-semibold ${
                              deadline.isCritical
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : deadline.isWarning
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              Prazo: {deadline.timeLabel}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" />
                            Prova: {getProofTypeLabel(task)}
                          </span>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditTask(task)}
                            className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-xs border-red-300 text-red-700 hover:bg-red-50"
                            disabled={deleteTask.isPending}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Excluir
                          </Button>
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
              <CardTitle className="inline-flex items-center gap-2">
                <Archive className="w-5 h-5 text-gray-500" />
                Tarefas Concluídas / Expiradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-10 text-gray-600">Carregando tarefas...</div>
              ) : completedTasks.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Nenhuma tarefa concluída ou expirada.</div>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((task) => {
                    const categoryMeta = CATEGORY_META[task.category] || {
                      label: task.category,
                      icon: Target,
                      color: 'bg-gray-100 text-gray-700 border-gray-200',
                    }
                    const Icon = categoryMeta.icon
                    const deadline = getTaskDeadlineState(task)
                    const isExpiredCompleted = deadline.isExpired

                    return (
                      <div key={task.id} className="border rounded-lg p-4 bg-gray-50 border-gray-200 opacity-80">
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
                              {task.category === 'campanha'
                                ? <CircleDollarSign className="w-3 h-3 mr-1" />
                                : <Star className="w-3 h-3 mr-1 fill-amber-600" />}
                              {task.category === 'campanha'
                                ? `R$ ${Number(task.offered_value || 0).toLocaleString('pt-BR')}`
                                : `${Number(task.points || 0).toLocaleString('pt-BR')} pts`}
                            </Badge>
                            {task.status !== 'active' && !isExpiredCompleted && (
                              <Badge className="bg-gray-100 text-gray-700 border-gray-300 border">
                                Concluída/Arquivada
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
                            isExpiredCompleted
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {isExpiredCompleted ? 'Expirada em:' : 'Data final:'} {task.expires_at ? new Date(task.expires_at).toLocaleString('pt-BR') : 'Sem data'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" />
                            Prova: {getProofTypeLabel(task)}
                          </span>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditTask(task)}
                            className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-xs border-red-300 text-red-700 hover:bg-red-50"
                            disabled={deleteTask.isPending}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'forum' && (
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                {editingForumTopic ? 'Editar Tópico Fórum' : 'Criar Tópico Fórum'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleCreateForumTopic} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forum-title">Título *</Label>
                  <Input
                    id="forum-title"
                    value={forumForm.title}
                    onChange={(event) => setForumForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Ex: Dicas para engajamento sustentável"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forum-description">Descrição *</Label>
                  <Textarea
                    id="forum-description"
                    rows={4}
                    value={forumForm.description}
                    onChange={(event) => setForumForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Descreva o tópico..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Select
                    value={forumForm.category}
                    onValueChange={(value) => setForumForm((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dicas">Dicas</SelectItem>
                      <SelectItem value="duvidas">Dúvidas</SelectItem>
                      <SelectItem value="conquistas">Conquistas</SelectItem>
                      <SelectItem value="campanhas">Campanhas</SelectItem>
                      <SelectItem value="geral">Geral</SelectItem>
                      <SelectItem value="sugestoes">Sugestões</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  {editingForumTopic && (
                    <Button type="button" variant="outline" className="flex-1" onClick={resetForumForm}>
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className={`${editingForumTopic ? 'flex-1' : 'w-full'} bg-emerald-600 hover:bg-emerald-700`}
                    disabled={createForumTopic.isPending || updateForumTopic.isPending}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    {editingForumTopic
                      ? (updateForumTopic.isPending ? 'Salvando...' : 'Salvar Alterações')
                      : (createForumTopic.isPending ? 'Criando...' : 'Criar Tópico')}
                  </Button>
                </div>
              </form>

              <div className="border-t pt-6">
                <p className="text-sm font-semibold text-gray-700 mb-3">Tópicos já criados</p>
                {loadingForum ? (
                  <p className="text-sm text-gray-500">Carregando tópicos...</p>
                ) : forumTopics.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum tópico cadastrado ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {forumTopics.slice(0, 10).map((topic) => (
                      <div key={topic.id} className="rounded-lg border p-3 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900">{topic.title}</p>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{topic.description}</p>
                            <p className="text-xs text-gray-500 mt-1">{topic.author_name || topic.author_email || 'Admin'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge className="bg-gray-100 text-gray-700 border-gray-300 border">{topic.category || 'geral'}</Badge>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() => handleEditForumTopic(topic)}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs border-red-300 text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteForumTopic(topic.id)}
                                disabled={deleteForumTopic.isPending}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Excluir
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
