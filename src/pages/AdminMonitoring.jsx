// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminTasks } from '@/hooks/useTasks'
import { usePendingSubmissions } from '@/hooks/useSubmissions'
import { adminUsersService } from '@/services/admin-users.service'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Activity, Shield, Search, Target, Users, ClipboardList,
  ChevronLeft, ChevronRight, Download, ArrowUpDown, Eye,
  CheckCircle, Clock, XCircle, TrendingUp, UserRound,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { C, heading, body, getModalBackground } from '@/lib/theme'
import { PageHeader, PageHeaderLabel } from "@/components/layout/PageShell";
import { usePageTheme, AdminAccessDenied, AdminEmptyState, AdminTabButton } from '@/components/admin/AdminPageHelpers';

const PAGE_SIZE = 10

const CATEGORY_LABELS = {
  campanha: 'Campanha',
  sidequest_teste: 'Missão',
  resposta_rapida: 'Resposta Rápida',
}

const TASK_STATUS_LABELS = {
  active: 'Ativa',
  inactive: 'Inativa',
  archived: 'Arquivada',
}

const SUBMISSION_STATUS_LABELS = {
  application_pending: 'Inscrição pendente',
  application_approved: 'Selecionado',
  application_rejected: 'Inscrição rejeitada',
  proof_pending: 'Prova em análise',
  approved: 'Concluída',
  rejected: 'Prova rejeitada',
  pending: 'Pendente',
}

const SUBMISSION_STATUS_COLORS = {
  application_pending: { bg: 'rgba(255,165,0,0.12)', color: C.orange },
  application_approved: { bg: `${C.cyan}18`, color: C.cyan },
  application_rejected: { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  proof_pending: { bg: `${C.purple}18`, color: C.purple },
  approved: { bg: `${C.lime}18`, color: C.lime },
  rejected: { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  pending: { bg: 'rgba(255,165,0,0.12)', color: C.orange },
}

const USER_CATEGORY_LABELS = {
  voz_e_violao: 'Voz e Violão',
  dueto: 'Dueto',
  fanfarra: 'Fanfarra',
  carnaval: 'Carnaval',
}

const normalizeSubmissionStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'pendente') return 'application_pending'
  if (normalized === 'aprovada' || normalized === 'aprovado') return 'approved'
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'rejected'
  return normalized
}

const isCompletedStatus = (status) => normalizeSubmissionStatus(status) === 'approved'
const isRejectedStatus = (status) => ['application_rejected', 'rejected'].includes(normalizeSubmissionStatus(status))
const isPendingStatus = (status) => {
  const s = normalizeSubmissionStatus(status)
  return ['application_pending', 'application_approved', 'proof_pending', 'pending'].includes(s)
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR })
}

const formatShortDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

const aInputCls = 'w-full px-4 py-2.5 rounded-xl outline-none transition-all'

const exportCsv = (headers, rows, filename) => {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const content = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function StatusBadge({ status }) {
  const { isLight, T } = usePageTheme()
  const normalized = normalizeSubmissionStatus(status)
  const label = SUBMISSION_STATUS_LABELS[normalized] || status || '—'
  const colors = SUBMISSION_STATUS_COLORS[normalized] || {
    bg: isLight ? T.itemBg : 'rgba(var(--ink),0.08)',
    color: isLight ? T.textSub : `${C.cream}70`,
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: colors.bg, color: colors.color }}>
      {label}
    </span>
  )
}

function Pagination({ page, totalPages, onPageChange }) {
  const { mutedColor, textColor, borderColor } = usePageTheme()
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: `1px solid ${borderColor}` }}>
      <span style={{ fontSize: 12, color: mutedColor }}>
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
          style={{ border: `1px solid ${borderColor}`, color: textColor }}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
          style={{ border: `1px solid ${borderColor}`, color: textColor }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

function SortButton({ label, field, sortField, sortDir, onSort }) {
  const { isLight, T } = usePageTheme()
  const active = sortField === field
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
      style={{
        color: active ? (isLight ? T.accent : C.lime) : (isLight ? T.textFaint : `${C.cream}40`),
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
      }}
    >
      {label}
      <ArrowUpDown size={10} style={{ opacity: active ? 1 : 0.4, transform: active && sortDir === 'asc' ? 'rotate(180deg)' : 'none' }} />
    </button>
  )
}

