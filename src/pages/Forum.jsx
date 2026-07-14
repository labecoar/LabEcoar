// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateForumTopic, useForumTopics } from "@/hooks/useForum";
import { useForumUnread } from "@/hooks/useForumUnread";
import { useUserScore } from "@/hooks/useScores";
import {
  MessageSquare, Plus, Eye, Pin, MessageCircle, XCircle, Send, Star
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { notifyError } from "@/lib/toast";
import { C, heading, body } from '@/lib/theme';
import { ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";

const CATEGORY_INFO = {
  dicas: { name: "Dicas", colorHex: C.orange },
  duvidas: { name: "Dúvidas", colorHex: C.blue },
  conquistas: { name: "Conquistas", colorHex: "#AA66FF" },
  campanhas: { name: "Campanhas", colorHex: C.lime },
  geral: { name: "Geral", colorHex: C.cream },
  sugestoes: { name: "Sugestões", colorHex: "#FF2255" }
};

const previewText = (text, max = 110) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
};

export default function Forum() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showNewTopicDialog, setShowNewTopicDialog] = useState(false);
  const [newTopic, setNewTopic] = useState({
    title: "",
    description: "",
    category: "geral"
  });

  const { data: topics = [], isLoading } = useForumTopics();
  const { data: userScore } = useUserScore(user?.id);
  const createTopicMutation = useCreateForumTopic();
  const { isTopicUnread, hasUnread, unreadTopicIds, markTopicSeen } = useForumUnread();

  const totalTopics = topics.length;
  const totalReplies = topics.reduce((a, t) => a + (t.total_posts || 0), 0);
  const totalViews = topics.reduce((a, t) => a + (t.views || 0), 0);

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!newTopic.title.trim()) return;

    try {
      const created = await createTopicMutation.mutateAsync({
        ...newTopic,
        author_id: user?.id || null,
        author_email: profile?.email || user?.email || null,
        author_name: profile?.display_name || profile?.full_name || 'Ecoante',
      });
      if (created?.id) markTopicSeen(created.id);
      setShowNewTopicDialog(false);
      setNewTopic({ title: "", description: "", category: "geral" });
    } catch (error) {
      console.error('Erro ao criar tópico:', error);
      notifyError(error?.message || 'Não foi possível criar o tópico.');
    }
  };

  const filteredTopics = useMemo(() => {
    let list = selectedCategory === "todas"
      ? topics
      : topics.filter((topic) => topic.category === selectedCategory);
    if (showUnreadOnly) {
      list = list.filter((topic) => isTopicUnread(topic));
    }
    return list;
  }, [topics, selectedCategory, showUnreadOnly, isTopicUnread]);

  const sortedTopics = useMemo(() => {
    return [...filteredTopics].sort((a, b) => {
      const aUnread = isTopicUnread(a) ? 1 : 0;
      const bUnread = isTopicUnread(b) ? 1 : 0;
      if (bUnread !== aUnread) return bUnread - aUnread;
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.last_activity || b.created_at || 0).getTime()
        - new Date(a.last_activity || a.created_at || 0).getTime();
    });
  }, [filteredTopics, isTopicUnread]);

  return (
    <div style={{ minHeight: "100vh", background: C.black, ...body }}>
      <div className="hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10" style={{ backgroundColor: `${C.black}F5`, backdropFilter: "blur(16px)", borderBottom: `1px solid rgba(var(--ink),0.05)` }}>
        <div className="flex items-center gap-3">
          <MessageSquare size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Fórum</span>
          {hasUnread && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: "rgba(206,22,28,0.15)", color: "#ce161c" }}
            >
              {unreadTopicIds.size} nova{unreadTopicIds.size === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.onAccent }}>
          <Star size={11} fill={C.onAccent} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{userScore?.total_points || 0} pts</span>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-8 md:pb-10 max-w-6xl mx-auto w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none" style={{ ...heading, color: C.cream }}>Fórum</h1>
            <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>
              Salas com ponto vermelho têm mensagem nova — sem precisar abrir uma por uma.
            </p>
          </div>
          <button
            onClick={() => setShowNewTopicDialog(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl transition-all hover:brightness-110"
            style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 13 }}
          >
            <Plus size={15} /> Novo Tópico
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-7">
          {[
            { label: "Tópicos ativos", value: totalTopics, icon: MessageSquare },
            { label: "Respostas totais", value: totalReplies, icon: MessageCircle },
            { label: "Visualizações totais", value: totalViews, icon: Eye },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-4 rounded-2xl flex items-center gap-4" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.06)` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: C.lime_back, color: C.lime }}>
                <Icon size={16} />
              </div>
              <div>
                <div style={{ ...heading, fontSize: 24, fontWeight: 900, color: C.cream, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: `${C.cream}40`, marginTop: 3 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            className="shrink-0 px-4 py-2 rounded-xl text-sm transition-all duration-150 flex items-center gap-2"
            style={{
              backgroundColor: showUnreadOnly ? "rgba(206,22,28,0.18)" : "rgba(var(--ink),0.06)",
              color: showUnreadOnly ? "#ff6b6b" : `${C.cream}70`,
              fontWeight: showUnreadOnly ? 700 : 400,
              ...heading,
              fontSize: 13,
              border: showUnreadOnly ? "1px solid rgba(206,22,28,0.35)" : "1px solid transparent",
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#ce161c" }} />
            Com novidade{hasUnread ? ` (${unreadTopicIds.size})` : ""}
          </button>
          {[{ key: "todas", name: "Todas" }, ...Object.entries(CATEGORY_INFO).map(([k, v]) => ({ key: k, name: v.name }))].map((c) => {
            const active = c.key === selectedCategory;
            return (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className="shrink-0 px-4 py-2 rounded-xl text-sm transition-all duration-150"
                style={{
                  backgroundColor: active ? C.lime : "rgba(var(--ink),0.06)",
                  color: active ? C.onAccent : `${C.cream}70`,
                  fontWeight: active ? 700 : 400,
                  ...heading,
                  fontSize: 13,
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: C.lime }}></div>
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>Carregando fórum...</p>
          </div>
        ) : sortedTopics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <MessageSquare size={36} style={{ color: `${C.cream}20` }} />
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>
              {showUnreadOnly ? "Nenhuma sala com novidade no momento." : "Nenhum tópico nesta categoria."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedTopics.map((topic) => {
              const isPinned = Boolean(topic.is_pinned);
              const unread = isTopicUnread(topic);
              const lastPost = topic.last_post;
              const lastPreview = lastPost?.content
                ? previewText(lastPost.content)
                : previewText(topic.description);
              const lastAuthor = lastPost?.author_name || topic.author_name || "Comunidade";
              const activityDate = new Date(lastPost?.created_at || topic.last_activity || topic.created_at || Date.now());
              const activityLabel = Number.isNaN(activityDate.getTime())
                ? ""
                : formatDistanceToNow(activityDate, { addSuffix: true, locale: ptBR });

              return (
                <div
                  key={topic.id}
                  onClick={() => navigate(createPageUrl(`ForumTopic?id=${topic.id}`))}
                  className="rounded-2xl transition-all hover:brightness-110 cursor-pointer relative overflow-hidden"
                  style={{
                    backgroundColor: C.card,
                    border: `1px solid ${unread ? "rgba(206,22,28,0.4)" : isPinned ? `${C.lime}22` : "rgba(var(--ink),0.06)"}`,
                  }}
                >
                  {unread && (
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: "#ce161c" }} />
                  )}

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {unread && (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: "rgba(206,22,28,0.14)", color: "#ff6b6b", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#ce161c" }} />
                          Nova mensagem
                        </span>
                      )}
                      {isPinned && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: C.lime_back, color: C.lime, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
                          <Pin size={10} /> FIXADO
                        </span>
                      )}
                      <span
                        className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ml-auto"
                        style={{
                          backgroundColor: `${CATEGORY_INFO[topic.category]?.colorHex || C.lime}18`,
                          color: CATEGORY_INFO[topic.category]?.colorHex || C.lime,
                        }}
                      >
                        {CATEGORY_INFO[topic.category]?.name || topic.category}
                      </span>
                    </div>

                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm relative"
                        style={{ backgroundColor: C.orange, color: C.cream }}
                      >
                        {(lastAuthor || "E").charAt(0).toUpperCase()}
                        {unread && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                            style={{ backgroundColor: "#ce161c", borderColor: C.card }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 style={{ ...heading, fontSize: 15, fontWeight: unread ? 800 : 700, color: C.cream, letterSpacing: "-0.01em", marginBottom: 6 }}>
                          {topic.title}
                        </h3>

                        <div
                          className="rounded-xl px-3 py-2.5 mb-3"
                          style={{
                            backgroundColor: unread ? "rgba(206,22,28,0.06)" : "rgba(var(--ink),0.04)",
                            border: `1px solid ${unread ? "rgba(206,22,28,0.12)" : "rgba(var(--ink),0.06)"}`,
                          }}
                        >
                          <p style={{ fontSize: 11, color: unread ? "#ff6b6b" : `${C.cream}45`, fontWeight: 700, marginBottom: 4 }}>
                            {lastPost ? `Última mensagem · ${lastAuthor}` : `Tópico · ${lastAuthor}`}
                            {activityLabel ? ` · ${activityLabel}` : ""}
                          </p>
                          <p style={{ fontSize: 13, color: unread ? `${C.cream}90` : `${C.cream}55`, lineHeight: 1.45 }} className="line-clamp-2">
                            {lastPreview || "Sem mensagens ainda."}
                          </p>
                        </div>

                        <div className="flex items-center flex-wrap gap-4">
                          <span style={{ fontSize: 11, color: `${C.cream}40` }}>
                            criado {format(new Date(topic.created_at || new Date()), "dd MMM yyyy", { locale: ptBR })}
                          </span>
                          <div className="ml-auto flex items-center gap-4">
                            <span className="flex items-center gap-1.5 opacity-55" style={{ fontSize: 12, color: C.cream }}>
                              <Eye size={12} /> {topic.views || 0}
                            </span>
                            <span className="flex items-center gap-1.5 opacity-55" style={{ fontSize: 12, color: C.cream }}>
                              <MessageCircle size={12} /> {topic.total_posts || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showNewTopicDialog} onOpenChange={setShowNewTopicDialog}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg p-0 border-0 bg-transparent overflow-hidden shadow-none">
          <DialogTitle className="sr-only">Novo Tópico</DialogTitle>
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(var(--ink),0.1)` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(var(--ink),0.07)` }}>
              <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>Novo Tópico</span>
              <button onClick={() => setShowNewTopicDialog(false)} style={{ color: `${C.cream}50` }} className="hover:opacity-100 transition-opacity"><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleCreateTopic} className="p-6 flex flex-col gap-4">
              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>TÍTULO</label>
                <input className="mt-2 w-full px-4 py-3 rounded-xl outline-none" style={{ backgroundColor: C.black_light, border: `1px solid rgba(var(--ink),0.1)`, color: C.cream, ...body, fontSize: 14 }} placeholder="O que você quer discutir?" value={newTopic.title} onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} required />
              </div>
              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>CATEGORIA</label>
                <div className="relative mt-2">
                  <select
                    className="w-full px-4 py-3 rounded-xl outline-none appearance-none pr-10"
                    style={{ backgroundColor: C.black_light, border: `1px solid rgba(var(--ink),0.1)`, color: newTopic.category ? C.cream : `${C.cream}40`, ...body, fontSize: 14 }}
                    value={newTopic.category}
                    onChange={(e) => setNewTopic({ ...newTopic, category: e.target.value })}
                  >
                    {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                      <option key={key} value={key} style={{ backgroundColor: C.card, color: C.cream }}>{info.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${C.cream}50` }} />
                </div>
              </div>
              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>MENSAGEM</label>
                <textarea className="mt-2 w-full px-4 py-3 rounded-xl outline-none resize-none" rows={4} style={{ backgroundColor: C.black_light, border: `1px solid rgba(var(--ink),0.1)`, color: C.cream, ...body, fontSize: 14 }} placeholder="Compartilhe seus pensamentos..." value={newTopic.description} onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })} required />
              </div>
              <button type="submit" disabled={createTopicMutation.isPending} className="flex items-center justify-center gap-2 w-full h-12 rounded-xl transition-all hover:brightness-110 mt-2 disabled:opacity-50" style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 14 }}>
                <Send size={15} /> {createTopicMutation.isPending ? 'Publicando...' : 'Publicar'}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
