// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateForumTopic, useDeleteForumTopic, useForumTopics, useUpdateForumTopic } from '@/hooks/useForum'
import { useAdminTasks, useCreateTask, useDeactivateTask, useDeleteTask, useReactivateTask, useUpdateTask } from '@/hooks/useTasks'


import {
  Target,
  Calendar,
  Users,
  Star,
  CircleDollarSign,
  Megaphone,
  BookOpen,
  Share2,
  Clock3,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  Archive,
  LayoutGrid,
  Plus,
} from 'lucide-react'
import { notifyError, notifySuccess, notifyWarning } from '@/lib/toast'
import { getCampaignAdminVisibilityDeadline, isCampaignVisibleForAdminReview } from '@/lib/metrics-window'
import { C, heading, body } from '@/lib/theme'
import { PageHeader, PageHeaderLabel, usePageHeaderTheme } from "@/components/layout/PageShell";
import {
  usePageTheme,
  AdminAccessDenied,
  AdminStatCard,
  AdminTabButton,
} from '@/components/admin/AdminPageHelpers';
import OrganizationPicker from '@/components/admin/OrganizationPicker';
import {
  formatDateTimeLocalValue as formatLaunchDateTimeLocalValue,
  formatLaunchDateTime,
  isTaskScheduled,
} from '@/lib/task-scheduling'
import { getCampaignDeadlines } from '@/lib/campaign-deadlines'
import { stripFormattingForPreview, getDescriptionPlainText } from '@/lib/task-description-format'
import { TaskDescriptionEditor } from '@/components/tasks/TaskDescriptionEditor'

const CATEGORY_OPTIONS = [
  { value: 'campanha', label: 'Campanha (Paga)' },
  { value: 'sidequest_teste', label: 'Missão' },
]

