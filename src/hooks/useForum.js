import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { forumService, FORUM_PAGE_SIZE } from '@/services/forum.service'

export { FORUM_PAGE_SIZE }

export function useForumTopics(options) {
  const isPaginated = Boolean(options?.limit)

  return useQuery({
    queryKey: ['forum-topics', options ?? 'all'],
    queryFn: () => forumService.getTopics(options),
    staleTime: isPaginated ? 30000 : 0,
    refetchOnMount: isPaginated ? true : 'always',
    refetchOnWindowFocus: true,
    refetchInterval: isPaginated ? 30000 : 15000,
  })
}

export function useForumTopicStats() {
  return useQuery({
    queryKey: ['forum-topic-stats'],
    queryFn: () => forumService.getTopicStats(),
    staleTime: 60000,
    refetchOnWindowFocus: true,
  })
}

export function useForumTopic(topicId) {
  return useQuery({
    queryKey: ['forum-topic', topicId],
    queryFn: () => forumService.getTopicById(topicId),
    enabled: !!topicId,
  })
}

export function useForumPosts(topicId) {
  return useQuery({
    queryKey: ['forum-posts', topicId],
    queryFn: () => forumService.getPostsByTopic(topicId),
    enabled: !!topicId,
  })
}

export function useCreateForumTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (topicData) => forumService.createTopic(topicData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] })
      queryClient.invalidateQueries({ queryKey: ['forum-topic-stats'] })
    },
  })
}

export function useUpdateForumTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ topicId, updates }) => forumService.updateTopic(topicId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] })
    },
  })
}

export function useDeleteForumTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (topicId) => forumService.deleteTopic(topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] })
      queryClient.invalidateQueries({ queryKey: ['forum-topic-stats'] })
    },
  })
}

export function useCreateForumPost(topicId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postData) => forumService.createPost(postData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', topicId] })
      queryClient.invalidateQueries({ queryKey: ['forum-topic', topicId] })
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] })
      queryClient.invalidateQueries({ queryKey: ['forum-topic-stats'] })
    },
  })
}

export function useToggleForumPostLike(topicId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ post, userEmail }) => forumService.toggleLike(post, userEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', topicId] })
    },
  })
}
