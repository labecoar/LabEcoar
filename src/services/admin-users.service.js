import { supabase } from '@/lib/supabase'

const USER_SELECT = `
  id,
  email,
  full_name,
  display_name,
  bio,
  instagram_handle,
  cpf,
  avatar_url,
  role,
  followers_count,
  current_category,
  current_quarter,
  campaigns_participated,
  is_active,
  deleted_at,
  created_at,
  updated_at
`

const normalizeString = (value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const normalizeInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

const cleanPayload = (updates = {}) => {
  const payload = { ...updates }

  for (const key of ['email', 'full_name', 'display_name', 'bio', 'instagram_handle', 'cpf', 'avatar_url', 'current_category', 'current_quarter']) {
    if (key in payload) {
      payload[key] = normalizeString(payload[key])
    }
  }

  for (const key of ['followers_count', 'campaigns_participated']) {
    if (key in payload) {
      payload[key] = normalizeInteger(payload[key])
    }
  }

  return payload
}

export const adminUsersService = {
  async listUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select(USER_SELECT)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async updateUser(userId, updates) {
    const payload = cleanPayload({
      ...updates,
      updated_at: new Date().toISOString(),
    })

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select(USER_SELECT)
      .single()

    if (error) throw error
    return data
  },

  async deactivateUser(userId) {
    return this.updateUser(userId, {
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
  },

  async reactivateUser(userId) {
    return this.updateUser(userId, {
      is_active: true,
      deleted_at: null,
    })
  },

  async deleteUser(userId) {
    const { data, error } = await supabase.rpc('admin_delete_user', {
      target_user_id: userId,
    })

    if (error) throw error
    return data
  },
}