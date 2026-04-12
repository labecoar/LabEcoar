import { supabase } from '@/lib/supabase'

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024

/**
 * Serviço de Storage (Upload de arquivos)
 */
export const storageService = {
  /**
   * Upload de arquivo para bucket submissions
   */
  async uploadFile(file, userId) {
    if (!file) {
      throw new Error('Arquivo nao informado para upload.')
    }

    if (Number(file.size || 0) > MAX_UPLOAD_SIZE_BYTES) {
      const maxMb = (MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)).toFixed(0)
      const currentMb = (Number(file.size || 0) / (1024 * 1024)).toFixed(2)
      throw new Error(`Arquivo muito grande. Maximo permitido: ${maxMb}MB. Arquivo enviado: ${currentMb}MB.`)
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('submissions')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('submissions')
      .getPublicUrl(data.path)

    return {
      path: data.path,
      url: publicUrl
    }
  },

  /**
   * Deletar arquivo
   */
  async deleteFile(filePath) {
    const { error } = await supabase.storage
      .from('submissions')
      .remove([filePath])

    if (error) throw error
  },

  getFilePathFromPublicUrl(publicUrl) {
    const rawValue = String(publicUrl || '').trim()
    if (!rawValue) return null

    const marker = '/storage/v1/object/public/submissions/'
    const markerIndex = rawValue.indexOf(marker)

    if (markerIndex >= 0) {
      const start = markerIndex + marker.length
      const pathWithQuery = rawValue.slice(start)
      const normalizedPath = decodeURIComponent(pathWithQuery.split('?')[0] || '').trim()
      return normalizedPath || null
    }

    const normalizedInput = rawValue.replace(/^\/+/, '')
    if (normalizedInput.startsWith('submissions/')) {
      return normalizedInput.slice('submissions/'.length) || null
    }

    if (!normalizedInput.startsWith('http://') && !normalizedInput.startsWith('https://')) {
      return normalizedInput || null
    }

    return null
  },

  async deleteByPublicUrl(publicUrl) {
    const filePath = this.getFilePathFromPublicUrl(publicUrl)
    if (!filePath) return
    await this.deleteFile(filePath)
  },

  /**
   * Obter URL pública de arquivo
   */
  getPublicUrl(filePath) {
    const { data } = supabase.storage
      .from('submissions')
      .getPublicUrl(filePath)

    return data.publicUrl
  }
}
