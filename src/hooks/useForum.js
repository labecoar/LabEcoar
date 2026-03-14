import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { forumService } from '@/services/forum.service'

export function useForumTopics() {
  return useQuery({
    queryKey: ['forum-topics'],
    queryFn: () => forumService.getTopics(),
    staleTime: 0,
    refetchOnMount: 'always',
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
