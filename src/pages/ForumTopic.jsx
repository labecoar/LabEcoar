// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateForumPost, useForumPosts, useForumTopic, useToggleForumPostLike } from "@/hooks/useForum";
import { useForumUnread } from "@/hooks/useForumUnread";
import { useUserScore } from "@/hooks/useScores";
import { forumService } from "@/services/forum.service";
import {
  ArrowLeft, Heart, MessageSquare, Eye, Send, Star, MessageCircle, Pin
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { notifyError } from "@/lib/toast";
import { C, heading, body } from "@/lib/theme";

const CATEGORY_INFO = {
  dicas: { name: "Dicas", colorHex: C.orange },
  duvidas: { name: "Dúvidas", colorHex: C.blue },
  conquistas: { name: "Conquistas", colorHex: "#AA66FF" },
  campanhas: { name: "Campanhas", colorHex: C.lime },
  geral: { name: "Geral", colorHex: `${C.cream}80` },
  sugestoes: { name: "Sugestões", colorHex: "#FF2255" },
};

const inputStyle = {
  backgroundColor: C.black_light,
  border: "1px solid rgba(var(--ink),0.1)",
  color: C.cream,
  ...body,
  fontSize: 14,
};

export default function ForumTopic() {
  const { user, profile } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const topicId = urlParams.get("id");
  const [newPost, setNewPost] = useState("");

  const { data: topic, isLoading: topicLoading } = useForumTopic(topicId);
  const { markTopicSeen } = useForumUnread();

  useEffect(() => {
    if (topicId) markTopicSeen(topicId);
  }, [markTopicSeen, topicId]);
  const { data: posts = [] } = useForumPosts(topicId);
  const { data: userScore } = useUserScore(user?.id);
  const createPostMutation = useCreateForumPost(topicId);
  const likePostMutation = useToggleForumPostLike(topicId);
  const viewsIncremented = useRef(false);

  useEffect(() => {
    if (!topicId || viewsIncremented.current) return;
    viewsIncremented.current = true;
    forumService.incrementViews(topicId).catch(() => {});
  }, [topicId]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    const content = newPost.trim();
    if (!content) return;

    setNewPost("");

    try {
      await createPostMutation.mutateAsync({
        topic_id: topicId,
        content,
        author_id: user?.id || null,
        author_email: profile?.email || user?.email || null,
        author_name: profile?.display_name || profile?.full_name || "Ecoante",
      });
      markTopicSeen(topicId);
    } catch (error) {
      setNewPost(content);
      notifyError(error?.message || "Não foi possível enviar a resposta.");
    }
  };

  const handleLike = (post) => {
    likePostMutation.mutate({ post, userEmail: profile?.email || user?.email });
  };

  const renderHeader = () => (
    <div
      className="hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10"
      style={{
        backgroundColor: `${C.black}F5`,
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(var(--ink),0.05)",
      }}
    >
      <div className="flex items-center gap-3">
        <MessageSquare size={16} style={{ color: C.lime }} />
        <span
          style={{
            ...heading,
            fontSize: 12,
            fontWeight: 700,
            color: `${C.cream}60`,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Fórum
        </span>
      </div>
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{ backgroundColor: C.lime, color: C.onAccent }}
      >
        <Star size={11} fill={C.onAccent} />
        <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>
          {userScore?.total_points || 0} pts
        </span>
      </div>
    </div>
  );

  if (topicLoading) {
    return (
      <div style={{ minHeight: "100vh", background: C.black, ...body }}>
        {renderHeader()}
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2"
            style={{ borderColor: C.lime }}
          />
          <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>
            Carregando tópico...
          </p>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div style={{ minHeight: "100vh", background: C.black, ...body }}>
        {renderHeader()}
        <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-4xl mx-auto w-full min-w-0 flex flex-col items-center py-24 gap-4">
          <MessageSquare size={36} style={{ color: `${C.cream}20` }} />
          <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>
            Tópico não encontrado
          </p>
          <Link
            to={createPageUrl("Forum")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl transition-all hover:brightness-110"
            style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 13 }}
          >
            <ArrowLeft size={15} />
            Voltar ao Fórum
          </Link>
        </div>
      </div>
    );
  }

  const categoryInfo = CATEGORY_INFO[topic.category] || CATEGORY_INFO.geral;
  const categoryColor = categoryInfo.colorHex;
  const replyCount = posts.length || topic.total_posts || 0;
  const isPinned = Boolean(topic.is_pinned);

  return (
    <div style={{ minHeight: "100vh", background: C.black, ...body }}>
      {renderHeader()}

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-4xl mx-auto w-full min-w-0">
        <Link
          to={createPageUrl("Forum")}
          className="inline-flex items-center gap-2 mb-6 px-3 py-2 rounded-xl transition-all hover:brightness-110"
          style={{
            backgroundColor: "rgba(var(--ink),0.06)",
            color: `${C.cream}70`,
            ...heading,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <ArrowLeft size={14} />
          Voltar ao Fórum
        </Link>

        {/* Tópico principal */}
        <div
          className="p-4 sm:p-6 rounded-2xl mb-6 min-w-0 overflow-hidden"
          style={{
            backgroundColor: C.card,
            border: `1px solid ${isPinned ? `${C.lime}22` : "rgba(var(--ink),0.06)"}`,
          }}
        >
          {isPinned && (
            <div className="flex items-center gap-1.5 mb-4">
              <Pin size={12} style={{ color: C.lime }} />
              <span
                style={{
                  fontSize: 10,
                  color: C.lime,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                }}
              >
                FIXADO
              </span>
            </div>
          )}

          <div className="flex items-start justify-between gap-3 mb-4">
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${categoryColor}18`,
                color: categoryColor,
              }}
            >
              {categoryInfo.name}
            </span>
          </div>

          <h1
            className="forum-break-text"
            style={{
              ...heading,
              fontSize: 28,
              fontWeight: 900,
              color: C.cream,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              marginBottom: 12,
            }}
          >
            {topic.title}
          </h1>

          {topic.description && (
            <p
              className="forum-body-text whitespace-pre-wrap"
              style={{
                fontSize: 14,
                color: `${C.cream}65`,
                lineHeight: 1.65,
                marginBottom: 20,
              }}
            >
              {topic.description}
            </p>
          )}

          <div
            className="flex flex-wrap items-center gap-4 pt-4"
            style={{ borderTop: "1px solid rgba(var(--ink),0.06)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                style={{ backgroundColor: C.orange, color: C.cream }}
              >
                {(topic.author_name || "E").charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: `${C.cream}70`, fontWeight: 600 }}>
                {topic.author_name || "Comunidade"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: `${C.cream}35` }}>·</span>
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: `${C.cream}45` }}>
              <MessageCircle size={12} />
              {replyCount} {replyCount === 1 ? "resposta" : "respostas"}
            </span>
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: `${C.cream}45` }}>
              <Eye size={12} />
              {topic.views || 0} visualizações
            </span>
            {topic.created_at && (
              <span style={{ fontSize: 12, color: `${C.cream}35`, marginLeft: "auto" }}>
                {format(new Date(topic.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>

        {/* Formulário de resposta */}
        <div
          className="p-6 rounded-2xl mb-8"
          style={{
            backgroundColor: C.card,
            border: "1px solid rgba(var(--ink),0.06)",
          }}
        >
          <h2
            style={{
              ...heading,
              fontSize: 15,
              fontWeight: 700,
              color: C.cream,
              marginBottom: 14,
            }}
          >
            Sua resposta
          </h2>
          <form onSubmit={handleCreatePost}>
            <textarea
              placeholder="Compartilhe sua opinião..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl outline-none resize-none mb-4"
              style={inputStyle}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={createPostMutation.isPending || !newPost.trim()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
                style={{
                  backgroundColor: C.lime,
                  color: C.onAccent,
                  ...heading,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <Send size={14} />
                {createPostMutation.isPending ? "Enviando..." : "Responder"}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de respostas */}
        <div>
          <h2
            style={{
              ...heading,
              fontSize: 16,
              fontWeight: 800,
              color: C.cream,
              marginBottom: 16,
            }}
          >
            {posts.length} {posts.length === 1 ? "Resposta" : "Respostas"}
          </h2>

          {posts.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl"
              style={{
                backgroundColor: C.card,
                border: "1px solid rgba(var(--ink),0.06)",
              }}
            >
              <MessageSquare size={36} style={{ color: `${C.cream}20`, marginBottom: 12 }} />
              <p style={{ ...heading, fontSize: 16, fontWeight: 700, color: `${C.cream}40` }}>
                Nenhuma resposta ainda
              </p>
              <p style={{ fontSize: 13, color: `${C.cream}30`, marginTop: 6 }}>
                Seja o primeiro a responder!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map((post) => {
                const hasLiked =
                  Array.isArray(post.liked_by) &&
                  (post.liked_by || []).includes(profile?.email || user?.email);
                const likeCount = post.likes || 0;

                return (
                  <div
                    key={post.id}
                    className="p-5 rounded-2xl min-w-0 overflow-hidden"
                    style={{
                      backgroundColor: C.card,
                      border: "1px solid rgba(var(--ink),0.06)",
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                        style={{ backgroundColor: C.orange, color: C.cream }}
                      >
                        {(post.author_name || "E").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p
                              style={{
                                ...heading,
                                fontSize: 14,
                                fontWeight: 700,
                                color: C.cream,
                              }}
                            >
                              {post.author_name || "Ecoante"}
                            </p>
                            <p style={{ fontSize: 11, color: `${C.cream}40`, marginTop: 2 }}>
                              {format(new Date(post.created_at), "dd MMM yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                        <p
                          className="forum-body-text whitespace-pre-wrap"
                          style={{
                            fontSize: 14,
                            color: `${C.cream}75`,
                            lineHeight: 1.65,
                            marginBottom: 14,
                          }}
                        >
                          {post.content}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleLike(post)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                          style={{
                            backgroundColor: hasLiked ? `${C.pink}18` : "rgba(var(--ink),0.06)",
                            color: hasLiked ? C.pink : `${C.cream}55`,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <Heart size={13} fill={hasLiked ? C.pink : "none"} />
                          {likeCount} {likeCount === 1 ? "curtida" : "curtidas"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
