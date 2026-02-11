import { supabase } from '@/lib/supabase'

/**
 * Serviço de Storage (Upload de arquivos)
 */
export const storageService = {
  /**
   * Upload de arquivo para bucket submissions
   */
  async uploadFile(file, userId) {
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
