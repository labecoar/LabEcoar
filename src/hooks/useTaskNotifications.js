import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { tasksService } from '@/services/tasks.service'
import { submissionsService } from '@/services/submissions.service'
import { metricsService } from '@/services/metrics.service'
import { buildTaskNotifications } from '@/lib/task-notifications'
import { notificationsService } from '@/services/notifications.service'

const STORAGE_PREFIX = 'labecoar-task-notifications-seen'

const readSeenIds = (storageKey) => {
  if (typeof window === 'undefined' || !storageKey) return []

  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []
  } catch {
    return []
  }
}

const writeSeenIds = (storageKey, ids) => {
  if (typeof window === 'undefined' || !storageKey) return
  window.localStorage.setItem(storageKey, JSON.stringify(ids))
}

export function useTaskNotifications() {
  const { user, profile } = useAuth()
  const storageKey = useMemo(() => (user?.id ? `${STORAGE_PREFIX}:${user.id}` : null), [user?.id])
  const [seenIds, setSeenIds] = useState([])
  const [loadingSeen, setLoadingSeen] = useState(false)

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => tasksService.getAllTasks(),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  })

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['submissions', 'user', user?.id],
    queryFn: () => submissionsService.getUserSubmissions(user.id),
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  })

  const { data: metricsSubmissions = [], isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics-submissions', 'user', user?.id],
    queryFn: () => metricsService.getUserMetricsSubmissions(user.id),
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!storageKey) return
      // If user is logged in, read from DB; otherwise fallback to localStorage
      if (user?.id) {
        try {
          setLoadingSeen(true)
          const ids = await notificationsService.getSeenNotificationIds(user.id)
          if (!mounted) return
          setSeenIds(Array.isArray(ids) ? ids : [])
        } catch (err) {
          console.error('Erro ao carregar notificações lidas do DB:', err)
          setSeenIds(readSeenIds(storageKey))
        } finally {
          setLoadingSeen(false)
        }
      } else {
        setSeenIds(readSeenIds(storageKey))
      }
    }

    load()
    return () => { mounted = false }
  }, [storageKey, user?.id])

  const notifications = useMemo(
    () => buildTaskNotifications({ tasks, submissions, metricsSubmissions, profile }),
    [metricsSubmissions, profile, submissions, tasks]
  )

  useEffect(() => {
    if (!storageKey) return

    const validIds = new Set(notifications.map((notification) => notification.id))
    setSeenIds((current) => {
      const next = current.filter((id) => validIds.has(id))
      writeSeenIds(storageKey, next)
      return next
    })
  }, [notifications, storageKey])

  const unreadCount = useMemo(() => {
    const seenSet = new Set(seenIds)
    return notifications.reduce((count, notification) => count + (seenSet.has(notification.id) ? 0 : 1), 0)
  }, [notifications, seenIds])

  const markAsRead = (notificationId) => {
    if (!notificationId) return
    setSeenIds((current) => {
      if (current.includes(notificationId)) return current
      const next = [...current, notificationId]
      writeSeenIds(storageKey, next)

      // persist to DB for authenticated users (fire-and-forget)
      if (user?.id) {
        notificationsService.markAsRead(user.id, notificationId).catch((err) => {
          console.error('Erro ao marcar notificação como lida no DB:', err)
        })
      }

      return next
    })
  }

  const markAllAsRead = () => {
    const next = notifications.map((notification) => notification.id)
    setSeenIds(next)
    writeSeenIds(storageKey, next)

    if (user?.id && next.length > 0) {
      notificationsService.markManyAsRead(user.id, next).catch((err) => {
        console.error('Erro ao marcar várias notificações como lidas no DB:', err)
      })
    }
  }

  return {
    notifications: notifications.map((notification) => ({
      ...notification,
      is_read: seenIds.includes(notification.id),
    })),
    unreadCount,
    markAsRead,
    markAllAsRead,
    loading: tasksLoading || submissionsLoading || metricsLoading || loadingSeen,
  }
}
