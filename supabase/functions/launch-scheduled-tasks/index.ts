const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const FROM_EMAIL = 'Cuica Lab <contato@cuicalab.com>'
const APP_URL = 'https://cuicalab.com'
const BATCH_SIZE = 50

const SUBJECT = 'Nova campanha no ar'
const TITLE = 'Nova campanha no ar'

type Profile = {
  email: string
  full_name?: string | null
  display_name?: string | null
  followers_count?: number | null
}

type Task = {
  id: string
  title: string
  category: string
  status: string
  launch_at?: string | null
  launch_email_sent?: boolean | null
  min_followers?: number | null
  max_participants?: number | null
  current_participants?: number | null
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY || '',
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const buildEmailHtml = (name: string, taskTitle: string) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#0f1833;padding:28px 32px;text-align:center;">
            <span style="display:inline-block;background:#ffffff;border-radius:8px;padding:8px 14px;font-size:15px;font-weight:600;color:#0f1833;letter-spacing:0.5px;">Cuica Lab</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="font-size:22px;font-weight:600;color:#0f172a;margin:0 0 4px;">${TITLE}</p>
            <p style="font-size:15px;color:#1e293b;line-height:1.7;margin:0 0 12px;">Oi, ${name}, tudo bem por aí?</p>
            <p style="font-size:15px;color:#1e293b;line-height:1.7;margin:0 0 28px;">
              Passando para avisar que a campanha <strong>"${taskTitle}"</strong> acabou de ser lançada na plataforma. Acesse o CuícaLab para conferir. <br /> A campanha está em Tarefas Disponíveis.
            </p>
            <div style="text-align:center;margin:0 0 28px;">
              <a href="${APP_URL}" style="display:inline-block;background:#0f1833;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:8px;">
                Acessar plataforma
              </a>
            </div>
            <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
              <p style="font-size:15px;color:#1e293b;line-height:1.7;margin:0 0 12px;">Não responda esse e-mail.</p>
              <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0;"> Se tiver dúvidas ou comentários, entre em contato com nossa equipe em
                  <a href="mailto:comunidade@agenciacuica.com" style="color:#185FA5;text-decoration:none;">comunidade@agenciacuica.com</a>
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
            <p style="font-size:12px;color:#94a3b8;margin:0 0 4px;">Cuica Lab</p>
            <p style="font-size:12px;margin:0;"><a href="mailto:contato@cuicalab.com" style="color:#185FA5;text-decoration:none;">contato@cuicalab.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

const isEligibleProfile = (profile: Profile, task: Task) => {
  if (!profile?.email) return false
  const minFollowers = Number(task.min_followers || 0)
  const followers = Number(profile.followers_count || 0)
  if (minFollowers > 0 && followers < minFollowers) return false
  return true
}

const isCampaignAvailable = (task: Task) => {
  if (task.category !== 'campanha') return false
  if (task.status !== 'active') return false
  const maxParticipants = Number(task.max_participants || 0)
  const currentParticipants = Number(task.current_participants || 0)
  if (maxParticipants > 0 && currentParticipants >= maxParticipants) return false
  return true
}

const isTaskLaunched = (task: Task, now = Date.now()) => {
  if (!task.launch_at) return true
  const launchAt = new Date(task.launch_at).getTime()
  if (Number.isNaN(launchAt)) return true
  return launchAt <= now
}

async function fetchEligibleProfiles(task: Task) {
  const minFollowers = Number(task.min_followers || 0)
  const params = new URLSearchParams({
    select: 'email,full_name,display_name,followers_count',
    is_active: 'eq.true',
    deleted_at: 'is.null',
    email: 'not.is.null',
  })
  if (minFollowers > 0) {
    params.set('followers_count', `gte.${minFollowers}`)
  }
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?${params.toString()}`,
    { headers: supabaseHeaders },
  )
  if (!profileRes.ok) {
    const errorText = await profileRes.text()
    throw new Error(`Failed to fetch profiles: ${errorText}`)
  }
  const profiles = await profileRes.json() as Profile[]
  return (profiles || []).filter((profile) => isEligibleProfile(profile, task))
}

async function sendCampaignEmails(task: Task) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')
  const profiles = await fetchEligibleProfiles(task)
  if (profiles.length === 0) {
    console.log('No eligible profiles for campaign email', task.id)
    return { sent: 0 }
  }
  const taskTitle = task.title || 'campanha'
  let sent = 0
  for (let index = 0; index < profiles.length; index += BATCH_SIZE) {
    const batch = profiles.slice(index, index + BATCH_SIZE)
    const payload = batch.map((profile) => {
      const name = profile.display_name || profile.full_name || 'influenciador'
      return {
        from: FROM_EMAIL,
        to: profile.email,
        subject: SUBJECT,
        html: buildEmailHtml(name, taskTitle),
      }
    })
    const resendResponse = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const resendData = await resendResponse.text()
    console.log('Resend batch status:', resendResponse.status)
    console.log('Resend batch response:', resendData)
    if (!resendResponse.ok) throw new Error(`Resend error: ${resendData}`)
    sent += batch.length
  }
  console.log(`Campaign emails sent for task ${task.id}: ${sent}`)
  return { sent }
}

async function markLaunchEmailSent(taskId: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`, {
    method: 'PATCH',
    headers: supabaseHeaders,
    body: JSON.stringify({
      launch_email_sent: true,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to mark launch email sent: ${errorText}`)
  }
}

async function fetchTasksPendingLaunchEmail() {
  console.log('fetchTasksPendingLaunchEmail started')
  const params = new URLSearchParams({
    select: 'id,title,category,status,launch_at,launch_email_sent,min_followers,max_participants,current_participants',
    status: 'eq.active',
    category: 'eq.campanha',
    launch_email_sent: 'eq.false',
  })
  const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks?${params.toString()}`, {
    headers: supabaseHeaders,
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch scheduled tasks: ${errorText}`)
  }
  const tasks = await response.json() as Task[]
  return (tasks || []).filter((task) => isTaskLaunched(task) && isCampaignAvailable(task))
}

async function processScheduledLaunches() {
  console.log('processScheduledLaunches started')
  const tasks = await fetchTasksPendingLaunchEmail()
  console.log(`Found ${tasks.length} tasks pending launch email`)
  const results = []
  for (const task of tasks) {
    try {
      const { sent } = await sendCampaignEmails(task)
      await markLaunchEmailSent(task.id)
      results.push({ taskId: task.id, sent, status: 'ok' })
    } catch (error) {
      console.error(`Failed to launch task ${task.id}:`, error)
      results.push({
        taskId: task.id,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { processed: results.length, results }
}

Deno.serve(async (req: Request) => {
  console.log('handler called', req.method)
  try {
    if (req.method !== 'POST') {
      return new Response('method not allowed', { status: 405 })
    }
    const result = await processScheduledLaunches()
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response('error', { status: 500 })
  }
})