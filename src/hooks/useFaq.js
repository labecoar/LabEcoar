import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { faqService } from '@/services/faq.service';

export function useFaqContent() {
  return useQuery({
    queryKey: ['faq-content'],
    queryFn: () => faqService.getContent(),
    staleTime: 60_000,
  });
}

export function useSaveFaqContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sections, userId }) => faqService.saveContent(sections, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq-content'] });
    },
  });
}
