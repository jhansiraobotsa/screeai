import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const POLL_MS = 45_000;

// Returns unread notification counts grouped by type, for highlighting nav/tabs.
export function useUnreadNotifications() {
  const { user } = useAuth();
  const [byType, setByType] = useState<Record<string, number>>({});

  const fetch = useCallback(async () => {
    if (!user?.email) return;
    const { data } = await supabase
      .from("notifications")
      .select("type")
      .eq("read", false);
    const counts: Record<string, number> = {};
    (data || []).forEach(n => { counts[n.type] = (counts[n.type] || 0) + 1; });
    setByType(counts);
  }, [user?.email]);

  useEffect(() => {
    fetch();
    const t = setInterval(fetch, POLL_MS);
    return () => clearInterval(t);
  }, [fetch]);

  return byType;
}