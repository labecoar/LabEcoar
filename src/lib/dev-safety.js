/** Bloqueia e-mails de nova campanha ao rodar npm run dev (mesmo banco de prod). */
export const isDevCampaignEmailDisabled = () =>
  import.meta.env.DEV && import.meta.env.VITE_DEV_DISABLE_CAMPAIGN_EMAIL === 'true'
