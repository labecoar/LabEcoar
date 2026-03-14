// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateForumTopic, useForumTopics } from "@/hooks/useForum";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Plus, Eye, Pin,
  Lightbulb, HelpCircle, Award, Megaphone, Hash, Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORY_INFO = {
  dicas: { name: "Dicas", icon: Lightbulb, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  duvidas: { name: "Dúvidas", icon: HelpCircle, color: "bg-blue-100 text-blue-700 border-blue-200" },
  conquistas: { name: "Conquistas", icon: Award, color: "bg-purple-100 text-purple-700 border-purple-200" },
  campanhas: { name: "Campanhas", icon: Megaphone, color: "bg-green-100 text-green-700 border-green-200" },
  geral: { name: "Geral", icon: Hash, color: "bg-gray-100 text-gray-700 border-gray-200" },
  sugestoes: { name: "Sugestões", icon: Sparkles, color: "bg-pink-100 text-pink-700 border-pink-200" }
};

export default function Forum() {
  const { user, profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [showNewTopicDialog, setShowNewTopicDialog] = useState(false);
  const [newTopic, setNewTopic] = useState({
    title: "",
    description: "",
    category: "geral"
  });

  const { data: topics = [], isLoading } = useForumTopics();
  const createTopicMutation = useCreateForumTopic();

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
      alert(error?.message || 'Não foi possível criar o tópico.');
    }
  };

  const filteredTopics = useMemo(
    () => selectedCategory === "todas"
      ? topics
      : topics.filter((topic) => topic.category === selectedCategory),
    [topics, selectedCategory]
  );

  const pinnedTopics = filteredTopics.filter((t) => Boolean(t.is_pinned));
  const regularTopics = filteredTopics.filter((t) => !t.is_pinned);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-emerald-700 mb-2 inline-flex items-center gap-2">
              Fórum Ecoantes
              <MessageSquare className="w-7 h-7" />
            </h1>
            <p className="text-gray-600">Converse, compartilhe e aprenda com outros Ecoantes</p>
          </div>

          <Dialog open={showNewTopicDialog} onOpenChange={setShowNewTopicDialog}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Tópico
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Tópico</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTopic} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    placeholder="Qual é o assunto?"
                    value={newTopic.title}
                    onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={newTopic.category}
                    onValueChange={(value) => setNewTopic({ ...newTopic, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          {info.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o tópico..."
                    value={newTopic.description}
                    onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
                    className="h-32"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowNewTopicDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={createTopicMutation.isPending}
                  >
                    {createTopicMutation.isPending ? 'Criando...' : 'Criar Tópico'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6 shadow-lg border-emerald-100 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="flex flex-wrap h-auto gap-2 bg-emerald-50 p-2">
                <TabsTrigger value="todas" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  Todas
                </TabsTrigger>
                {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                  >
                    <info.icon className="w-4 h-4 mr-1" />
                    {info.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {pinnedTopics.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                <Pin className="w-4 h-4" />
                Tópicos Fixados
              </h2>
              {pinnedTopics.map((topic) => {
                const categoryInfo = CATEGORY_INFO[topic.category] || CATEGORY_INFO.geral;
                const CategoryIcon = categoryInfo.icon;

                return (
                  <Link key={topic.id} to={createPageUrl(`ForumTopic?id=${topic.id}`)}>
                    <Card className="shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl ${categoryInfo.color} flex items-center justify-center flex-shrink-0`}>
                            <CategoryIcon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Pin className="w-4 h-4 text-emerald-600" />
                                  <h3 className="font-bold text-gray-900 text-lg">{topic.title}</h3>
                                </div>
                                {topic.description && (
                                  <p className="text-gray-600 text-sm line-clamp-2">{topic.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" />
                                {topic.total_posts || 0} respostas
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {topic.views || 0} visualizações
                              </span>
                              <span>Por {topic.author_name || 'Comunidade'}</span>
                              {topic.last_activity && (
                                <span>• {format(new Date(topic.last_activity), "dd/MM/yyyy", { locale: ptBR })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {isLoading ? (
            <Card className="shadow-lg border-gray-200">
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Carregando tópicos...</p>
              </CardContent>
            </Card>
          ) : regularTopics.length > 0 ? (
            <div className="space-y-3">
              {pinnedTopics.length > 0 && (
                <h2 className="text-sm font-semibold text-gray-500 mt-6">Tópicos Recentes</h2>
              )}
              {regularTopics.map((topic) => {
                const categoryInfo = CATEGORY_INFO[topic.category] || CATEGORY_INFO.geral;
                const CategoryIcon = categoryInfo.icon;

                return (
                  <Link key={topic.id} to={createPageUrl(`ForumTopic?id=${topic.id}`)}>
                    <Card className="shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border-gray-200 hover:border-emerald-200">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl ${categoryInfo.color} flex items-center justify-center flex-shrink-0`}>
                            <CategoryIcon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-lg mb-1">{topic.title}</h3>
                                {topic.description && (
                                  <p className="text-gray-600 text-sm line-clamp-2">{topic.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" />
                                {topic.total_posts || 0} respostas
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {topic.views || 0} visualizações
                              </span>
                              <span>Por {topic.author_name || 'Comunidade'}</span>
                              {topic.last_activity && (
                                <span>• {format(new Date(topic.last_activity), "dd/MM/yyyy", { locale: ptBR })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="shadow-lg border-gray-200">
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-lg">Nenhum tópico nesta categoria ainda</p>
                <p className="text-gray-400 text-sm mt-2">Seja o primeiro a iniciar uma conversa!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
