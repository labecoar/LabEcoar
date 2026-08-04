import { supabase } from '@/lib/supabase'

export const organizationsService = {
  async list() {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, created_at, updated_at')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  },

  async create(name) {
    const trimmed = String(name || '').trim()
    if (!trimmed) throw new Error('Informe o nome da organização.')

    const { data, error } = await supabase
      .from('organizations')
      .insert([{ name: trimmed }])
      .select('id, name, created_at, updated_at')
      .single()

    if (error) {
      if (String(error.message || '').toLowerCase().includes('unique')) {
        throw new Error('Já existe uma organização com esse nome.')
      }
      throw error
    }

    return data
  },

  async update(id, name) {
    const trimmed = String(name || '').trim()
    if (!trimmed) throw new Error('Informe o nome da organização.')

    const { data, error } = await supabase
      .from('organizations')
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, created_at, updated_at')
      .single()

    if (error) {
      if (String(error.message || '').toLowerCase().includes('unique')) {
        throw new Error('Já existe uma organização com esse nome.')
      }
      throw error
    }

    return data
  },

  async remove(id) {
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', id)

    if (countError) throw countError
    if ((count || 0) > 0) {
      throw new Error('Esta organização está vinculada a tarefas. Remova o vínculo antes de excluir.')
    }

    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },
}
