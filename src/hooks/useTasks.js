import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksService } from '@/services/tasks.service'

/**
 * Hook para listar tarefas ativas
 */
export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksService.getActiveTasks(),
  })
}

/**
 * Hook para buscar tarefa específica
 */
export function useTask(taskId) {
  return useQuery({
    queryKey: ['tasks', taskId],
    queryFn: () => tasksService.getTaskById(taskId),
    enabled: !!taskId,
  })
}

/**
 * Hook para criar tarefa
 */
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskData) => tasksService.createTask(taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

/**
 * Hook para atualizar tarefa
 */
export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, updates }) => tasksService.updateTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

/**
 * Hook para deletar tarefa
 */
export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId) => tasksService.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
