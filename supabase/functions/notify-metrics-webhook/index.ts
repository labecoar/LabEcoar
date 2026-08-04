import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@^2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const N8N_WEBHOOK_URL = Deno.env.get('N8N_METRICS_WEBHOOK_URL')
const N8N_WEBHOOK_HEADER = Deno.env.get('N8N_METRICS_WEBHOOK_HEADER') || 'api-key'
const N8N_WEBHOOK_KEY = Deno.env.get('N8N_METRICS_WEBHOOK_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

type MetricsWebhookPayload = {
  id_metrica?: string | null
}

const resolveTipoEnvio = (contentFormats: string[] | null | undefined) => {
  const format = String(contentFormats?.[0] || '').trim().toLowerCase()
  if (format.includes('reel')) return 'reel'
  return 'postagem'
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  try {
    if (!N8N_WEBHOOK_URL || !N8N_WEBHOOK_KEY) {
      console.error('N8N webhook secrets not configured')
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

    const payload = await req.json() as MetricsWebhookPayload
    const metricsSubmissionId = String(payload?.id_metrica || '').trim()
    if (!metricsSubmissionId) {
      return jsonResponse({ error: 'id_metrica_required' }, 400)
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured')
      return jsonResponse({ error: 'server_misconfigured' }, 500)
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: metricsSubmission, error: metricsError } = await adminClient
      .from('metrics_submissions')
      .select('id, user_id, task_id, metrics_file_url, metrics_file_urls')
      .eq('id', metricsSubmissionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (metricsError) throw metricsError
    if (!metricsSubmission) {
      return jsonResponse({ error: 'metrics_submission_not_found' }, 404)
    }

    const { data: task, error: taskError } = await adminClient
      .from('tasks')
      .select(`
        id,
        category,
        content_formats,
        organization_id,
        organization:organizations (
          name
        )
      `)
      .eq('id', metricsSubmission.task_id)
      .maybeSingle()

    if (taskError) throw taskError
    if (!task || task.category !== 'campanha') {
      return jsonResponse({ error: 'invalid_task' }, 400)
    }

    const { data: proofSubmission, error: proofError } = await adminClient
      .from('submissions')
      .select('proof_url')
      .eq('user_id', user.id)
      .eq('task_id', task.id)
      .eq('status', 'approved')
      .maybeSingle()

    if (proofError) throw proofError

    const tipoEnvio = resolveTipoEnvio(task.content_formats)
    const fileUrlsFromArray = Array.isArray(metricsSubmission.metrics_file_urls)
      ? metricsSubmission.metrics_file_urls.filter(Boolean)
      : []
    const arquivosMetrica = fileUrlsFromArray.length > 0
      ? fileUrlsFromArray
      : (metricsSubmission.metrics_file_url ? [metricsSubmission.metrics_file_url] : [])

    const n8nPayload = {
      user_id: user.id,
      campaign_id: task.id,
      id_metrica: metricsSubmission.id,
      tipo_envio: tipoEnvio,
      link_postagem: tipoEnvio === 'postagem' ? (proofSubmission?.proof_url || null) : null,
      arquivos_metrica: arquivosMetrica,
      org: task.organization?.name || null,
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
      console.error('n8n webhook error:', n8nResponse.status, n8nBody)
      return jsonResponse({
        error: 'n8n_request_failed',
        status: n8nResponse.status,
        details: n8nBody,
      }, 502)
    }

    return jsonResponse({ ok: true, payload: n8nPayload })
  } catch (err) {
    console.error('notify-metrics-webhook error:', err)
    return jsonResponse({ error: 'internal_error' }, 500)
  }
})