export default function AdminMonitoring() {
  const { profile } = useAuth()
  const {
    isLight, T, mutedColor, subColor, faintColor, textColor,
    borderColor, cardBorder, surfaceBg, surfaceBgAlt, itemBg,
    inputStyle, selectStyle, optionStyle, pageTitleStyle, pageSubtitleStyle,
  } = usePageTheme()
  const modalBg = getModalBackground(isLight)
  const [activeTab, setActiveTab] = useState('tasks')
  const [taskSearch, setTaskSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all')
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [taskPage, setTaskPage] = useState(1)
  const [userPage, setUserPage] = useState(1)
  const [taskSort, setTaskSort] = useState({ field: 'created_at', dir: 'desc' })
  const [userSort, setUserSort] = useState({ field: 'submissions', dir: 'desc' })
  const [selectedTask, setSelectedTask] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)

  const { data: tasks = [], isLoading: tasksLoading } = useAdminTasks()
  const { data: submissions = [], isLoading: submissionsLoading } = usePendingSubmissions()
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminUsersService.listUsers(),
  })

  const isLoading = tasksLoading || submissionsLoading || usersLoading

  const submissionsByTask = useMemo(() => {
    const map = new Map()
    for (const sub of submissions) {
      const taskId = sub.task_id || sub.task?.id
      if (!taskId) continue
      if (!map.has(taskId)) map.set(taskId, [])
      map.get(taskId).push(sub)
    }
    return map
  }, [submissions])

  const submissionsByUser = useMemo(() => {
    const map = new Map()
    for (const sub of submissions) {
      const userId = sub.user_id || sub.profile?.id
      if (!userId) continue
      if (!map.has(userId)) map.set(userId, [])
      map.get(userId).push(sub)
    }
    return map
  }, [submissions])

  const overview = useMemo(() => {
    const activeUsers = users.filter((u) => u.is_active !== false && u.role !== 'admin').length
    const activeTasks = tasks.filter((t) => t.status === 'active').length
    const completed = submissions.filter((s) => isCompletedStatus(s.status)).length
    const pending = submissions.filter((s) => isPendingStatus(s.status)).length

    const taskPopularity = tasks.map((task) => ({
      task,
      count: (submissionsByTask.get(task.id) || []).length,
    })).sort((a, b) => b.count - a.count).slice(0, 5)

    const userActivity = users
      .filter((u) => u.role !== 'admin')
      .map((user) => ({
        user,
        count: (submissionsByUser.get(user.id) || []).length,
        completed: (submissionsByUser.get(user.id) || []).filter((s) => isCompletedStatus(s.status)).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalUsers: users.length,
      activeUsers,
      totalTasks: tasks.length,
      activeTasks,
      totalSubmissions: submissions.length,
      completedSubmissions: completed,
      pendingSubmissions: pending,
      taskPopularity,
      userActivity,
    }
  }, [users, tasks, submissions, submissionsByTask, submissionsByUser])

  const handleTaskSort = (field) => {
    setTaskSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
    }))
    setTaskPage(1)
  }

  const handleUserSort = (field) => {
    setUserSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
    }))
    setUserPage(1)
  }

  const enrichedTasks = useMemo(() => {
    return tasks.map((task) => {
      const taskSubs = submissionsByTask.get(task.id) || []
      return {
        ...task,
        submissionCount: taskSubs.length,
        completedCount: taskSubs.filter((s) => isCompletedStatus(s.status)).length,
        pendingCount: taskSubs.filter((s) => isPendingStatus(s.status)).length,
        rejectedCount: taskSubs.filter((s) => isRejectedStatus(s.status)).length,
        participants: taskSubs,
      }
    })
  }, [tasks, submissionsByTask])

  const filteredTasks = useMemo(() => {
    const term = taskSearch.trim().toLowerCase()
    let result = enrichedTasks.filter((task) => {
      if (taskCategoryFilter !== 'all' && task.category !== taskCategoryFilter) return false
      if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false
      if (!term) return true
      const haystack = [task.title, task.description, CATEGORY_LABELS[task.category]].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })

    const dir = taskSort.dir === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      switch (taskSort.field) {
        case 'title':
          return dir * String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR')
        case 'submissions':
          return dir * (a.submissionCount - b.submissionCount)
        case 'participants':
          return dir * (Number(a.current_participants || 0) - Number(b.current_participants || 0))
        case 'category':
          return dir * String(CATEGORY_LABELS[a.category] || '').localeCompare(String(CATEGORY_LABELS[b.category] || ''), 'pt-BR')
        default:
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }
    })

    return result
  }, [enrichedTasks, taskSearch, taskCategoryFilter, taskStatusFilter, taskSort])

  const enrichedUsers = useMemo(() => {
    return users.map((user) => {
      const userSubs = submissionsByUser.get(user.id) || []
      return {
        ...user,
        submissionCount: userSubs.length,
        completedCount: userSubs.filter((s) => isCompletedStatus(s.status)).length,
        pendingCount: userSubs.filter((s) => isPendingStatus(s.status)).length,
        rejectedCount: userSubs.filter((s) => isRejectedStatus(s.status)).length,
        submissions: userSubs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }
    })
  }, [users, submissionsByUser])

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase()
    let result = enrichedUsers.filter((user) => {
      if (userRoleFilter !== 'all' && user.role !== userRoleFilter) return false
      if (userStatusFilter === 'active' && user.is_active === false) return false
      if (userStatusFilter === 'inactive' && user.is_active !== false) return false
      if (!term) return true
      const haystack = [user.full_name, user.display_name, user.email, user.instagram_handle, user.cpf]
        .filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })

    const dir = userSort.dir === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      switch (userSort.field) {
        case 'name':
          return dir * String(a.full_name || a.display_name || '').localeCompare(String(b.full_name || b.display_name || ''), 'pt-BR')
        case 'submissions':
          return dir * (a.submissionCount - b.submissionCount)
        case 'completed':
          return dir * (a.completedCount - b.completedCount)
        case 'created_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        default:
          return dir * (a.submissionCount - b.submissionCount)
      }
    })

    return result
  }, [enrichedUsers, userSearch, userStatusFilter, userRoleFilter, userSort])

  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE))
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const paginatedTasks = filteredTasks.slice((taskPage - 1) * PAGE_SIZE, taskPage * PAGE_SIZE)
  const paginatedUsers = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE)

  const selectedTaskParticipants = useMemo(() => {
    if (!selectedTask) return []
    return (submissionsByTask.get(selectedTask.id) || []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [selectedTask, submissionsByTask])

  const handleExportTasks = () => {
    exportCsv(
      ['Título', 'Categoria', 'Status', 'Participantes', 'Inscrições', 'Concluídas', 'Pendentes', 'Criada em'],
      filteredTasks.map((task) => [
        task.title,
        CATEGORY_LABELS[task.category] || task.category,
        TASK_STATUS_LABELS[task.status] || task.status,
        task.current_participants ?? 0,
        task.submissionCount,
        task.completedCount,
        task.pendingCount,
        formatShortDate(task.created_at),
      ]),
      `monitoramento-tarefas-${format(new Date(), 'yyyy-MM-dd')}.csv`
    )
  }

  const handleExportUsers = () => {
    exportCsv(
      ['Nome', 'Email', 'Função', 'Status', 'Inscrições', 'Concluídas', 'Pendentes', 'Categoria', 'Criado em'],
      filteredUsers.map((user) => [
        user.full_name || user.display_name,
        user.email,
        user.role === 'admin' ? 'Admin' : 'Usuário',
        user.is_active === false ? 'Inativo' : 'Ativo',
        user.submissionCount,
        user.completedCount,
        user.pendingCount,
        USER_CATEGORY_LABELS[user.current_category] || user.current_category,
        formatShortDate(user.created_at),
      ]),
      `monitoramento-usuarios-${format(new Date(), 'yyyy-MM-dd')}.csv`
    )
  }

  if (profile?.role !== 'admin') {
    return (
      <AdminAccessDenied
        icon={Shield}
        message="Apenas administradores podem acessar o painel de monitoramento."
      />
    )
  }

  const tabs = [
    { id: 'tasks', label: 'Por Tarefas', icon: Target },
    { id: 'users', label: 'Por Usuários', icon: Users },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>

      {/* Header fixo */}
      <PageHeader>
        <PageHeaderLabel icon={Activity}>Painel de Monitoramento</PageHeaderLabel>
      </PageHeader>

      <div className="px-4 sm:px-6 md:px-8 pt-4 md:pt-7 pb-8 md:pb-10 max-w-7xl mx-auto w-full min-w-0 space-y-5 md:space-y-8">

        {/* Hero */}
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none" style={{ ...pageTitleStyle }}>
            Monitoramento
          </h1>
          <p className="text-sm mt-1.5 md:mt-2 leading-relaxed" style={pageSubtitleStyle}>
            Visão completa de tarefas, inscrições e participação dos usuários no sistema.
          </p>
        </div>

        {/* Stats principais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {[
            { label: 'Usuários', value: overview.totalUsers, color: textColor },
            { label: 'Ecoantes ativos', value: overview.activeUsers, color: C.lime },
            { label: 'Tarefas', value: overview.totalTasks, color: textColor },
            { label: 'Tarefas ativas', value: overview.activeTasks, color: C.cyan },
            { label: 'Inscrições', value: overview.totalSubmissions, color: C.orange },
            { label: 'Concluídas', value: overview.completedSubmissions, color: C.lime },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: surfaceBg, border: `1px solid ${cardBorder}` }}>
              <div style={{ fontSize: 11, color: mutedColor, marginBottom: 6 }}>{label}</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-black leading-none tracking-tight" style={{ ...heading, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl" style={{ backgroundColor: isLight ? C.card : 'rgba(var(--ink),0.02)', border: `1px solid ${borderColor}` }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} style={{ color: C.lime }} />
              <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: textColor }}>Tarefas mais populares</span>
            </div>
            {overview.taskPopularity.length === 0 ? (
              <p style={{ fontSize: 13, color: faintColor }}>Nenhuma inscrição registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {overview.taskPopularity.map(({ task, count }, i) => (
                  <div key={task.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span style={{ ...heading, fontSize: 12, fontWeight: 800, color: isLight ? T.textFaint : `${C.cream}30`, width: 16 }}>{i + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{task.title}</p>
                        <p style={{ fontSize: 11, color: faintColor }}>{CATEGORY_LABELS[task.category] || task.category}</p>
                      </div>
                    </div>
                    <span style={{ ...heading, fontSize: 14, fontWeight: 800, color: isLight ? C.darkGreen : C.lime, flexShrink: 0 }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl" style={{ backgroundColor: isLight ? C.card : 'rgba(var(--ink),0.02)', border: `1px solid ${borderColor}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} style={{ color: C.orange }} />
              <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: textColor }}>Usuários mais ativos</span>
            </div>
            {overview.userActivity.length === 0 ? (
              <p style={{ fontSize: 13, color: faintColor }}>Nenhuma participação registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {overview.userActivity.map(({ user, count, completed }, i) => (
                  <div key={user.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span style={{ ...heading, fontSize: 12, fontWeight: 800, color: isLight ? T.textFaint : `${C.cream}30`, width: 16 }}>{i + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: textColor }}>
                          {user.full_name || user.display_name || 'Sem nome'}
                        </p>
                        <p style={{ fontSize: 11, color: faintColor }}>{completed} concluída(s)</p>
                      </div>
                    </div>
                    <span style={{ ...heading, fontSize: 14, fontWeight: 800, color: C.orange, flexShrink: 0 }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <AdminTabButton
              key={id}
              type="button"
              active={activeTab === id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full"
            >
              <Icon size={14} />
              {label}
            </AdminTabButton>
          ))}
        </div>

        {/* Tab: Por Tarefas */}
        {activeTab === 'tasks' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? C.card : 'rgba(var(--ink),0.02)', border: `1px solid ${borderColor}` }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-4"
              style={{ borderBottom: `1px solid ${borderColor}` }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
                <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>Tarefas</span>
                <span style={{ fontSize: 12, color: faintColor }}>{filteredTasks.length} exibida(s)</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:min-w-[200px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: faintColor }} />
                  <input
                    className={`${aInputCls} ${isLight ? 'placeholder:text-[#8A8A88]' : ''}`}
                    style={{ ...inputStyle, paddingLeft: 34 }}
                    value={taskSearch}
                    onChange={(e) => { setTaskSearch(e.target.value); setTaskPage(1) }}
                    placeholder="Buscar tarefa..."
                  />
                </div>
                <select
                  className={aInputCls}
                  style={{ ...selectStyle, minWidth: 140 }}
                  value={taskCategoryFilter}
                  onChange={(e) => { setTaskCategoryFilter(e.target.value); setTaskPage(1) }}
                >
                  <option value="all" style={optionStyle}>Todas categorias</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value} style={optionStyle}>{label}</option>
                  ))}
                </select>
                <select
                  className={aInputCls}
                  style={{ ...selectStyle, minWidth: 120 }}
                  value={taskStatusFilter}
                  onChange={(e) => { setTaskStatusFilter(e.target.value); setTaskPage(1) }}
                >
                  <option value="all" style={optionStyle}>Todos status</option>
                  {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value} style={optionStyle}>{label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleExportTasks}
                  className="h-10 px-4 rounded-xl flex items-center gap-2 transition-all hover:brightness-110 shrink-0"
                  style={{ border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`, color: isLight ? T.textSub : `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                >
                  <Download size={13} /> Exportar
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-16 text-center" style={{ color: mutedColor }}>Carregando dados...</div>
            ) : paginatedTasks.length === 0 ? (
              <AdminEmptyState icon={Target} title="Nenhuma tarefa encontrada." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.06)'}` }}>
                        <th className="text-left px-5 py-3">
                          <SortButton label="TAREFA" field="title" sortField={taskSort.field} sortDir={taskSort.dir} onSort={handleTaskSort} />
                        </th>
                        <th className="text-left px-5 py-3">
                          <SortButton label="CATEGORIA" field="category" sortField={taskSort.field} sortDir={taskSort.dir} onSort={handleTaskSort} />
                        </th>
                        <th className="text-left px-5 py-3" style={{ fontSize: 10, fontWeight: 700, color: faintColor, letterSpacing: '0.08em' }}>STATUS</th>
                        <th className="text-left px-5 py-3">
                          <SortButton label="VAGAS" field="participants" sortField={taskSort.field} sortDir={taskSort.dir} onSort={handleTaskSort} />
                        </th>
                        <th className="text-left px-5 py-3">
                          <SortButton label="INSCRIÇÕES" field="submissions" sortField={taskSort.field} sortDir={taskSort.dir} onSort={handleTaskSort} />
                        </th>
                        <th className="text-left px-5 py-3" style={{ fontSize: 10, fontWeight: 700, color: faintColor, letterSpacing: '0.08em' }}>CONCLUÍDAS</th>
                        <th className="text-left px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTasks.map((task, i) => (
                        <tr
                          key={task.id}
                          style={{
                            backgroundColor: i % 2 === 0 ? 'transparent' : (isLight ? T.itemBg : 'rgba(var(--ink),0.015)'),
                            borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.04)'}`,
                          }}
                        >
                          <td className="px-5 py-3">
                            <p style={{ fontWeight: 600, color: textColor, fontSize: 13 }} className="max-w-[240px] truncate">{task.title}</p>
                            <p style={{ fontSize: 11, color: faintColor }}>{formatShortDate(task.created_at)}</p>
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${C.lime}12`, color: isLight ? C.darkGreen : C.lime }}>
                              {CATEGORY_LABELS[task.category] || task.category}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{
                              backgroundColor: task.status === 'active' ? `${C.lime}18` : (isLight ? T.itemBg : 'rgba(var(--ink),0.08)'),
                              color: task.status === 'active' ? (isLight ? C.darkGreen : C.lime) : mutedColor,
                            }}>
                              {TASK_STATUS_LABELS[task.status] || task.status}
                            </span>
                          </td>
                          <td className="px-5 py-3" style={{ color: isLight ? T.textSub : `${C.cream}70`, fontSize: 13 }}>
                            {task.current_participants ?? 0}
                            {task.max_participants != null ? ` / ${task.max_participants}` : ''}
                          </td>
                          <td className="px-5 py-3" style={{ ...heading, fontWeight: 800, color: C.orange, fontSize: 14 }}>{task.submissionCount}</td>
                          <td className="px-5 py-3" style={{ ...heading, fontWeight: 800, color: isLight ? C.darkGreen : C.lime, fontSize: 14 }}>{task.completedCount}</td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedTask(task)}
                              className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                              style={{ border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`, backgroundColor: 'transparent', color: isLight ? T.textSub : `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                            >
                              <Eye size={12} /> Detalhes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={taskPage} totalPages={taskTotalPages} onPageChange={setTaskPage} />
              </>
            )}
          </div>
        )}

        {/* Tab: Por Usuários */}
        {activeTab === 'users' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: isLight ? C.card : 'rgba(var(--ink),0.02)', border: `1px solid ${borderColor}` }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-4"
              style={{ borderBottom: `1px solid ${borderColor}` }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.orange }} />
                <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: textColor }}>Usuários</span>
                <span style={{ fontSize: 12, color: faintColor }}>{filteredUsers.length} exibido(s)</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:min-w-[200px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: faintColor }} />
                  <input
                    className={`${aInputCls} ${isLight ? 'placeholder:text-[#8A8A88]' : ''}`}
                    style={{ ...inputStyle, paddingLeft: 34 }}
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1) }}
                    placeholder="Buscar usuário..."
                  />
                </div>
                <select
                  className={aInputCls}
                  style={{ ...selectStyle, minWidth: 120 }}
                  value={userStatusFilter}
                  onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1) }}
                >
                  <option value="all" style={optionStyle}>Todos status</option>
                  <option value="active" style={optionStyle}>Ativos</option>
                  <option value="inactive" style={optionStyle}>Inativos</option>
                </select>
                <select
                  className={aInputCls}
                  style={{ ...selectStyle, minWidth: 120 }}
                  value={userRoleFilter}
                  onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1) }}
                >
                  <option value="all" style={optionStyle}>Todas funções</option>
                  <option value="user" style={optionStyle}>Usuários</option>
                  <option value="admin" style={optionStyle}>Admins</option>
                </select>
                <button
                  type="button"
                  onClick={handleExportUsers}
                  className="h-10 px-4 rounded-xl flex items-center gap-2 transition-all hover:brightness-110 shrink-0"
                  style={{ border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`, color: isLight ? T.textSub : `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                >
                  <Download size={13} /> Exportar
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-16 text-center" style={{ color: mutedColor }}>Carregando dados...</div>
            ) : paginatedUsers.length === 0 ? (
              <AdminEmptyState icon={Users} title="Nenhum usuário encontrado." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.06)'}` }}>
                        <th className="text-left px-5 py-3">
                          <SortButton label="USUÁRIO" field="name" sortField={userSort.field} sortDir={userSort.dir} onSort={handleUserSort} />
                        </th>
                        <th className="text-left px-5 py-3" style={{ fontSize: 10, fontWeight: 700, color: faintColor, letterSpacing: '0.08em' }}>STATUS</th>
                        <th className="text-left px-5 py-3">
                          <SortButton label="INSCRIÇÕES" field="submissions" sortField={userSort.field} sortDir={userSort.dir} onSort={handleUserSort} />
                        </th>
                        <th className="text-left px-5 py-3">
                          <SortButton label="CONCLUÍDAS" field="completed" sortField={userSort.field} sortDir={userSort.dir} onSort={handleUserSort} />
                        </th>
                        <th className="text-left px-5 py-3" style={{ fontSize: 10, fontWeight: 700, color: faintColor, letterSpacing: '0.08em' }}>PENDENTES</th>
                        <th className="text-left px-5 py-3" style={{ fontSize: 10, fontWeight: 700, color: faintColor, letterSpacing: '0.08em' }}>CATEGORIA</th>
                        <th className="text-left px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((user, i) => (
                        <tr
                          key={user.id}
                          style={{
                            backgroundColor: i % 2 === 0 ? 'transparent' : (isLight ? T.itemBg : 'rgba(var(--ink),0.015)'),
                            borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.04)'}`,
                          }}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                                style={{ backgroundColor: C.orange, color: C.cream }}>
                                {(user.full_name || user.display_name || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p style={{ fontWeight: 600, color: textColor, fontSize: 13 }}>
                                  {user.full_name || user.display_name || 'Sem nome'}
                                </p>
                                <p style={{ fontSize: 11, color: faintColor }}>{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{
                              backgroundColor: user.is_active === false ? 'rgba(248,113,113,0.12)' : `${C.lime}18`,
                              color: user.is_active === false ? '#f87171' : (isLight ? C.darkGreen : C.lime),
                            }}>
                              {user.is_active === false ? 'Inativo' : 'Ativo'}
                            </span>
                          </td>
                          <td className="px-5 py-3" style={{ ...heading, fontWeight: 800, color: C.orange, fontSize: 14 }}>{user.submissionCount}</td>
                          <td className="px-5 py-3" style={{ ...heading, fontWeight: 800, color: isLight ? C.darkGreen : C.lime, fontSize: 14 }}>{user.completedCount}</td>
                          <td className="px-5 py-3" style={{ ...heading, fontWeight: 800, color: C.purple, fontSize: 14 }}>{user.pendingCount}</td>
                          <td className="px-5 py-3" style={{ color: subColor, fontSize: 12 }}>
                            {USER_CATEGORY_LABELS[user.current_category] || user.current_category || '—'}
                          </td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(user)}
                              className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                              style={{ border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`, backgroundColor: 'transparent', color: isLight ? T.textSub : `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                            >
                              <Eye size={12} /> Detalhes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={userPage} totalPages={userTotalPages} onPageChange={setUserPage} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal: Detalhes da Tarefa */}
      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-3xl p-0 border-0 bg-transparent overflow-hidden shadow-none max-h-[90vh]">
          <DialogTitle className="sr-only">Detalhes da Tarefa</DialogTitle>
          {selectedTask && (
            <div className="w-full rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ backgroundColor: modalBg, border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.1)'}` }}>
              <div className="flex items-center gap-3 px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
                <Target size={15} style={{ color: C.lime }} />
                <div className="min-w-0">
                  <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: textColor }} className="block truncate">{selectedTask.title}</span>
                  <span style={{ fontSize: 12, color: mutedColor }}>{CATEGORY_LABELS[selectedTask.category] || selectedTask.category}</span>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Info da tarefa */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Status', value: TASK_STATUS_LABELS[selectedTask.status] || selectedTask.status },
                    { label: 'Pontos', value: selectedTask.points ?? '—' },
                    { label: 'Vagas', value: `${selectedTask.current_participants ?? 0}${selectedTask.max_participants != null ? ` / ${selectedTask.max_participants}` : ''}` },
                    { label: 'Valor', value: selectedTask.offered_value != null ? `R$ ${Number(selectedTask.offered_value).toFixed(2)}` : '—' },
                    { label: 'Criada em', value: formatShortDate(selectedTask.created_at) },
                    { label: 'Expira em', value: formatShortDate(selectedTask.expires_at) },
                    { label: 'Prazo prova', value: formatShortDate(selectedTask.delivery_deadline || selectedTask.posting_deadline) },
                    { label: 'Inscrições', value: selectedTaskParticipants.length },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <div style={{ fontSize: 10, color: faintColor, marginBottom: 4, fontWeight: 700, letterSpacing: '0.05em' }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{value}</div>
                    </div>
                  ))}
                </div>

                {selectedTask.description && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: mutedColor, marginBottom: 8, letterSpacing: '0.05em' }}>DESCRIÇÃO</p>
                    <p style={{ fontSize: 13, color: isLight ? T.textSub : `${C.cream}80`, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedTask.description}</p>
                  </div>
                )}

                {/* Inscritos */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ClipboardList size={14} style={{ color: C.lime }} />
                    <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: textColor }}>
                      Inscritos ({selectedTaskParticipants.length})
                    </span>
                  </div>

                  {selectedTaskParticipants.length === 0 ? (
                    <p style={{ fontSize: 13, color: faintColor }}>Nenhum usuário inscrito nesta tarefa.</p>
                  ) : (
                    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: surfaceBgAlt, borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.06)'}` }}>
                            {['Usuário', 'Instagram', 'Seguidores', 'Status', 'Inscrição'].map((h) => (
                              <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 10, fontWeight: 700, color: faintColor, letterSpacing: '0.06em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTaskParticipants.map((sub, i) => (
                            <tr key={sub.id} style={{ borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.04)'}`, backgroundColor: i % 2 === 0 ? 'transparent' : (isLight ? T.itemBg : 'rgba(var(--ink),0.015)') }}>
                              <td className="px-4 py-2.5">
                                <p style={{ fontSize: 13, fontWeight: 600, color: textColor }}>
                                  {sub.profile?.display_name || sub.profile?.full_name || '—'}
                                </p>
                                <p style={{ fontSize: 11, color: faintColor }}>{sub.profile?.email}</p>
                              </td>
                              <td className="px-4 py-2.5" style={{ fontSize: 12, color: subColor }}>
                                {sub.profile?.instagram_handle ? `@${sub.profile.instagram_handle.replace('@', '')}` : '—'}
                              </td>
                              <td className="px-4 py-2.5" style={{ fontSize: 12, color: subColor }}>
                                {sub.profile?.followers_count ?? '—'}
                              </td>
                              <td className="px-4 py-2.5"><StatusBadge status={sub.status} /></td>
                              <td className="px-4 py-2.5" style={{ fontSize: 11, color: faintColor }}>{formatDate(sub.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes do Usuário */}
      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-3xl p-0 border-0 bg-transparent overflow-hidden shadow-none max-h-[90vh]">
          <DialogTitle className="sr-only">Detalhes do Usuário</DialogTitle>
          {selectedUser && (
            <div className="w-full rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ backgroundColor: modalBg, border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.1)'}` }}>
              <div className="flex items-center gap-3 px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${borderColor}` }}>
                <UserRound size={15} style={{ color: C.orange }} />
                <div className="min-w-0">
                  <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: textColor }} className="block truncate">
                    {selectedUser.full_name || selectedUser.display_name || 'Sem nome'}
                  </span>
                  <span style={{ fontSize: 12, color: mutedColor }}>{selectedUser.email}</span>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Métricas do usuário */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total inscrições', value: selectedUser.submissionCount, icon: ClipboardList, color: C.orange },
                    { label: 'Concluídas', value: selectedUser.completedCount, icon: CheckCircle, color: isLight ? C.darkGreen : C.lime },
                    { label: 'Pendentes', value: selectedUser.pendingCount, icon: Clock, color: C.purple },
                    { label: 'Rejeitadas', value: selectedUser.rejectedCount, icon: XCircle, color: '#f87171' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="p-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon size={12} style={{ color }} />
                        <span style={{ fontSize: 10, color: faintColor, fontWeight: 700, letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
                      </div>
                      <div style={{ ...heading, fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Perfil */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Função', value: selectedUser.role === 'admin' ? 'Admin' : 'Usuário' },
                    { label: 'Status', value: selectedUser.is_active === false ? 'Inativo' : 'Ativo' },
                    { label: 'Instagram', value: selectedUser.instagram_handle ? `@${selectedUser.instagram_handle.replace('@', '')}` : '—' },
                    { label: 'Seguidores', value: selectedUser.followers_count ?? '—' },
                    { label: 'Trimestre', value: selectedUser.current_quarter || '—' },
                    { label: 'Membro desde', value: formatShortDate(selectedUser.created_at) },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-xl" style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}` }}>
                      <div style={{ fontSize: 10, color: faintColor, marginBottom: 4, fontWeight: 700, letterSpacing: '0.05em' }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Histórico de participação */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ClipboardList size={14} style={{ color: C.orange }} />
                    <span style={{ ...heading, fontSize: 14, fontWeight: 700, color: textColor }}>
                      Histórico de participação ({selectedUser.submissions?.length || 0})
                    </span>
                  </div>

                  {!selectedUser.submissions?.length ? (
                    <p style={{ fontSize: 13, color: faintColor }}>Este usuário ainda não participou de nenhuma tarefa.</p>
                  ) : (
                    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: surfaceBgAlt, borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.06)'}` }}>
                            {['Tarefa', 'Categoria', 'Status', 'Pontos', 'Inscrição', 'Atualização'].map((h) => (
                              <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 10, fontWeight: 700, color: faintColor, letterSpacing: '0.06em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUser.submissions.map((sub, i) => (
                            <tr key={sub.id} style={{ borderBottom: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.04)'}`, backgroundColor: i % 2 === 0 ? 'transparent' : (isLight ? T.itemBg : 'rgba(var(--ink),0.015)') }}>
                              <td className="px-4 py-2.5">
                                <p style={{ fontSize: 13, fontWeight: 600, color: textColor }} className="max-w-[180px] truncate">
                                  {sub.task?.title || '—'}
                                </p>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${C.lime}12`, color: isLight ? C.darkGreen : C.lime }}>
                                  {CATEGORY_LABELS[sub.task?.category] || sub.task?.category || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5"><StatusBadge status={sub.status} /></td>
                              <td className="px-4 py-2.5" style={{ fontSize: 12, color: subColor }}>
                                {sub.task?.category === 'campanha'
                                  ? '—'
                                  : (sub.points_awarded > 0 ? sub.points_awarded : (sub.task?.points ?? '—'))}
                              </td>
                              <td className="px-4 py-2.5" style={{ fontSize: 11, color: faintColor }}>{formatDate(sub.created_at)}</td>
                              <td className="px-4 py-2.5" style={{ fontSize: 11, color: faintColor }}>{formatDate(sub.validated_at || sub.updated_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
