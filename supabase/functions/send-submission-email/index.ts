import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const FROM_EMAIL = 'Cuica Lab <contato@cuicalab.com>'
const APP_URL = 'https://cuicalab.com'

const EMAIL_TEMPLATES = {
  application_approved: {
    subject: '✅ Candidatura aprovada!',
    title: 'Candidatura aprovada!',
    message: (name, taskTitle) =>
      `Olá, ${name}! Sua candidatura para a tarefa <strong>"${taskTitle}"</strong> foi aprovada. Acesse a plataforma para enviar sua prova.`,
  },
  application_rejected: {
    subject: 'Atualização sobre sua candidatura',
    title: 'Candidatura não aprovada',
    message: (name, taskTitle) =>
      `Olá, ${name}! Infelizmente sua candidatura para a tarefa <strong>"${taskTitle}"</strong> não foi aprovada desta vez.`,
  },
  approved: {
    subject: '🎉 Prova aprovada! Pontos adicionados.',
    title: 'Prova aprovada!',
    message: (name, taskTitle, points) =>
      `Olá, ${name}! Sua prova para a tarefa <strong>"${taskTitle}"</strong> foi aprovada e <strong>${points} pontos</strong> foram adicionados ao seu saldo.`,
  },
  rejected: {
    subject: 'Atualização sobre sua prova',
    title: 'Prova não aprovada',
    message: (name, taskTitle) =>
      `Olá, ${name}! Sua prova para a tarefa <strong>"${taskTitle}"</strong> não foi aprovada. Acesse a plataforma para ver o feedback.`,
  },
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    const old_record = payload.old_record

    if (!old_record || record.status === old_record.status) {
      return new Response('no change', { status: 200 })
    }

    const template = EMAIL_TEMPLATES[record.status]
    if (!template) {
      return new Response('status not handled', { status: 200 })
    }

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${record.user_id}&select=email,full_name,display_name`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    const [profile] = await profileRes.json()
    if (!profile?.email) return new Response('no profile', { status: 200 })

    const taskRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?id=eq.${record.task_id}&select=title`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    const [task] = await taskRes.json()
    const taskTitle = task?.title || 'tarefa'

    const name = profile.display_name || profile.full_name || 'usuário'
    const points = record.points_awarded || 0
    const messageHtml = record.status === 'approved'
      ? template.message(name, taskTitle, points)
      : template.message(name, taskTitle)

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#0019FF;padding:0;text-align:center;">
            <img src="https://ynvtwsdvzaksqxuocrbh.supabase.co/storage/v1/object/public/assets/cuica_lab_email.jpeg" alt="Cuica Lab" width="520" style="display:block;width:100%;max-width:520px;" />
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="font-size:22px;font-weight:600;color:#0f172a;margin:0 0 24px;">${template.title}</p>
            <p style="font-size:15px;color:#1e293b;line-height:1.7;margin:0 0 28px;">${messageHtml}</p>
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
            <p style="font-size:16px;color:#94a3b8;margin:0 0 4px;">Cuica Lab</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

const resendResponse = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: FROM_EMAIL,
    to: profile.email,
    subject: template.subject,
    html,
  }),
})

const resendData = await resendResponse.text()

console.log('Resend status:', resendResponse.status)
console.log('Resend response:', resendData)

if (!resendResponse.ok) {
  return new Response(
    `Resend error: ${resendData}`,
    { status: 500 }
  )
}

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Error:', err)
    return new Response('error', { status: 500 })
  }
})