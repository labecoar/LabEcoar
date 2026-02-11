import { useMutation } from '@tanstack/react-query'
import { storageService } from '@/services/storage.service'

/**
 * Hook para upload de arquivos
 */
export function useUploadFile() {
  return useMutation({
    mutationFn: ({ file, userId }) => storageService.uploadFile(file, userId),
  })
}

/**
 * Hook para deletar arquivo
 */
export function useDeleteFile() {
  return useMutation({
    mutationFn: (filePath) => storageService.deleteFile(filePath),
  })
}
