import { useState } from 'react'
import cepService from '@/services/cep.service'
import { notifyError } from '@/lib/toast'

export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false)

  const searchCep = async (cep) => {
    if (!cep) return null

    setIsLoading(true)
    try {
      const data = await cepService.getCepData(cep)
      setIsLoading(false)
      return data
    } catch (error) {
      setIsLoading(false)
      notifyError(error.message)
      return null
    }
  }

  return { searchCep, isLoading }
}
