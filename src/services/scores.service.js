import { supabase } from '@/lib/supabase'

export const getCurrentQuarterKey = (date = new Date()) => {
  const value = new Date(date)
  const quarter = Math.floor(value.getMonth() / 3) + 1
  return `Q${quarter}-${value.getFullYear()}`
}

const getQuarterRange = (quarterKey = getCurrentQuarterKey()) => {
  const match = String(quarterKey || '').match(/^Q([1-4])-(\d{4})$/)
  if (!match) {
    const fallback = getCurrentQuarterKey()
    return getQuarterRange(fallback)
  }

  const quarter = Number(match[1])
  const year = Number(match[2])
  const startMonth = (quarter - 1) * 3
  const endMonth = startMonth + 3

  return {
    key: quarterKey,
    start: new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, endMonth, 1, 0, 0, 0, 0)),
  }
}

const toScoreModel = (userId, quarterKey, points = 0, tasks = 0) => ({
  user_id: userId,
  quarter_key: quarterKey,
  total_points: Number(points || 0),
  tasks_completed: Number(tasks || 0),
})

export const MAX_JOURNEY_POINTS = 1500

/**
 * Serviço de Pontuação
 */
export const scoresService = {
  /**
   * Obter pontuação do usuário
   */
  async getUserScore(userId, quarterKey = getCurrentQuarterKey()) {
    if (!userId) {
      return toScoreModel(null, quarterKey, 0, 0)
    }

    // Buscar diretamente de user_scores em vez de calcular
    const { data, error } = await supabase
      .from('user_scores')
      .select('total_points, tasks_completed')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    if (data) {
      return toScoreModel(userId, quarterKey, data.total_points || 0, data.tasks_completed || 0)
    }

    // Se não existir registro, retornar 0
    return toScoreModel(userId, quarterKey, 0, 0)
  },

  /**
   * Histórico de pontuação por trimestre do usuário
   */
  async getUserScoreHistory(userId, limit = 8) {
    if (!userId) return []

    const { data, error } = await supabase
      .from('submissions')
      .select('points_awarded, validated_at')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .not('validated_at', 'is', null)
      .order('validated_at', { ascending: false })

    if (error) throw error

    const grouped = new Map()

    for (const row of data || []) {
      const key = getCurrentQuarterKey(row.validated_at)
      const current = grouped.get(key) || toScoreModel(userId, key, 0, 0)
      current.total_points += Number(row.points_awarded || 0)
      current.tasks_completed += 1
      grouped.set(key, current)
    }

    const currentQuarterKey = getCurrentQuarterKey()
    if (!grouped.has(currentQuarterKey)) {
      grouped.set(currentQuarterKey, toScoreModel(userId, currentQuarterKey, 0, 0))
    }

    return Array.from(grouped.values())
      .sort((a, b) => {
        const [aQ, aYear] = String(a.quarter_key).split('-')
        const [bQ, bYear] = String(b.quarter_key).split('-')
        const aSort = Number(aYear) * 10 + Number(String(aQ).replace('Q', ''))
        const bSort = Number(bYear) * 10 + Number(String(bQ).replace('Q', ''))
        return bSort - aSort
      })
      .slice(0, limit)
  },

  /**
   * Adicionar pontos ao usuário
   */
  async addPoints(userId, points) {
    // Mantém compatibilidade com fluxos antigos que ainda usam user_scores como cache.
    const { data: existing, error: existingError } = await supabase
      .from('user_scores')
      .select('user_id, total_points, tasks_completed')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingError) throw existingError

    const payload = {
      user_id: userId,
      total_points: Number(existing?.total_points || 0) + Number(points || 0),
      tasks_completed: Number(existing?.tasks_completed || 0) + 1,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('user_scores')
      .upsert(payload)

    if (error) throw error
    return payload
  },

  /**
   * Obter ranking geral
   */
  async getLeaderboard(limit = 100, quarterKey = getCurrentQuarterKey()) {
    const range = getQuarterRange(quarterKey)
    const { data, error } = await supabase
      .from('submissions')
      .select('user_id, points_awarded, validated_at')
      .eq('status', 'approved')
      .not('validated_at', 'is', null)
      .gte('validated_at', range.start.toISOString())
      .lt('validated_at', range.end.toISOString())

    if (error) throw error

    const aggregated = new Map()
    for (const row of data || []) {
      const key = row.user_id
      const current = aggregated.get(key) || {
        user_id: key,
        quarter_key: quarterKey,
        total_points: 0,
        tasks_completed: 0,
      }
      current.total_points += Number(row.points_awarded || 0)
      current.tasks_completed += 1
      aggregated.set(key, current)
    }

    const userIds = Array.from(aggregated.keys())
    if (!userIds.length) return []

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        avatar_url
      `)
      .in('id', userIds)

    if (profilesError) throw profilesError

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))

    return Array.from(aggregated.values())
      .map((entry) => ({
        ...entry,
        profile: profileMap.get(entry.user_id) || null,
      }))
      .sort((a, b) => (Number(b.total_points || 0) - Number(a.total_points || 0)))
      .slice(0, limit)
  },

  /**
   * Ecoantes ativos = perfis ativos (is_active !== false), excluindo admins.
   * Usa RPC no Supabase para contornar RLS (usuário comum só vê o próprio perfil).
   */
  async countActiveEcoantes() {
    const { data, error } = await supabase.rpc('get_active_ecoantes_count')

    if (!error && data !== null && data !== undefined) {
      return Number(data)
    }

    console.warn(
      '[scores] RPC get_active_ecoantes_count indisponível — aplique migrations/add_active_ecoantes_count_rpc.sql no Supabase.',
      error?.message
    )

    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .neq('is_active', false)
      .neq('role', 'admin')
      .is('deleted_at', null)

    if (countError) throw countError
    return Number(count || 0)
  },

  /**
   * Progresso grupal do trimestre: ecoantes ativos e pontos coletivos
   */
  async getGroupProgress(quarterKey = getCurrentQuarterKey()) {
    const { data, error } = await supabase.rpc('get_group_progress_stats', {
      p_quarter_key: quarterKey,
    })

    if (!error && data) {
      return {
        quarter_key: data.quarter_key ?? quarterKey,
        active_ecoantes: Number(data.active_ecoantes ?? 0),
        active_in_quarter: Number(data.active_in_quarter ?? 0),
        collective_points: Number(data.collective_points ?? 0),
        target_points: Number(data.target_points ?? 0),
        progress_percentage: Number(data.progress_percentage ?? 0),
      }
    }

    console.warn(
      '[scores] RPC get_group_progress_stats indisponível — aplique migrations/add_active_ecoantes_count_rpc.sql no Supabase.',
      error?.message
    )

    const [quarterEntries, activeEcoantes] = await Promise.all([
      this.getLeaderboard(1000, quarterKey),
      this.countActiveEcoantes(),
    ])

    const collectivePoints = quarterEntries.reduce(
      (sum, entry) => sum + Number(entry.total_points || 0),
      0
    )
    const activeInQuarter = quarterEntries.length

    const targetPoints = activeEcoantes * MAX_JOURNEY_POINTS
    const progressPercentage = targetPoints > 0
      ? Math.min((collectivePoints / targetPoints) * 100, 100)
      : 0

    return {
      quarter_key: quarterKey,
      active_ecoantes: activeEcoantes,
      active_in_quarter: activeInQuarter,
      collective_points: collectivePoints,
      target_points: targetPoints,
      progress_percentage: progressPercentage,
    }
  },

  /**
   * Lista trimestres disponíveis para seleção (do mais recente ao mais antigo)
   */
  getRecentQuarterKeys(count = 8) {
    const result = []
    const now = new Date()
    let year = now.getFullYear()
    let quarter = Math.floor(now.getMonth() / 3) + 1

    for (let i = 0; i < count; i += 1) {
      result.push(`Q${quarter}-${year}`)
      quarter -= 1
      if (quarter < 1) {
        quarter = 4
        year -= 1
      }
    }

    return result
  }

}
