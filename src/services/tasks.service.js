import { supabase } from '@/lib/supabase'

/**
 * Serviço de Tarefas
 */
export const tasksService = {
  /**
   * Listar todas as tarefas ativas
   */
  async getActiveTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Listar todas as tarefas (Admin)
   */
  async getAllTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Buscar tarefa por ID
   */
  async getTaskById(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Criar nova tarefa (Admin)
   */
  async createTask(taskData) {
    let mutablePayload = {
      ...taskData,
      status: 'active'
    }

    while (true) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([mutablePayload])
        .select()
        .single()

      if (!error) return data

      const message = String(error.message || '')

      const postgresMissingColumn = message.match(/column\s+"([^"]+)"\s+of\s+relation\s+"tasks"\s+does\s+not\s+exist/i)
      const postgrestMissingColumn = message.match(/Could not find the '([^']+)' column of 'tasks'/i)
      const missingColumn = postgresMissingColumn?.[1] || postgrestMissingColumn?.[1]

      if (missingColumn && missingColumn in mutablePayload && missingColumn !== 'id') {
        delete mutablePayload[missingColumn]
        continue
      }

      throw error
    }
  },

  /**
   * Atualizar tarefa (Admin)
   */
  async updateTask(taskId, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Deletar tarefa (Admin)
   */
  async deleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) throw error
  }
}
