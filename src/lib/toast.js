import { toast } from '@/components/ui/use-toast'

const TOAST_VARIANTS = {
  success: 'success',
  warning: 'warning',
  info: 'info',
  error: 'destructive',
}

const DEFAULT_DURATION = 4000

export function notify({ type = 'info', title, description, duration, ...props }) {
  const variant = TOAST_VARIANTS[type] || TOAST_VARIANTS.info
  return toast({
    ...props,
    title,
    description,
    variant,
    duration: duration ?? DEFAULT_DURATION,
  })
}

export const notifySuccess = (description, title = 'Sucesso', props = {}) =>
  notify({ type: 'success', title, description, ...props })

export const notifyWarning = (description, title = 'Atenção', props = {}) =>
  notify({ type: 'warning', title, description, ...props })

export const notifyInfo = (description, title = 'Informação', props = {}) =>
  notify({ type: 'info', title, description, ...props })

export const notifyError = (description, title = 'Erro', props = {}) =>
  notify({ type: 'error', title, description, ...props })
