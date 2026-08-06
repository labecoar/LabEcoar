export const isCampaignTask = (task) =>
  String(task?.category || '').trim().toLowerCase() === 'campanha'

export const isQuickResponseCampaign = (task) =>
  isCampaignTask(task)
  && String(task?.campaign_type || '').trim().toLowerCase() === 'resposta_rapida'

export const requiresScriptApproval = (task) =>
  isCampaignTask(task) && !isQuickResponseCampaign(task)

export const getTaskDisplayCategory = (task) =>
  isQuickResponseCampaign(task) ? 'resposta_rapida' : task?.category
