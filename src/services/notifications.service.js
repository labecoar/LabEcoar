import { supabase } from '@/lib/supabase'

export const notificationsService = {
  async getSeenNotificationIds(userId) {
    if (!userId) return []
    const { data, error } = await supabase
      .from('user_notifications')
      .select('notification_id')
      .eq('user_id', userId)
      .eq('is_read', true)

    if (error) throw error
    return (data || []).map((r) => r.notification_id)
  },

  async markAsRead(userId, notificationId) {
    if (!userId || !notificationId) return null
    const payload = {
      user_id: userId,
      notification_id: notificationId,
      is_read: true,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('user_notifications')
      .upsert(payload, { onConflict: ['user_id', 'notification_id'] })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async markManyAsRead(userId, notificationIds = []) {
    if (!userId || !Array.isArray(notificationIds) || notificationIds.length === 0) return []
    const rows = notificationIds.map((id) => ({
      user_id: userId,
      notification_id: id,
      is_read: true,
      created_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('user_notifications')
      .upsert(rows, { onConflict: ['user_id', 'notification_id'] })
      .select()

    if (error) throw error
    return data || []
  },
}

export default notificationsService
