import { supabase } from '@/lib/supabase'

export const forumService = {
  async getTopics() {
    const { data, error } = await supabase
      .from('forum_topics')
      .select('*, forum_posts(count)')
      .order('is_pinned', { ascending: false })
      .order('last_activity', { ascending: false })

    if (error) throw error
    return (data || []).map(topic => ({
      ...topic,
      total_posts: Number(topic.forum_posts?.[0]?.count ?? topic.total_posts ?? 0),
      forum_posts: undefined,
    }))
  },

  async createTopic(topicData) {
    const { data, error } = await supabase
      .from('forum_topics')
      .insert([{
        ...topicData,
        last_activity: new Date().toISOString(),
        total_posts: 0,
        views: 0,
        is_pinned: false,
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getTopicById(topicId) {
    const { data, error } = await supabase
      .from('forum_topics')
      .select('*')
      .eq('id', topicId)
      .single()

    if (error) throw error
    return data
  },

  async incrementViews(topicId) {
    const { error } = await supabase
      .rpc('increment_forum_topic_views', { p_topic_id: topicId })

    if (error) throw error
  },

  async updateTopic(topicId, updates) {
    const { data, error } = await supabase
      .from('forum_topics')
      .update({
        ...updates,
        last_activity: new Date().toISOString(),
      })
      .eq('id', topicId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteTopic(topicId) {
    const { error } = await supabase
      .from('forum_topics')
      .delete()
      .eq('id', topicId)

    if (error) throw error
  },

  async getPostsByTopic(topicId) {
    const { data, error } = await supabase
      .from('forum_posts')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createPost(postData) {
    const { data, error } = await supabase
      .from('forum_posts')
      .insert([{
        ...postData,
        likes: 0,
        liked_by: [],
      }])
      .select()
      .single()

    if (error) throw error

    // Incrementa total_posts via RPC (SECURITY DEFINER, ignora RLS)
    try {
      await supabase.rpc('increment_forum_topic_posts', { p_topic_id: postData.topic_id })
    } catch (e) {
      console.warn('Nao foi possivel incrementar total_posts:', e)
    }

    return data
  },

  async toggleLike(post, userEmail) {
    const likedBy = Array.isArray(post.liked_by) ? post.liked_by : []
    const hasLiked = likedBy.includes(userEmail)
    const nextLikedBy = hasLiked
      ? likedBy.filter((email) => email !== userEmail)
      : [...likedBy, userEmail]

    const { data, error } = await supabase
      .from('forum_posts')
      .update({
        likes: hasLiked ? Math.max(0, Number(post.likes || 0) - 1) : Number(post.likes || 0) + 1,
        liked_by: nextLikedBy,
      })
      .eq('id', post.id)
      .select()
      .single()

    if (error) throw error
    return data
  },
}
