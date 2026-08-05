// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bug, ChevronDown, Send, XCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUploadFile } from '@/hooks/useStorage'
import { platformReportsService } from '@/services/platform-reports.service'
import { notifyError, notifySuccess } from '@/lib/toast'
import { C, heading, body } from '@/lib/theme'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

const PROBLEM_TYPES = [
  'Sugestão',
  'Melhor prática',
  'Bug',
  'Erro de texto',
  'Link quebrado',
  'Layout / UI',
  'Outro',
]

const PAGE_LABELS = {
  Dashboard: 'Dashboard',
  Tasks: 'Tarefas Disponíveis',
  MySubmissions: 'Minhas Tarefas',
  Forum: 'Fórum',
  ForumTopic: 'Fórum',
  Rewards: 'Recompensas',
  MyPayments: 'Meus Pagamentos',
  Profile: 'Perfil',
  FAQ: 'FAQ',
  AdminContentManagement: 'Gerenciar Conteúdo',
  AdminUsers: 'Usuários',
  AdminMonitoring: 'Monitoramento',
  AdminApplications: 'Seleção',
  AdminScriptApproval: 'Roteiros',
  AdminApproval: 'Aprovação',
  AdminMetrics: 'Métricas',
  AdminPayments: 'Pagamentos',
  AdminRewards: 'Recompensas (Admin)',
  AdminRewardClaims: 'Resgates de Recompensas',
  Leaderboard: 'Ranking',
}

const getPageLabel = (pathname, currentPageName) => {
  if (currentPageName && PAGE_LABELS[currentPageName]) {
    return PAGE_LABELS[currentPageName]
  }

  const cleanPath = String(pathname || '/').replace(/^\/+/, '')
  if (!cleanPath) return 'Dashboard'

  const pageKey = cleanPath.split('/')[0]
  return PAGE_LABELS[pageKey] || pageKey
}

