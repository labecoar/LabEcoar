// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateForumTopic, useForumTopics } from "@/hooks/useForum";
import { useUserScore } from "@/hooks/useScores";
import {
  MessageSquare, Plus, Eye, Pin, MessageCircle, XCircle, Send, Star
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
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

export default function Forum() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [showNewTopicDialog, setShowNewTopicDialog] = useState(false);
  const [newTopic, setNewTopic] = useState({
    title: "",
    description: "",
    category: "geral"
  });

  const { data: topics = [], isLoading } = useForumTopics();
  const { data: userScore } = useUserScore(user?.id);
  const createTopicMutation = useCreateForumTopic();

  // Estatísticas do Fórum
  const totalTopics = topics.length;
  const totalReplies = topics.reduce((a, t) => a + (t.total_posts || 0), 0);
  const totalViews = topics.reduce((a, t) => a + (t.views || 0), 0);

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!newTopic.title.trim()) return;

    try {
      await createTopicMutation.mutateAsync({
        ...newTopic,
        author_id: user?.id || null,
        author_email: profile?.email || user?.email || null,
        author_name: profile?.display_name || profile?.full_name || 'Ecoante',
      });
      setShowNewTopicDialog(false);
      setNewTopic({ title: "", description: "", category: "geral" });
    } catch (error) {
      console.error('Erro ao criar tópico:', error);
      notifyError(error?.message || 'Não foi possível criar o tópico.');
    }
  };

  const filteredTopics = useMemo(
    () => selectedCategory === "todas"
      ? topics
      : topics.filter((topic) => topic.category === selectedCategory),
    [topics, selectedCategory]
  );

  const sortedTopics = useMemo(() => {
    return [...filteredTopics].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [filteredTopics]);

  return (
    <div style={{ minHeight: "100vh", background: C.black, ...body }}>
      {/* Header Fixo */}
      <div className="flex items-center justify-between px-8 py-4 sticky top-0 z-10" style={{ backgroundColor: `${C.black}F5`, backdropFilter: "blur(16px)", borderBottom: `1px solid rgba(255,255,222,0.05)` }}>
        <div className="flex items-center gap-3">
          <MessageSquare size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em", textTransform: "uppercase" }}>Fórum</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.black }}>
          <Star size={11} fill={C.black} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{userScore?.total_points || 0} pts</span>
        </div>
      </div>

      <div className="px-8 pt-7 pb-10 max-w-6xl mx-auto">
        {/* Hero */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 style={{ ...heading, fontSize: 40, fontWeight: 900, color: C.cream, letterSpacing: "-0.03em", lineHeight: 1 }}>Fórum</h1>
            <p style={{ fontSize: 14, color: `${C.cream}50`, marginTop: 6 }}>Troca ideias com outros Ecoantes da CuícaLab.</p>
          </div>
          <button
            onClick={() => setShowNewTopicDialog(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl transition-all hover:brightness-110"
            style={{ backgroundColor: C.lime, color: C.black, ...heading, fontWeight: 700, fontSize: 13 }}
          >
            <Plus size={15} /> Novo Tópico
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-7">
          {[
            { label: "Tópicos ativos", value: totalTopics, icon: MessageSquare },
            { label: "Respostas totais", value: totalReplies, icon: MessageCircle },
            { label: "Visualizações totais", value: totalViews, icon: Eye },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-4 rounded-2xl flex items-center gap-4" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.06)` }}>
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

        {/* Cat tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {[{ key: "todas", name: "Todas" }, ...Object.entries(CATEGORY_INFO).map(([k, v]) => ({ key: k, name: v.name }))].map((c) => {
            const active = c.key === selectedCategory;
            return (
              <button key={c.key} onClick={() => setSelectedCategory(c.key)} className="shrink-0 px-4 py-2 rounded-xl text-sm transition-all duration-150" style={{ backgroundColor: active ? C.lime : "rgba(255,255,222,0.06)", color: active ? C.black : `${C.cream}70`, fontWeight: active ? 700 : 400, ...heading, fontSize: 13 }}>
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Topic list */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: C.lime }}></div>
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>Carregando fórum...</p>
          </div>
        ) : sortedTopics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <MessageSquare size={36} style={{ color: `${C.cream}20` }} />
            <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: `${C.cream}40` }}>Nenhum tópico nesta categoria.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedTopics.map((topic) => {
              const isPinned = Boolean(topic.is_pinned);
              return (
                <div key={topic.id} onClick={() => navigate(createPageUrl(`ForumTopic?id=${topic.id}`))} className="p-5 rounded-2xl transition-all hover:brightness-110 cursor-pointer" style={{ backgroundColor: C.card, border: `1px solid ${isPinned ? `${C.lime}22` : "rgba(255,255,222,0.06)"}` }}>
                  {isPinned && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.lime }} />
                      <span style={{ fontSize: 10, color: C.lime, fontWeight: 700, letterSpacing: "0.1em" }}>FIXADO</span>
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm" style={{ backgroundColor: C.orange, color: C.cream }}>
                      {(topic.author_name || 'E').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream, letterSpacing: "-0.01em" }}>{topic.title}</h3>
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: `${CATEGORY_INFO[topic.category]?.colorHex || C.lime}18`, color: CATEGORY_INFO[topic.category]?.colorHex || C.lime }}>
                          {CATEGORY_INFO[topic.category]?.name || topic.category}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: `${C.cream}50`, lineHeight: 1.5, marginBottom: 10 }} className="line-clamp-2">{topic.description}</p>
                      <div className="flex items-center flex-wrap gap-4">
                        <span style={{ fontSize: 11, color: `${C.cream}40` }}>{topic.author_name || 'Comunidade'}</span>
                        <span style={{ fontSize: 11, color: `${C.cream}25` }}>·</span>
                        <span style={{ fontSize: 11, color: `${C.cream}35` }}>{format(new Date(topic.created_at || new Date()), "dd MMM yyyy", { locale: ptBR })}</span>
                        <div className="ml-auto flex items-center gap-4">
                          <span className="flex items-center gap-1.5 transition-opacity hover:opacity-100 opacity-55" style={{ fontSize: 12, color: C.cream }}>
                            <Eye size={12} /> {topic.views || 0}
                          </span>
                          <span className="flex items-center gap-1.5 transition-opacity hover:opacity-100 opacity-55" style={{ fontSize: 12, color: C.cream }}>
                            <MessageCircle size={12} /> {topic.total_posts || 0}
                          </span>
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

      {/* Modal / Dialog */}
      <Dialog open={showNewTopicDialog} onOpenChange={setShowNewTopicDialog}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg p-0 border-0 bg-transparent overflow-hidden shadow-none">
          <DialogTitle className="sr-only">Novo Tópico</DialogTitle>
          <div className="w-full rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: `1px solid rgba(255,255,222,0.1)` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(255,255,222,0.07)` }}>
              <span style={{ ...heading, fontSize: 16, fontWeight: 700, color: C.cream }}>Novo Tópico</span>
              <button onClick={() => setShowNewTopicDialog(false)} style={{ color: `${C.cream}50` }} className="hover:opacity-100 transition-opacity"><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleCreateTopic} className="p-6 flex flex-col gap-4">
              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>TÍTULO</label>
                <input className="mt-2 w-full px-4 py-3 rounded-xl outline-none" style={{ backgroundColor: "#2E2E2C", border: `1px solid rgba(255,255,222,0.1)`, color: C.cream, ...body, fontSize: 14 }} placeholder="O que você quer discutir?" value={newTopic.title} onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} required />
              </div>
              <div>
                <label style={{ ...body, fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.06em" }}>CATEGORIA</label>
                <div className="relative mt-2">
                  <select
                    className="w-full px-4 py-3 rounded-xl outline-none appearance-none pr-10"
                    style={{ backgroundColor: "#2E2E2C", border: `1px solid rgba(255,255,222,0.1)`, color: newTopic.category ? C.cream : `${C.cream}40`, ...body, fontSize: 14 }}
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
                <textarea className="mt-2 w-full px-4 py-3 rounded-xl outline-none resize-none" rows={4} style={{ backgroundColor: "#2E2E2C", border: `1px solid rgba(255,255,222,0.1)`, color: C.cream, ...body, fontSize: 14 }} placeholder="Compartilhe seus pensamentos..." value={newTopic.description} onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })} required />
              </div>
              <button type="submit" disabled={createTopicMutation.isPending} className="flex items-center justify-center gap-2 w-full h-12 rounded-xl transition-all hover:brightness-110 mt-2 disabled:opacity-50" style={{ backgroundColor: C.lime, color: C.black, ...heading, fontWeight: 700, fontSize: 14 }}>
                <Send size={15} /> {createTopicMutation.isPending ? 'Publicando...' : 'Publicar'}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
