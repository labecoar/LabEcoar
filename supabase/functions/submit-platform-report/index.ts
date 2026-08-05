import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@^2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const N8N_WEBHOOK_URL = Deno.env.get('N8N_PLATFORM_REPORT_WEBHOOK_URL')
const N8N_WEBHOOK_HEADER = Deno.env.get('N8N_PLATFORM_REPORT_WEBHOOK_HEADER') || 'api-key'
const N8N_WEBHOOK_KEY = Deno.env.get('N8N_PLATFORM_REPORT_WEBHOOK_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

const PROBLEM_TYPES = new Set([
  'Sugestão',
  'Melhor prática',
  'Bug',
  'Erro de texto',
  'Link quebrado',
  'Layout / UI',
  'Outro',
])

type PlatformReportPayload = {
  page?: string | null
  problem_type?: string | null
  blocked_task?: boolean | null
  description?: string | null
  screenshot_url?: string | null
  user_notes?: string | null
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const formatReportDate = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  try {
    if (!N8N_WEBHOOK_URL || !N8N_WEBHOOK_KEY) {
      console.error('Platform report webhook secrets not configured')
      return jsonResponse({ error: 'webhook_not_configured' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    const { data: profile } = await userClient
      .from('profiles')
      .select('email, full_name, display_name')
      .eq('id', user.id)
      .maybeSingle()

    const payload = await req.json() as PlatformReportPayload
    const page = String(payload?.page || '').trim()
    const problemType = String(payload?.problem_type || '').trim()
    const description = String(payload?.description || '').trim()
    const screenshotUrl = String(payload?.screenshot_url || '').trim()
    const userNotes = String(payload?.user_notes || '').trim()
    const blockedTask = Boolean(payload?.blocked_task)

    if (!page) {
      return jsonResponse({ error: 'page_required' }, 400)
    }

    if (!problemType || !PROBLEM_TYPES.has(problemType)) {
      return jsonResponse({ error: 'invalid_problem_type' }, 400)
    }

    if (!description || description.length < 10) {
      return jsonResponse({ error: 'description_required' }, 400)
    }

    if (description.length > 5000) {
      return jsonResponse({ error: 'description_too_long' }, 400)
    }

    if (userNotes.length > 2000) {
      return jsonResponse({ error: 'user_notes_too_long' }, 400)
    }

    const reporterName = String(
      profile?.display_name || profile?.full_name || user.email?.split('@')[0] || 'Ecoante',
    ).trim()
    const reporterEmail = String(profile?.email || user.email || '').trim()
    const now = new Date()

    const n8nPayload = {
      quem_es_tu: reporterName,
      reporter_email: reporterEmail,
      user_id: user.id,
      data: formatReportDate(now),
      pagina: page,
      tipo_problema: problemType,
      impediu_tarefa: blockedTask,
      print: screenshotUrl || '',
      descricao: description,
      obs: userNotes || '',
      status: '',
      comentarios_extra: '',
    }

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [N8N_WEBHOOK_HEADER]: N8N_WEBHOOK_KEY,
      },
      body: JSON.stringify(n8nPayload),
    })

    const n8nBody = await n8nResponse.text()

    if (!n8nResponse.ok) {
      console.error('n8n platform report webhook error:', n8nResponse.status, n8nBody)
      return jsonResponse({
        error: 'n8n_request_failed',
        status: n8nResponse.status,
        details: n8nBody,
      }, 502)
    }

    return jsonResponse({ ok: true, payload: n8nPayload })
  } catch (err) {
    console.error('submit-platform-report error:', err)
    return jsonResponse({ error: 'internal_error' }, 500)
  }
})
