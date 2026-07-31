export function isRichTextDescription(text) {
  const value = String(text || '').trim()
  if (!value) return false
  return /^<[a-z][\s\S]*>/i.test(value)
}

export function getDescriptionPlainText(text) {
  const value = String(text || '')

  if (isRichTextDescription(value)) {
    return value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return value.trim()
}

export function stripFormattingForPreview(text) {
  const plain = getDescriptionPlainText(text)
  return plain
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
}

export const TASK_DESCRIPTION_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'span'],
  ALLOWED_ATTR: ['style', 'class'],
}

export function normalizeRichDescriptionHtml(html) {
  const value = String(html || '').trim()
  if (!value || typeof document === 'undefined') return value

  const template = document.createElement('template')
  template.innerHTML = value

  template.content.querySelectorAll('*').forEach((node) => {
    node.removeAttribute('class')
  })

  return template.innerHTML
}
