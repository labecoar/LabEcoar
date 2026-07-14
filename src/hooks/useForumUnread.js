import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { forumService } from "@/services/forum.service";

const STORAGE_PREFIX = "labecoar-forum-seen-topics";
const listeners = new Set();

const readSeenMap = (storageKey) => {
  if (typeof window === "undefined" || !storageKey) return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeSeenMap = (storageKey, map) => {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener());
};

const subscribeForumSeen = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const getTopicActivityMs = (topic) => {
  const activityMs = new Date(topic?.last_activity || topic?.created_at || 0).getTime();
  return Number.isNaN(activityMs) ? 0 : activityMs;
};

const isOwnLatestActivity = (topic, user) => {
  if (!user?.id && !user?.email) return false;

  const lastPost = topic?.last_post;
  if (lastPost) {
    if (lastPost.author_id && user.id && lastPost.author_id === user.id) return true;
    if (lastPost.author_email && user.email && lastPost.author_email === user.email) return true;
    return false;
  }

  // Tópico novo sem respostas: autor do tópico não recebe alerta da própria criação
  if (topic?.author_id && user.id && topic.author_id === user.id) return true;
  if (topic?.author_email && user.email && topic.author_email === user.email) return true;
  return false;
};

const isTopicUnread = (topic, seenMap, user) => {
  if (!topic?.id) return false;
  // Sem baseline ainda: não sinaliza histórico na primeira carga
  if (!seenMap || Object.keys(seenMap).length === 0) return false;
  // Quem criou a última atividade não recebe alerta dela
  if (isOwnLatestActivity(topic, user)) return false;

  const activityMs = getTopicActivityMs(topic);
  if (!activityMs) return false;
  const seenAt = seenMap[topic.id];
  if (!seenAt) return true; // tópico novo depois do baseline
  const seenMs = new Date(seenAt).getTime();
  if (Number.isNaN(seenMs)) return true;
  return activityMs > seenMs;
};

/**
 * Indicador de novidade no fórum (sidebar + cards de tópico).
 * Guarda por tópico o último momento em que o usuário abriu aquele tópico.
 */
export function useForumUnread() {
  const { user, profile } = useAuth();
  const currentUser = useMemo(
    () => ({
      id: user?.id || null,
      email: profile?.email || user?.email || null,
    }),
    [user?.id, user?.email, profile?.email]
  );

  const storageKey = useMemo(
    () => (user?.id ? `${STORAGE_PREFIX}:${user.id}` : null),
    [user?.id]
  );

  const getSnapshot = useCallback(() => {
    if (!storageKey) return "{}";
    try {
      return window.localStorage.getItem(storageKey) || "{}";
    } catch {
      return "{}";
    }
  }, [storageKey]);

  const seenRaw = useSyncExternalStore(subscribeForumSeen, getSnapshot, () => "{}");
  const seenMap = useMemo(() => {
    try {
      const parsed = JSON.parse(seenRaw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }, [seenRaw]);

  const { data: topics = [] } = useQuery({
    queryKey: ["forum-topics"],
    queryFn: () => forumService.getTopics(),
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  // Primeira visita: marca todos os tópicos atuais como vistos (não sinaliza histórico)
  useEffect(() => {
    if (!storageKey || !topics.length) return;
    const current = readSeenMap(storageKey);
    if (Object.keys(current).length > 0) return;

    const baseline = {};
    const now = new Date().toISOString();
    topics.forEach((topic) => {
      if (topic?.id) baseline[topic.id] = now;
    });
    writeSeenMap(storageKey, baseline);
  }, [storageKey, topics]);

  const unreadTopicIds = useMemo(() => {
    const ids = new Set();
    topics.forEach((topic) => {
      if (isTopicUnread(topic, seenMap, currentUser)) ids.add(topic.id);
    });
    return ids;
  }, [topics, seenMap, currentUser]);

  const hasUnread = unreadTopicIds.size > 0;

  const isTopicUnreadById = useCallback(
    (topicId) => unreadTopicIds.has(topicId),
    [unreadTopicIds]
  );

  const isTopicUnreadItem = useCallback(
    (topic) => isTopicUnread(topic, seenMap, currentUser),
    [seenMap, currentUser]
  );

  const markTopicSeen = useCallback(
    (topicId) => {
      if (!storageKey || !topicId) return;
      const current = readSeenMap(storageKey);
      writeSeenMap(storageKey, {
        ...current,
        [topicId]: new Date().toISOString(),
      });
    },
    [storageKey]
  );

  const markForumSeen = useCallback(() => {
    if (!storageKey || !topics.length) return;
    const current = readSeenMap(storageKey);
    const next = { ...current };
    const now = new Date().toISOString();
    topics.forEach((topic) => {
      if (topic?.id) next[topic.id] = now;
    });
    writeSeenMap(storageKey, next);
  }, [storageKey, topics]);

  return {
    hasUnread,
    unreadTopicIds,
    isTopicUnread: isTopicUnreadItem,
    isTopicUnreadById,
    markTopicSeen,
    markForumSeen,
  };
}
