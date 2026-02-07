import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Heart, MessageSquare, Eye, Send
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORY_INFO = {
  dicas: { name: "Dicas", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  duvidas: { name: "Dúvidas", color: "bg-blue-100 text-blue-700 border-blue-200" },
  conquistas: { name: "Conquistas", color: "bg-purple-100 text-purple-700 border-purple-200" },
  campanhas: { name: "Campanhas", color: "bg-green-100 text-green-700 border-green-200" },
  geral: { name: "Geral", color: "bg-gray-100 text-gray-700 border-gray-200" },
  sugestoes: { name: "Sugestões", color: "bg-pink-100 text-pink-700 border-pink-200" }
};

export default function ForumTopic() {
  const urlParams = new URLSearchParams(window.location.search);
  const topicId = urlParams.get('id');
  const [newPost, setNewPost] = useState("");
  const queryClient = useQueryClient();

  const { data: topic, isLoading: topicLoading } = useQuery({
    queryKey: ['forum-topic', topicId],
    queryFn: async () => {
      const topics = await base44.entities.ForumTopic.list();
      const topic = topics.find(t => t.id === topicId);
      
      // Incrementar visualizações
      if (topic) {
        await base44.entities.ForumTopic.update(topic.id, {
          views: (topic.views || 0) + 1
        });
      }
      
      return topic;
    },
    enabled: !!topicId,
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['forum-posts', topicId],
    queryFn: () => base44.entities.ForumPost.filter({ topic_id: topicId }, 'created_date'),
    initialData: [],
    enabled: !!topicId,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const createPostMutation = useMutation({
    mutationFn: async (content) => {
      const user = await base44.auth.me();
      const post = await base44.entities.ForumPost.create({
        topic_id: topicId,
        content,
        author_email: user.email,
        author_name: user.full_name,
        likes: 0,
        liked_by: []
      });

      // Atualizar tópico
      await base44.entities.ForumTopic.update(topicId, {
        total_posts: (topic?.total_posts || 0) + 1,
        last_activity: new Date().toISOString()
      });

      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', topicId] });
      queryClient.invalidateQueries({ queryKey: ['forum-topic', topicId] });
      setNewPost("");
    },
  });

  const likePostMutation = useMutation({
    mutationFn: async (post) => {
      const user = await base44.auth.me();
      const hasLiked = post.liked_by?.includes(user.email);
      
      return base44.entities.ForumPost.update(post.id, {
        likes: hasLiked ? post.likes - 1 : post.likes + 1,
        liked_by: hasLiked 
          ? post.liked_by.filter(email => email !== user.email)
          : [...(post.liked_by || []), user.email]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', topicId] });
    },
  });

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;
    createPostMutation.mutate(newPost);
  };

  const handleLike = (post) => {
    likePostMutation.mutate(post);
  };

  if (topicLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-500 mb-4">Tópico não encontrado</p>
          <Link to={createPageUrl("Forum")}>
            <Button>Voltar ao Fórum</Button>
          </Link>
        </div>
      </div>
    );
  }

  const categoryInfo = CATEGORY_INFO[topic.category];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link to={createPageUrl("Forum")}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Fórum
          </Button>
        </Link>

        <Card className="shadow-lg border-emerald-100 bg-white mb-6">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-3 mb-4">
              <Badge className={`${categoryInfo.color} border font-medium`}>
                {categoryInfo.name}
              </Badge>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{topic.title}</h1>
            
            {topic.description && (
              <p className="text-gray-600 mb-4">{topic.description}</p>
            )}

            <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t border-gray-100">
              <span>Por <span className="font-medium text-gray-700">{topic.author_name}</span></span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {topic.total_posts || 0} respostas
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {topic.views || 0} visualizações
              </span>
              {topic.created_date && (
                <span>{format(new Date(topic.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-emerald-100 bg-white mb-6">
          <CardContent className="p-6">
            <h2 className="font-semibold text-lg mb-4">Sua Resposta</h2>
            <form onSubmit={handleCreatePost}>
              <Textarea
                placeholder="Compartilhe sua opinião..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="h-32 mb-4"
              />
              <div className="flex justify-end">
                <Button 
                  type="submit"
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  disabled={createPostMutation.isPending || !newPost.trim()}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {createPostMutation.isPending ? 'Enviando...' : 'Responder'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-semibold text-lg text-gray-900">
            {posts.length} {posts.length === 1 ? 'Resposta' : 'Respostas'}
          </h2>

          {posts.map((post) => {
            const hasLiked = post.liked_by?.includes(currentUser?.email);
            
            return (
              <Card key={post.id} className="shadow-md border-gray-200 bg-white">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {post.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{post.author_name}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(post.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap mb-4">{post.content}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(post)}
                        className={`${hasLiked ? 'text-red-600 hover:text-red-700' : 'text-gray-600 hover:text-gray-700'}`}
                      >
                        <Heart className={`w-4 h-4 mr-1 ${hasLiked ? 'fill-current' : ''}`} />
                        {post.likes || 0} {post.likes === 1 ? 'curtida' : 'curtidas'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {posts.length === 0 && (
            <Card className="shadow-lg border-gray-200">
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">Nenhuma resposta ainda</p>
                <p className="text-gray-400 text-sm mt-2">Seja o primeiro a responder!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}