const CATEGORY_META = {
  campanha: { label: 'Campanha', icon: Megaphone, color: 'bg-green-100 text-green-700 border-green-200' },
  oficina: { label: 'Oficina', icon: BookOpen, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  folhetim: { label: 'Folhetim', icon: Share2, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  compartilhar_ecoante: { label: 'Compartilhar Ecoante', icon: Users, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  sidequest_teste: { label: 'Missão', icon: Target, color: 'bg-amber-100 text-amber-700 border-amber-200' },
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
  schedule_launch: false,
  launch_at: '',
  relate_organization: true,
  organization_id: '',
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
  if (task.category === 'campanha') {
    return !isCampaignVisibleForAdminReview(task)
  }
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
  const adminVisibilityDeadline = task?.category === 'campanha'
    ? getCampaignAdminVisibilityDeadline(task?.expires_at)
    : null
  const effectiveExpiresAt = adminVisibilityDeadline || (task?.expires_at ? new Date(task.expires_at) : null)

  if (!effectiveExpiresAt) {
    return {
      isExpired: false,
      isCritical: false,
      isWarning: false,
      timeLabel: 'Sem data',
    }
  }

  if (Number.isNaN(effectiveExpiresAt.getTime())) {
    return {
      isExpired: false,
      isCritical: false,
      isWarning: false,
      timeLabel: 'Data inválida',
    }
  }

  const diffMs = effectiveExpiresAt.getTime() - Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const threeDaysMs = 3 * oneDayMs
  const pastUserDeadline = task?.category === 'campanha'
    && task?.expires_at
    && new Date(task.expires_at).getTime() < Date.now()
    && diffMs > 0

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
    timeLabel: pastUserDeadline
      ? `Revisão admin: ${days > 0 ? `${days}d ${hours}h` : `${hours}h`}`
      : (days > 0 ? `${days}d ${hours}h` : `${hours}h`),
  }
}

export default function AdminContentManagement() {
  const { barStyle } = usePageHeaderTheme();
  const {
    isLight, T, mutedColor, subColor, faintColor, labelColor, textColor,
    borderColor, cardBorder, surfaceBg, surfaceBgAlt, itemBg,
    inputStyle, selectStyle, optionStyle,
    pageTitleStyle, pageSubtitleStyle,
  } = usePageTheme()
  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: labelColor,
    display: 'block',
    marginBottom: 6,
    letterSpacing: '0.05em',
    ...body,
  }
  const textareaStyle = { ...inputStyle, resize: 'vertical' }
  const aInputCls = "w-full px-4 py-2.5 rounded-xl outline-none transition-all"
  const datetimeCalendarStroke = isLight ? '%231D1D1B' : 'white'
  const { user, profile } = useAuth()
  const { data: tasks = [], isLoading } = useAdminTasks()
  const { data: forumTopicsData, isLoading: loadingForum } = useForumTopics()
  const forumTopics = forumTopicsData?.topics ?? []
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const deactivateTask = useDeactivateTask()
  const reactivateTask = useReactivateTask()
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
  const inactiveTasks = useMemo(
    () => tasks.filter((task) => task.status === 'inactive'),
    [tasks]
  )
  const completedTasks = useMemo(
    () => tasks.filter((task) => (
      task.status !== 'inactive'
      && (task.status !== 'active' || isTaskExpired(task))
    )),
    [tasks]
  )

  const campaignCount = useMemo(() => activeTasks.filter((task) => task.category === 'campanha').length, [activeTasks])

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

  const campaignDeadlinePreview = useMemo(() => {
    if (!isCampaign || !formData.posting_deadline) return null

    const finalDate = new Date(formData.posting_deadline)
    if (Number.isNaN(finalDate.getTime())) return null

    const launchAtIso = formData.schedule_launch && formData.launch_at
      ? new Date(formData.launch_at).toISOString()
      : null

    return getCampaignDeadlines({
      category: 'campanha',
      campaign_type: formData.campaign_type,
      launch_at: launchAtIso,
      created_at: editingTask?.created_at || new Date().toISOString(),
      posting_deadline: finalDate.toISOString(),
      expires_at: finalDate.toISOString(),
    })
  }, [isCampaign, formData.campaign_type, formData.posting_deadline, formData.schedule_launch, formData.launch_at, editingTask?.created_at])

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
      schedule_launch: Boolean(task.launch_at),
      launch_at: formatLaunchDateTimeLocalValue(task.launch_at),
      relate_organization: task.category === 'campanha' ? true : Boolean(task.organization_id),
      organization_id: task.organization_id || '',
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
      notifySuccess('Tarefa excluída com sucesso! ✅')
    } catch (deleteError) {
      console.error('Erro ao excluir tarefa:', deleteError)
      notifyError(deleteError?.message || 'Não foi possível excluir a tarefa.')
    }
  }

  const handleDeactivateTask = async (task) => {
    const label = task.category === 'campanha' ? 'campanha' : 'missão'
    const shouldDeactivate = window.confirm(`Inativar esta ${label}? Ela deixará de aparecer para os usuários, mas poderá ser reativada depois.`)
    if (!shouldDeactivate) return

    try {
      await deactivateTask.mutateAsync(task.id)
      if (editingTask?.id === task.id) {
        resetForm()
      }
      notifySuccess(`${label.charAt(0).toUpperCase() + label.slice(1)} inativada com sucesso!`)
    } catch (deactivateError) {
      console.error('Erro ao inativar tarefa:', deactivateError)
      notifyError(deactivateError?.message || 'Não foi possível inativar a tarefa.')
    }
  }

  const handleReactivateTask = async (task) => {
    const label = task.category === 'campanha' ? 'campanha' : 'missão'

    try {
      await reactivateTask.mutateAsync(task.id)
      notifySuccess(`${label.charAt(0).toUpperCase() + label.slice(1)} reativada com sucesso!`)
    } catch (reactivateError) {
      console.error('Erro ao reativar tarefa:', reactivateError)
      notifyError(reactivateError?.message || 'Não foi possível reativar a tarefa.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const title = formData.title.trim()
    const description = formData.description
    const descriptionPlain = getDescriptionPlainText(description)
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

    if (!title || !descriptionPlain || !formData.category) {
      setError('Preencha título, descrição e categoria.')
      return
    }

    if (isCampaign && (offeredValue === null || Number.isNaN(offeredValue) || offeredValue <= 0)) {
      setError('Informe um valor oferecido válido (maior que zero).')
      return
    }

    if (isSidequestTest && (Number.isNaN(points) || points <= 0)) {
      setError('Informe uma pontuação válida para a Missão.')
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

    if (formData.schedule_launch && !formData.launch_at) {
      setError('Informe a data e hora do lançamento agendado.')
      return
    }

    if (isCampaign && !formData.organization_id) {
      setError('Selecione a organização (cliente) da campanha.')
      return
    }

    if (!isCampaign && formData.relate_organization && !formData.organization_id) {
      setError('Selecione uma organização ou desmarque a opção de relacionar.')
      return
    }

    const launchAtIso = formData.schedule_launch && formData.launch_at
      ? new Date(formData.launch_at).toISOString()
      : null

    if (launchAtIso && Number.isNaN(new Date(launchAtIso).getTime())) {
      setError('Informe uma data e hora de lançamento válida.')
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
        launch_at: launchAtIso,
        organization_id: isCampaign
          ? (formData.organization_id || null)
          : (formData.relate_organization ? (formData.organization_id || null) : null),
      }

      if (editingTask && launchAtIso && new Date(launchAtIso).getTime() > Date.now()) {
        taskPayload.launch_email_sent = false
      }

      if (editingTask) {
        await updateTask.mutateAsync({ taskId: editingTask.id, updates: taskPayload })
        notifySuccess('Tarefa atualizada com sucesso! ✅')
      } else {
        await createTask.mutateAsync(taskPayload)
        notifySuccess('Tarefa criada com sucesso! ✅')
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
      notifyWarning('Preencha título, descrição e categoria do tópico.')
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
        notifySuccess('Tópico atualizado com sucesso! ✅')
      } else {
        await createForumTopic.mutateAsync({
          title,
          description,
          category: forumForm.category,
          author_id: user?.id || null,
          author_name: profile?.display_name || profile?.full_name || 'Admin',
          author_email: profile?.email || user?.email || null,
        })
        notifySuccess('Tópico criado com sucesso! ✅')
      }

      setForumForm(initialForumForm)
      setEditingForumTopic(null)
    } catch (forumError) {
      console.error('Erro ao criar tópico:', forumError)
      notifyError(forumError?.message || 'Não foi possível criar o tópico.')
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
      notifySuccess('Tópico excluído com sucesso! ✅')
    } catch (deleteError) {
      console.error('Erro ao excluir tópico:', deleteError)
      notifyError(deleteError?.message || 'Não foi possível excluir o tópico.')
    }
  }

  const tabs = [
    { key: 'create', label: 'Criar Tarefa' },
    { key: 'active', label: `Ativas (${activeTasks.length})` },
    { key: 'inactive', label: `Inativas (${inactiveTasks.length})` },
    { key: 'completed', label: `Concluídas (${completedTasks.length})` },
    { key: 'forum', label: `Fórum (${forumTopics.length})` },
  ]

  if (profile?.role !== 'admin') {
    return (
      <AdminAccessDenied message="Você não tem permissão para acessar esta página." />
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>
      <style>{`
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24' fill='none' stroke='${datetimeCalendarStroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='16' y1='2' x2='16' y2='6'%3E%3C/line%3E%3Cline x1='8' y1='2' x2='8' y2='6'%3E%3C/line%3E%3Cline x1='3' y1='10' x2='21' y2='10'%3E%3C/line%3E%3C/svg%3E");
          width: 18px;
          height: 18px;
          background-size: contain;
          cursor: pointer;
        }
        ${!isLight ? 'input[type="datetime-local"] { color-scheme: dark; }' : ''}
      `}</style>

      <PageHeader>
        <PageHeaderLabel icon={LayoutGrid}>Gerenciar Conteúdo</PageHeaderLabel>
      </PageHeader>

      <div
        className="hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-0 sticky top-0 z-10"
        style={barStyle}
      >
      </div>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0 space-y-6 md:space-y-8">

        {/* ── Hero ── */}
        <div>
          <h1 style={{ ...pageTitleStyle, fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Gerenciar Conteúdo
          </h1>
          <p style={pageSubtitleStyle}>
            Crie tarefas e tópicos do fórum para os Ecoantes.
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <AdminStatCard icon={Target} label="Tarefas Ativas" value={activeTasks.length} color={C.lime} iconBg="rgba(200, 255, 0, 0.08)" />
          <AdminStatCard icon={Megaphone} label="Campanhas Ativas" value={campaignCount} color={C.orange} iconBg="rgba(255, 69, 0, 0.08)" />
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((t) => (
            <AdminTabButton
              key={t.key}
              type="button"
              active={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </AdminTabButton>
          ))}
        </div>

        {/*  TAB: CRIAR TAREFA */}
        {activeTab === 'create' && (
          <div className="flex flex-col gap-5 w-full">
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${borderColor}` }}>

              {/* Card header */}
              <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
                <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>
                  {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                </span>
              </div>

              <div className="p-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                  <OrganizationPicker
                    value={formData.organization_id}
                    onChange={(organizationId) => setFormData((prev) => ({ ...prev, organization_id: organizationId }))}
                    required={isCampaign}
                    optionalToggle={!isCampaign}
                    enabled={isCampaign ? true : formData.relate_organization}
                    onEnabledChange={(checked) => setFormData((prev) => ({
                      ...prev,
                      relate_organization: checked,
                      organization_id: checked ? prev.organization_id : '',
                    }))}
                  />

                  {/* Título + Categoria */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>TÍTULO <span style={{ color: C.orange }}>*</span></label>
                      <input
                        className={aInputCls}
                        style={inputStyle}
                        value={formData.title}
                        onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Ex: Post sobre Dia da Terra"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>CATEGORIA <span style={{ color: C.orange }}>*</span></label>
                      <select
                        className={aInputCls}
                        style={selectStyle}
                        value={formData.category}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          category: e.target.value,
                          without_deadline: e.target.value === 'campanha' ? false : prev.without_deadline,
                          relate_organization: e.target.value === 'campanha' ? true : prev.relate_organization,
                          organization_id: e.target.value === 'campanha' ? prev.organization_id : prev.organization_id,
                        }))}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} style={optionStyle}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Missão points */}
                  {isSidequestTest && (
                    <div className="rounded-xl p-4" style={{ border: `1px solid rgba(245,158,11,0.3)`, backgroundColor: 'rgba(245,158,11,0.06)' }}>
                      <label style={{ ...labelStyle, color: '#f59e0b' }}>PONTUAÇÃO DA MISSÃO <span style={{ color: C.orange }}>*</span></label>
                      <input
                        className={aInputCls}
                        style={inputStyle}
                        type="number"
                        min="1"
                        value={formData.points}
                        onChange={(e) => setFormData((prev) => ({ ...prev, points: e.target.value }))}
                        placeholder="Ex: 120"
                      />
                      <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 5 }}>Defina manualmente quantos pontos essa missão vale.</p>
                    </div>
                  )}

                  {/* Folhetim type */}
                  {formData.category === 'folhetim' && (
                    <div>
                      <label style={labelStyle}>TIPO DE FOLHETIM</label>
                      <select
                        className={aInputCls}
                        style={selectStyle}
                        value={formData.folhetim_type}
                        onChange={(e) => setFormData((prev) => ({ ...prev, folhetim_type: e.target.value }))}
                      >
                        <option value="" style={optionStyle}>Selecione o tipo</option>
                        <option value="compartilhar" style={optionStyle}>Compartilhar</option>
                        <option value="criar" style={optionStyle}>Criar Conteúdo</option>
                      </select>
                    </div>
                  )}

                  {/* Descrição */}
                  <div>
                    <label style={labelStyle}>DESCRIÇÃO <span style={{ color: C.orange }}>*</span></label>
                    <TaskDescriptionEditor
                      value={formData.description}
                      onChange={(nextDescription) => setFormData((prev) => ({ ...prev, description: nextDescription }))}
                    />
                  </div>

                  {/* Tipo de conteúdo */}
                  <div className="rounded-xl p-5 flex flex-col" style={{ border: `1px solid ${borderColor}`, backgroundColor: surfaceBg }}>
                    <div style={{ ...heading, fontSize: 13, fontWeight: 700, color: textColor, marginBottom: 4 }}>Tipo de Conteúdo a Produzir</div>
                    <div style={{ fontSize: 12, color: mutedColor, marginBottom: 12 }}>Selecione um ou mais formatos</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
                      {CONTENT_TYPE_OPTIONS.map((format) => (
                        <label key={format} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            style={{ accentColor: C.lime, width: 14, height: 14 }}
                            checked={formData.content_formats.includes(format)}
                            onChange={() => toggleContentFormat(format)}
                          />
                          <span style={{ fontSize: 13, color: isLight ? T.textSub : `${C.cream}80` }}>{format}</span>
                        </label>
                      ))}
                    </div>
                    {formData.content_formats.includes('Outro') && (
                      <input
                        className={aInputCls}
                        style={{ ...inputStyle, marginTop: 12 }}
                        value={formData.content_type_other}
                        onChange={(e) => setFormData((prev) => ({ ...prev, content_type_other: e.target.value }))}
                        placeholder="Especifique o tipo de conteúdo..."
                      />
                    )}
                  </div>

                  {/* Valor / Pontos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isCampaign ? (
                      <div>
                        <label style={labelStyle}>VALOR OFERECIDO (R$) <span style={{ color: C.orange }}>*</span></label>
                        <input
                          className={aInputCls}
                          style={inputStyle}
                          type="number"
                          min="1"
                          value={formData.offered_value}
                          onChange={(e) => setFormData((prev) => ({ ...prev, offered_value: e.target.value }))}
                          placeholder="Ex: 1000"
                        />
                        <div style={{ fontSize: 11, color: C.lime, marginTop: 5, fontWeight: 500 }}>Valor por influenciador</div>
                      </div>
                    ) : !isSidequestTest ? (
                      <div>
                        <label style={labelStyle}>PONTOS DA CATEGORIA</label>
                        <input
                          className={aInputCls}
                          style={{ ...inputStyle, opacity: 0.5 }}
                          value={selectedCategory?.points || 50}
                          disabled
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Data/hora — campanha */}
                  {isCampaign && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Clock3 size={14} style={{ color: C.orange }} />
                        <label style={{ ...labelStyle, marginBottom: 0 }}>DATA E HORA FINAL DA TAREFA <span style={{ color: C.orange }}>*</span></label>
                      </div>
                      <p style={{ fontSize: 11, color: faintColor, marginBottom: 8 }}>
                        Se a data final ficar em até 3 dias úteis, a campanha vira{' '}
                        <span style={{ color: C.lime, fontWeight: 600 }}>Resposta Rápida</span>.
                      </p>
                      <input
                        type="datetime-local"
                        className={aInputCls}
                        style={{ ...inputStyle, maxWidth: 260 }}
                        value={formData.posting_deadline}
                        onChange={(e) => setFormData((prev) => ({ ...prev, posting_deadline: e.target.value }))}
                      />
                      {campaignDeadlinePreview && (
                        <div style={{ marginTop: 10, fontSize: 11, color: faintColor, lineHeight: 1.65 }}>
                          <p style={{ fontWeight: 600, color: isLight ? T.textSub : `${C.cream}90`, marginBottom: 4 }}>
                            {formData.campaign_type === 'resposta_rapida'
                              ? 'Cronograma de Resposta Rápida (sem roteiro)'
                              : 'Cronograma derivado (roteiro / conteúdo)'}
                          </p>
                          <p>Candidatura até: {formatLaunchDateTime(campaignDeadlinePreview.applicationDeadline) || '—'}</p>
                          {campaignDeadlinePreview.scriptDeadline && (
                            <p>Roteiro até: {formatLaunchDateTime(campaignDeadlinePreview.scriptDeadline)}</p>
                          )}
                          <p>Conteúdo até: {formatLaunchDateTime(campaignDeadlinePreview.contentDeadline) || '—'}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Data/hora — não-campanha */}
                  {!isCampaign && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Clock3 size={13} style={{ color: C.orange }} />
                        <label style={{ ...labelStyle, marginBottom: 0 }}>DATA E HORA FINAL DA TAREFA</label>
                      </div>
                      <label className="flex items-center gap-2.5 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          style={{ accentColor: C.lime, width: 14, height: 14 }}
                          checked={formData.without_deadline}
                          onChange={(e) => setFormData((prev) => ({ ...prev, without_deadline: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, color: isLight ? T.textSub : `${C.cream}80` }}>Sem data (tempo indeterminado)</span>
                      </label>
                      <input
                        type="datetime-local"
                        className={aInputCls}
                        style={{ ...inputStyle, maxWidth: 260, opacity: formData.without_deadline ? 0.4 : 1 }}
                        value={formData.posting_deadline}
                        onChange={(e) => setFormData((prev) => ({ ...prev, posting_deadline: e.target.value }))}
                        disabled={formData.without_deadline}
                      />
                    </div>
                  )}

                  {/* Agendamento de lançamento */}
                  <div>
                    <label className="flex items-center gap-2.5 cursor-pointer w-fit mb-2">
                      <input
                        type="checkbox"
                        style={{ accentColor: C.lime, width: 16, height: 16 }}
                        checked={formData.schedule_launch}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          schedule_launch: e.target.checked,
                          launch_at: e.target.checked ? prev.launch_at : '',
                        }))}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: isLight ? T.textSub : `${C.cream}80` }}>Agendar lançamento</span>
                    </label>
                    {formData.schedule_launch && (
                      <>
                        <p style={{ fontSize: 11, color: faintColor, marginBottom: 8 }}>
                          A tarefa ficará visível antes do horário, mas só poderá ser feita após o lançamento.
                          {isCampaign && ' Campanhas agendadas recebem e-mail apenas quando forem liberadas.'}
                        </p>
                        <input
                          type="datetime-local"
                          className={aInputCls}
                          style={{ ...inputStyle, maxWidth: 260 }}
                          value={formData.launch_at}
                          onChange={(e) => setFormData((prev) => ({ ...prev, launch_at: e.target.value }))}
                        />
                      </>
                    )}
                  </div>

                  {/* Máx participantes + Tipo campanha */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>MÁXIMO DE PARTICIPANTES {isCampaign ? <span style={{ color: C.orange }}>*</span> : '(OPCIONAL)'}</label>
                      <input
                        className={aInputCls}
                        style={inputStyle}
                        type="number"
                        min="1"
                        value={formData.max_participants}
                        onChange={(e) => setFormData((prev) => ({ ...prev, max_participants: e.target.value }))}
                        placeholder="Número de vagas"
                      />
                    </div>
                    {isCampaign && (
                      <div>
                        <label style={labelStyle}>TIPO DE CAMPANHA</label>
                        <select
                          className={aInputCls}
                          style={{ ...selectStyle, opacity: 0.5 }}
                          value={formData.campaign_type}
                          disabled
                        >
                          <option value="comum" style={optionStyle}>Comum</option>
                          <option value="resposta_rapida" style={optionStyle}>Resposta Rápida</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Requer inscrição */}
                  <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      style={{ accentColor: C.lime, width: 16, height: 16 }}
                      checked={formData.requires_application}
                      onChange={(e) => setFormData((prev) => ({ ...prev, requires_application: e.target.checked }))}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: isLight ? T.textSub : `${C.cream}80` }}>Requer inscrição</span>
                  </label>

                  {/* Requisitos de inscrição */}
                  {formData.requires_application && (
                    <div className="rounded-xl p-5 flex flex-col gap-4" style={{ border: `1px solid ${borderColor}`, backgroundColor: surfaceBg }}>
                      <div style={{ ...heading, fontSize: 13, fontWeight: 700, color: textColor }}>Requisitos de Inscrição</div>
                      <div>
                        <label style={labelStyle}>REQUISITOS DE PERFIL</label>
                        <textarea
                          className={aInputCls}
                          style={textareaStyle}
                          rows={3}
                          value={formData.profile_requirements}
                          onChange={(e) => setFormData((prev) => ({ ...prev, profile_requirements: e.target.value }))}
                          placeholder="Ex: experiência com conteúdo sustentável..."
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label style={labelStyle}>MÍNIMO DE SEGUIDORES</label>
                          <input
                            className={aInputCls}
                            style={inputStyle}
                            type="number"
                            min="0"
                            value={formData.min_followers}
                            onChange={(e) => setFormData((prev) => ({ ...prev, min_followers: e.target.value }))}
                            placeholder="Ex: 10000"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>PÚBLICO-ALVO</label>
                          <input
                            className={aInputCls}
                            style={inputStyle}
                            value={formData.target_audience}
                            onChange={(e) => setFormData((prev) => ({ ...prev, target_audience: e.target.value }))}
                            placeholder="Ex: jovens interessados em sustentabilidade"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <p style={{ fontSize: 13, color: '#f87171', backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 14px' }}>
                      {error}
                    </p>
                  )}

                  {/* Botões */}
                  <div className="flex gap-3">
                    {editingTask && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="flex-1 h-[52px] rounded-xl transition-all"
                        style={{ border: `1px solid ${borderColor}`, backgroundColor: 'transparent', color: isLight ? T.textSub : `${C.cream}80`, ...heading, fontSize: 15, fontWeight: 700 }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={createTask.isPending || updateTask.isPending}
                      className={`${editingTask ? 'flex-1' : 'w-full'} h-[52px] rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.99]`}
                      style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontSize: 15, fontWeight: 700 }}
                    >
                      <Plus size={18} />
                      {editingTask
                        ? (updateTask.isPending ? 'Salvando...' : 'Salvar Alterações')
                        : (createTask.isPending ? 'Criando...' : 'Criar Tarefa')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: ATIVAS
        ══════════════════════════════════════════ */}
        {activeTab === 'active' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? C.card : C.card, border: `1px solid ${borderColor}` }}>
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
              <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>Tarefas Ativas</span>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div style={{ color: mutedColor, textAlign: 'center', padding: '40px 0' }}>Carregando tarefas...</div>
              ) : activeTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: itemBg, border: `1px solid ${cardBorder}` }}>
                    <Target size={24} style={{ color: faintColor }} />
                  </div>
                  <p style={{ ...heading, fontSize: 16, color: mutedColor, textAlign: 'center' }}>Nenhuma tarefa ativa no momento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeTasks.map((task) => {
                    const categoryMeta = CATEGORY_META[task.category] || { label: task.category, icon: Target, color: '' }
                    const Icon = categoryMeta.icon
                    const deadline = getTaskDeadlineState(task)
                    const scheduled = isTaskScheduled(task)
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        Icon={Icon}
                        categoryMeta={categoryMeta}
                        deadline={deadline}
                        scheduled={scheduled}
                        launchLabel={scheduled ? formatLaunchDateTime(task.launch_at) : null}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        onDeactivate={handleDeactivateTask}
                        deleteIsPending={deleteTask.isPending}
                        deactivateIsPending={deactivateTask.isPending}
                        heading={heading}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: INATIVAS
        ══════════════════════════════════════════ */}
        {activeTab === 'inactive' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? C.card : C.card, border: `1px solid ${borderColor}` }}>
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.orange }} />
              <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>Tarefas Inativas</span>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div style={{ color: mutedColor, textAlign: 'center', padding: '40px 0' }}>Carregando tarefas...</div>
              ) : inactiveTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: itemBg, border: `1px solid ${cardBorder}` }}>
                    <ToggleLeft size={24} style={{ color: faintColor }} />
                  </div>
                  <p style={{ ...heading, fontSize: 16, color: mutedColor, textAlign: 'center' }}>Nenhuma tarefa inativa no momento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inactiveTasks.map((task) => {
                    const categoryMeta = CATEGORY_META[task.category] || { label: task.category, icon: Target, color: '' }
                    const Icon = categoryMeta.icon
                    const deadline = getTaskDeadlineState(task)
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        Icon={Icon}
                        categoryMeta={categoryMeta}
                        deadline={deadline}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        onReactivate={handleReactivateTask}
                        deleteIsPending={deleteTask.isPending}
                        reactivateIsPending={reactivateTask.isPending}
                        heading={heading}
                        dimmed
                        inactive
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: CONCLUÍDAS
        ══════════════════════════════════════════ */}
        {activeTab === 'completed' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? C.card : C.card, border: `1px solid ${borderColor}` }}>
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isLight ? T.textFaint : `${C.cream}30` }} />
              <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>Tarefas Concluídas / Expiradas</span>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div style={{ color: mutedColor, textAlign: 'center', padding: '40px 0' }}>Carregando tarefas...</div>
              ) : completedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: itemBg, border: `1px solid ${cardBorder}` }}>
                    <Archive size={24} style={{ color: faintColor }} />
                  </div>
                  <p style={{ ...heading, fontSize: 16, color: mutedColor, textAlign: 'center' }}>Nenhuma tarefa concluída ou expirada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((task) => {
                    const categoryMeta = CATEGORY_META[task.category] || { label: task.category, icon: Target, color: '' }
                    const Icon = categoryMeta.icon
                    const deadline = getTaskDeadlineState(task)
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        Icon={Icon}
                        categoryMeta={categoryMeta}
                        deadline={deadline}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        deleteIsPending={deleteTask.isPending}
                        heading={heading}
                        dimmed
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: FÓRUM
        ══════════════════════════════════════════ */}
        {activeTab === 'forum' && (
          <div className="flex flex-col gap-5 w-full">
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? C.card : C.card, border: `1px solid ${borderColor}` }}>
              <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
                <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>
                  {editingForumTopic ? 'Editar Tópico do Fórum' : 'Criar Tópico do Fórum'}
                </span>
              </div>

              <div className="p-6">
                <form onSubmit={handleCreateForumTopic} className="flex flex-col gap-5">
                  <div>
                    <label style={labelStyle}>TÍTULO <span style={{ color: C.orange }}>*</span></label>
                    <input
                      className={aInputCls}
                      style={inputStyle}
                      value={forumForm.title}
                      onChange={(e) => setForumForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex: Dicas para engajamento sustentável"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>DESCRIÇÃO <span style={{ color: C.orange }}>*</span></label>
                    <textarea
                      className={aInputCls}
                      style={textareaStyle}
                      rows={4}
                      value={forumForm.description}
                      onChange={(e) => setForumForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Descreva o tópico..."
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>CATEGORIA <span style={{ color: C.orange }}>*</span></label>
                    <select
                      className={aInputCls}
                      style={selectStyle}
                      value={forumForm.category}
                      onChange={(e) => setForumForm((prev) => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="dicas" style={optionStyle}>Dicas</option>
                      <option value="duvidas" style={optionStyle}>Dúvidas</option>
                      <option value="conquistas" style={optionStyle}>Conquistas</option>
                      <option value="campanhas" style={optionStyle}>Campanhas</option>
                      <option value="geral" style={optionStyle}>Geral</option>
                      <option value="sugestoes" style={optionStyle}>Sugestões</option>
                    </select>
                  </div>

                  <div className="flex gap-3">
                    {editingForumTopic && (
                      <button
                        type="button"
                        onClick={resetForumForm}
                        className="flex-1 h-[52px] rounded-xl transition-all"
                        style={{ border: `1px solid ${borderColor}`, backgroundColor: 'transparent', color: isLight ? T.textSub : `${C.cream}80`, ...heading, fontSize: 15, fontWeight: 700 }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={createForumTopic.isPending || updateForumTopic.isPending}
                      className={`${editingForumTopic ? 'flex-1' : 'w-full'} h-[52px] rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.99]`}
                      style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontSize: 15, fontWeight: 700 }}
                    >
                      <Plus size={18} />
                      {editingForumTopic
                        ? (updateForumTopic.isPending ? 'Salvando...' : 'Salvar Alterações')
                        : (createForumTopic.isPending ? 'Criando...' : 'Criar Tópico')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Lista / gerenciar tópicos */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? C.card : C.card, border: `1px solid ${borderColor}` }}>
              <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3">
                  <MessageSquare size={16} style={{ color: C.orange }} />
                  <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>
                    Gerenciar tópicos
                  </span>
                </div>
                <span style={{ fontSize: 12, color: faintColor, fontWeight: 600 }}>
                  {forumTopics.length} tópico{forumTopics.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="p-6">
                {loadingForum ? (
                  <p style={{ fontSize: 13, color: mutedColor }}>Carregando tópicos...</p>
                ) : forumTopics.length === 0 ? (
                  <p style={{ fontSize: 13, color: mutedColor }}>Nenhum tópico cadastrado ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {forumTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="rounded-2xl p-5"
                        style={{ border: `1px solid ${borderColor}`, backgroundColor: surfaceBgAlt }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p style={{ ...heading, color: textColor, fontSize: 15, fontWeight: 700 }}>{topic.title}</p>
                            <p style={{ color: subColor, fontSize: 13, marginTop: 4 }} className="line-clamp-2">{topic.description}</p>
                            <p style={{ fontSize: 11, color: faintColor, marginTop: 6 }}>{topic.author_name || topic.author_email || 'Admin'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span
                              style={{
                                backgroundColor: `${C.lime}20`,
                                color: isLight ? C.darkGreen : C.lime,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: 999,
                              }}
                            >
                              {topic.category || 'geral'}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditForumTopic(topic)}
                                className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                                style={{ border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`, backgroundColor: 'transparent', color: isLight ? T.textSub : `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                              >
                                <Pencil size={12} /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteForumTopic(topic.id)}
                                disabled={deleteForumTopic.isPending}
                                className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-50"
                                style={{ border: `1px solid rgba(248,113,113,0.35)`, backgroundColor: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 12, fontWeight: 600, ...heading }}
                              >
                                <Trash2 size={12} /> Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Task Card (shared between Ativas / Inativas / Concluídas) ───────────────
function TaskCard({
  task,
  Icon,
  categoryMeta,
  deadline,
  scheduled = false,
  launchLabel = null,
  onEdit,
  onDelete,
  onDeactivate,
  onReactivate,
  deleteIsPending,
  deactivateIsPending = false,
  reactivateIsPending = false,
  heading,
  dimmed = false,
  inactive = false,
}) {
  const { isLight, T, textColor, subColor, faintColor, borderColor, surfaceBg, surfaceBgAlt } = usePageTheme()

  return (
    <div
      className="relative rounded-2xl p-5 transition-all"
      style={{
        border: `1px solid ${scheduled ? 'rgba(170,102,255,0.25)' : borderColor}`,
        backgroundColor: scheduled ? 'rgba(170,102,255,0.06)' : dimmed ? (isLight ? T.itemBg : 'rgba(var(--ink),0.01)') : surfaceBgAlt,
        opacity: dimmed ? 0.75 : 1,
      }}
    >
      {/* Badges */}
      <div className="absolute top-4 right-4 flex items-center gap-2 flex-wrap justify-end" style={{ maxWidth: '45%' }}>
        {scheduled && launchLabel && (
          <span style={{ backgroundColor: 'rgba(170,102,255,0.18)', color: C.purple, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock3 size={11} /> Agendada · {launchLabel}
          </span>
        )}
        {inactive && (
          <span style={{ backgroundColor: C.orange_back, color: C.orange, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ToggleLeft size={11} /> Inativa
          </span>
        )}
        <span style={{ backgroundColor: `${C.lime}20`, color: isLight ? C.darkGreen : C.lime, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon size={11} /> {categoryMeta.label}
        </span>
        <span style={{ backgroundColor: `${C.blue}18`, color: C.blue, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {task.category === 'campanha'
            ? <><CircleDollarSign size={11} /> R$ {Number(task.offered_value || 0).toLocaleString('pt-BR')}</>
            : <><Star size={11} /> {Number(task.points || 0).toLocaleString('pt-BR')} pts</>}
        </span>
      </div>

      {/* Content */}
      <div style={{ paddingRight: '46%' }}>
        <h3 style={{ ...heading, color: textColor, fontSize: 17, fontWeight: 700 }} className="break-words">{task.title}</h3>
        <p style={{ color: subColor, fontSize: 13, marginTop: 6 }} className="line-clamp-2">{stripFormattingForPreview(task.description)}</p>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 mt-4" style={{ fontSize: 12 }}>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{
            backgroundColor: deadline.isExpired
              ? 'rgba(248,113,113,0.12)' : deadline.isCritical
                ? 'rgba(251,146,60,0.12)' : deadline.isWarning
                  ? 'rgba(250,204,21,0.10)' : (isLight ? T.itemBg : 'rgba(var(--ink),0.06)'),
            color: deadline.isExpired
              ? '#f87171' : deadline.isCritical
                ? '#fb923c' : deadline.isWarning
                  ? '#facc15' : (isLight ? T.textSub : `${C.cream}60`),
          }}
        >
          <Calendar size={12} />
          {deadline.isExpired
            ? 'Expirada'
            : task.expires_at
              ? `${new Date(task.expires_at).toLocaleString('pt-BR')} (${deadline.timeLabel})`
              : 'Sem data'}
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: faintColor }}>
          <Target size={12} /> Conteúdo: {getProofTypeLabel(task)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={() => onEdit(task)}
          className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
          style={{ border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`, backgroundColor: 'transparent', color: isLight ? T.textSub : `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
        >
          <Pencil size={12} /> Editar
        </button>
        {onDeactivate && task.status === 'active' && (
          <button
            onClick={() => onDeactivate(task)}
            disabled={deactivateIsPending}
            className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-50"
            style={{ border: `1px solid ${C.orange}40`, backgroundColor: C.orange_back, color: C.orange, fontSize: 12, fontWeight: 600, ...heading }}
          >
            <ToggleRight size={12} /> Inativar
          </button>
        )}
        {onReactivate && task.status === 'inactive' && (
          <button
            onClick={() => onReactivate(task)}
            disabled={reactivateIsPending}
            className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-50"
            style={{ border: `1px solid ${C.lime}40`, backgroundColor: C.lime_back, color: C.lime, fontSize: 12, fontWeight: 600, ...heading }}
          >
            <ToggleLeft size={12} /> Reativar
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          disabled={deleteIsPending}
          className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-50"
          style={{ border: `1px solid rgba(248,113,113,0.25)`, backgroundColor: 'transparent', color: '#f87171', fontSize: 12, fontWeight: 600, ...heading }}
        >
          <Trash2 size={12} /> Excluir
        </button>
      </div>
    </div>
  )
}
