import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Escuta inserts/updates no fórum via Supabase Realtime
 * e invalida o cache do React Query → alerta quase instantâneo.
 *
 * Requer as tabelas na publication realtime (ver supabase-schema.sql).
 */
export function useForumRealtime(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    const channel = supabase
      .channel("forum-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "forum_posts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["forum-topics"] });
          queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
          queryClient.invalidateQueries({ queryKey: ["forum-topic"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "forum_topics" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["forum-topics"] });
          queryClient.invalidateQueries({ queryKey: ["forum-topic"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
