import { supabase } from '@/lib/supabase'

/**
 * Envio de reportes / sugestões da plataforma para o webhook n8n.
 */
export const platformReportsService = {
  async submitReport({
    page,
    problemType,
    blockedTask = false,
    description,
    screenshotUrl = null,
    userNotes = null,
  }) {
    const { data, error } = await supabase.functions.invoke('submit-platform-report', {
      body: {
        page,
        problem_type: problemType,
        blocked_task: blockedTask,
        description,
        screenshot_url: screenshotUrl,
        user_notes: userNotes,
      },
    })

    if (error) throw error
    if (data?.error) {
      throw new Error(data.details || data.error)
    }

    return data
  },
}
