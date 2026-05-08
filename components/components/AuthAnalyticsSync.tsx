import React, { useEffect, useRef } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

export function AuthAnalyticsSync() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const syncAuthActivity = useMutation(api.users.syncAuthActivity);
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !me?._id) return;
    if (syncedUserIdRef.current === me._id) return;
    syncedUserIdRef.current = me._id;
    void syncAuthActivity({});
  }, [isAuthenticated, isLoading, me?._id, syncAuthActivity]);

  useEffect(() => {
    if (isAuthenticated) return;
    syncedUserIdRef.current = null;
  }, [isAuthenticated]);

  return null;
}
