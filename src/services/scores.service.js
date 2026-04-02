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

    const range = getQuarterRange(quarterKey)
    const { data, error } = await supabase
      .from('submissions')
      .select('points_awarded, validated_at')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gte('validated_at', range.start.toISOString())
      .lt('validated_at', range.end.toISOString())

    if (error) throw error

    const totalPoints = (data || []).reduce((acc, item) => acc + Number(item.points_awarded || 0), 0)
    const tasksCompleted = (data || []).length
    return toScoreModel(userId, quarterKey, totalPoints, tasksCompleted)
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