export default function PlatformReportDialog({ currentPageName }) {
  const { user, profile } = useAuth()
  const location = useLocation()
  const uploadFile = useUploadFile()
  const fileInputRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [form, setForm] = useState({
    page: '',
    problemType: 'Sugestão',
    blockedTask: false,
    description: '',
    userNotes: '',
  })

  const defaultPage = useMemo(
    () => getPageLabel(location.pathname, currentPageName),
    [location.pathname, currentPageName],
  )

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        page: defaultPage,
      }))
    }
  }, [open, defaultPage])

  const resetForm = () => {
    setForm({
      page: defaultPage,
      problemType: 'Sugestão',
      blockedTask: false,
      description: '',
      userNotes: '',
    })
    setScreenshotFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    setOpen(false)
    resetForm()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.description.trim() || form.description.trim().length < 10) {
      notifyError('Descreva o problema com pelo menos 10 caracteres.')
      return
    }

    setIsSubmitting(true)

    try {
      let screenshotUrl = null

      if (screenshotFile) {
        const result = await uploadFile.mutateAsync({
          file: screenshotFile,
          userId: user.id,
        })
        screenshotUrl = result?.url || null
      }

      await platformReportsService.submitReport({
        page: form.page.trim(),
        problemType: form.problemType,
        blockedTask: form.blockedTask,
        description: form.description.trim(),
        screenshotUrl,
        userNotes: form.userNotes.trim() || null,
      })

      notifySuccess('Recebemos seu reporte. Obrigado pelo feedback!')
      handleClose()
    } catch (error) {
      console.error('Erro ao enviar reporte:', error)
      notifyError(error?.message || 'Não foi possível enviar o reporte. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user?.id) return null

  const reporterName = profile?.display_name || profile?.full_name || 'Ecoante'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-40 bottom-5 right-5 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:brightness-110"
        style={{
          backgroundColor: C.orange,
          color: C.cream,
          ...heading,
          fontSize: 13,
          fontWeight: 700,
        }}
        title="Reportar problema ou sugerir melhoria"
      >
        <Bug size={16} />
        Reportar
      </button>

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : handleClose())}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg p-0 border-0 bg-transparent overflow-hidden shadow-none">
          <DialogTitle className="sr-only">Reportar problema ou sugestão</DialogTitle>
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.1)` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
              <div>
                <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>Reportar / Sugerir</span>
                <p style={{ ...body, fontSize: 12, color: `${C.cream}60`, marginTop: 4 }}>
                  Enviado como {reporterName}
                </p>
              </div>
              <button type="button" onClick={handleClose} style={{ color: `${C.cream}50` }} className="hover:opacity-100 transition-opacity">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
              <div className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em' }}>
                  PÁGINA EM QUE ESTÁ O PROBLEMA
                </label>
                <input
                  className="mt-2 w-full px-4 py-3 rounded-xl outline-none"
                  style={{ backgroundColor: C.black_light, border: `1px solid rgba(var(--ink),0.1)`, color: C.cream, ...body, fontSize: 14 }}
                  value={form.page}
                  onChange={(e) => setForm({ ...form, page: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em' }}>
                  TIPO DE PROBLEMA
                </label>
                <div className="relative mt-2">
                  <select
                    className="w-full px-4 py-3 rounded-xl outline-none appearance-none pr-10"
                    style={{ backgroundColor: C.black_light, border: `1px solid rgba(var(--ink),0.1)`, color: C.cream, ...body, fontSize: 14 }}
                    value={form.problemType}
                    onChange={(e) => setForm({ ...form, problemType: e.target.value })}
                  >
                    {PROBLEM_TYPES.map((type) => (
                      <option key={type} value={type} style={{ backgroundColor: C.card, color: C.cream }}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${C.cream}50` }} />
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.blockedTask}
                  onChange={(e) => setForm({ ...form, blockedTask: e.target.checked })}
                  className="mt-1"
                />
                <span style={{ ...body, fontSize: 13, color: C.cream }}>
                  Isso me impediu de realizar uma tarefa
                </span>
              </label>

              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em' }}>
                  DESCRIÇÃO DO PROBLEMA
                </label>
                <textarea
                  className="mt-2 w-full px-4 py-3 rounded-xl outline-none resize-none"
                  rows={4}
                  style={{ backgroundColor: C.black_light, border: `1px solid rgba(var(--ink),0.1)`, color: C.cream, ...body, fontSize: 14 }}
                  placeholder="Descreva o que aconteceu ou o que você sugere..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em' }}>
                  PRINT (OPCIONAL)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-sm"
                  style={{ color: `${C.cream}80` }}
                  onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                />
                {screenshotFile && (
                  <p style={{ ...body, fontSize: 12, color: `${C.cream}60`, marginTop: 6 }}>
                    Arquivo selecionado: {screenshotFile.name}
                  </p>
                )}
              </div>

              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em' }}>
                  OBS (OPCIONAL)
                </label>
                <textarea
                  className="mt-2 w-full px-4 py-3 rounded-xl outline-none resize-none"
                  rows={2}
                  style={{ backgroundColor: C.black_light, border: `1px solid rgba(var(--ink),0.1)`, color: C.cream, ...body, fontSize: 14 }}
                  placeholder="Alguma observação extra..."
                  value={form.userNotes}
                  onChange={(e) => setForm({ ...form, userNotes: e.target.value })}
                />
              </div>

              </div>

              <div
                className="px-6 pb-6 pt-4 shrink-0"
                style={{ borderTop: `1px solid rgba(var(--ink),0.07)` }}
              >
              <button
                type="submit"
                disabled={isSubmitting || uploadFile.isPending}
                className="flex items-center justify-center gap-3 w-full h-10 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 16 }}
              >
                <Send size={16} strokeWidth={2.25} />
                {isSubmitting || uploadFile.isPending ? 'Enviando...' : 'Enviar reporte'}
              </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
