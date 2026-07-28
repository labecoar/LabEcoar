/** Bloqueia e-mails de nova campanha ao rodar npm run dev (mesmo banco de prod).
 *  Marca launch_email_sent=true no INSERT para bloquear webhooks/cron do Supabase. */
export const isDevCampaignEmailDisabled = () =>
  import.meta.env.DEV && import.meta.env.VITE_DEV_DISABLE_CAMPAIGN_EMAIL === 'true'
