const CEP_API = 'https://viacep.com.br/ws'

const cepService = {
  async getCepData(cep) {
    try {
      // Remove hífens do CEP
      const cleanCep = cep.replace('-', '')

      // Valida se tem 8 dígitos
      if (!/^\d{8}$/.test(cleanCep)) {
        throw new Error('CEP deve conter 8 dígitos')
      }

      const response = await fetch(`${CEP_API}/${cleanCep}/json/`)

      if (!response.ok) {
        throw new Error('Erro ao consultar CEP')
      }

      const data = await response.json()

      // ViaCEP retorna erro com erro: true
      if (data.erro) {
        throw new Error('CEP não encontrado')
      }

      return {
        endereco: data.logradouro,
        complemento: data.complemento || '',
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
      }
    } catch (error) {
      throw new Error(error.message || 'Erro ao buscar CEP')
    }
  },
}

export default cepService
