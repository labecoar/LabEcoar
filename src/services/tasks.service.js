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
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        ...taskData,
        status: 'active'
      }])
      .select()
      .single()

    if (error) throw error
    return data
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
