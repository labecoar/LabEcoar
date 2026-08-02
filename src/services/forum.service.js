import { supabase } from '@/lib/supabase'

const FORUM_MAX_TEXT_LENGTH = 5000
const BASE64_IMAGE_PATTERN = /data:image\/[a-zA-Z0-9.+-]+;base64,/i

export const FORUM_PAGE_SIZE = 15

const validateForumTextField = (value, fieldLabel) => {
  const normalized = String(value || '')

  if (BASE64_IMAGE_PATTERN.test(normalized)) {
    throw new Error('Nao e permitido colar imagem em base64 no Forum. Envie apenas texto e links de imagem.')
  }

  if (normalized.length > FORUM_MAX_TEXT_LENGTH) {
    throw new Error(`${fieldLabel} muito grande. Limite de ${FORUM_MAX_TEXT_LENGTH} caracteres.`)
  }
}

const attachLastPosts = async (topics) => {
  const topicIds = topics.map((topic) => topic.id).filter(Boolean)
  let lastPostByTopic = {}

  if (topicIds.length > 0) {
    const { data: recentPosts, error: postsError } = await supabase
      .from('forum_posts')
      .select('topic_id, content, author_name, author_id, author_email, created_at')
      .in('topic_id', topicIds)
      .order('created_at', { ascending: false })

    if (!postsError && Array.isArray(recentPosts)) {
      recentPosts.forEach((post) => {
        if (!post?.topic_id || lastPostByTopic[post.topic_id]) return
        lastPostByTopic[post.topic_id] = {
          content: post.content || '',
          author_name: post.author_name || 'Comunidade',
          author_id: post.author_id || null,
          author_email: post.author_email || null,
          created_at: post.created_at,
        }
      })
    }
  }

  return topics.map((topic) => ({
    ...topic,
    total_posts: Number(topic.forum_posts?.[0]?.count ?? topic.total_posts ?? 0),
    last_post: lastPostByTopic[topic.id] || null,
    forum_posts: undefined,
  }))
}

export const forumService = {
  async getTopics({ limit, offset = 0, category } = {}) {
    let query = supabase
      .from('forum_topics')
      .select('*, forum_posts(count)')
      .order('is_pinned', { ascending: false })
      .order('last_activity', { ascending: false })

    if (category && category !== 'todas') {
      query = query.eq('category', category)
    }

    if (limit != null) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data, error } = await query

    if (error) throw error

    const topics = await attachLastPosts(data || [])

    return {
      topics,
      hasMore: limit != null ? topics.length === limit : false,
    }
  },

  async getTopicStats() {
    const { data, error } = await supabase
      .from('forum_topics')
      .select('total_posts, views')

    if (error) throw error

    const rows = data || []
    return {
      totalTopics: rows.length,
      totalReplies: rows.reduce((sum, topic) => sum + Number(topic.total_posts || 0), 0),
      totalViews: rows.reduce((sum, topic) => sum + Number(topic.views || 0), 0),
    }
  },

  async createTopic(topicData) {
    validateForumTextField(topicData?.title, 'Titulo')
    validateForumTextField(topicData?.description, 'Descricao')

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
    validateForumTextField(postData?.content, 'Conteudo')

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
