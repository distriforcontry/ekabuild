"use client";
import * as React from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { NotificationItem, User } from "@/lib/types";
import { useI18n } from "@/i18n/client";

// ───────────── current user ─────────────

type UserCtx = { user: User; setUser: (u: User) => void };
const UserContext = React.createContext<UserCtx | null>(null);

export function useCabinetUser(): UserCtx {
  const ctx = React.useContext(UserContext);
  if (!ctx) throw new Error("useCabinetUser must be used inside <CabinetProviders>");
  return ctx;
}

// ───────────── notifications (shared by the bell, the sidebar badge and the page) ─────────────

type NotifCtx = {
  items: NotificationItem[];
  unread: number;
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};
const NotificationsContext = React.createContext<NotifCtx | null>(null);

export function useNotifications(): NotifCtx {
  const ctx = React.useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <CabinetProviders>");
  return ctx;
}

const POLL_MS = 60_000;

export function CabinetProviders({ user: initialUser, children }: { user: User; children: React.ReactNode }) {
  const { t } = useI18n();
  const [user, setUser] = React.useState(initialUser);
  React.useEffect(() => setUser(initialUser), [initialUser]);

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  const reload = React.useCallback(async () => {
    try {
      const res = await api.get<{ items: NotificationItem[]; unread: number }>("/notifications");
      const list = Array.isArray(res?.items) ? res.items : [];
      setItems(list);
      setUnread(typeof res?.unread === "number" ? res.unread : list.filter((n) => !n.readAt).length);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
    const id = setInterval(() => document.visibilityState === "visible" && void reload(), POLL_MS);
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const markRead = React.useCallback(async (id: string) => {
    let changed = false;
    setItems((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.readAt) {
          changed = true;
          return { ...n, readAt: new Date().toISOString() };
        }
        return n;
      }),
    );
    if (changed) setUnread((u) => Math.max(0, u - 1));
    try {
      await api.post(`/notifications/${id}/read`);
    } catch {
      /* optimistic — the next poll reconciles */
    }
  }, []);

  const markAllRead = React.useCallback(async () => {
    const now = new Date().toISOString();
    const snapshot = { items, unread };
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    try {
      await api.post("/notifications/read-all");
      toast.success(t("app.notifications.allRead"));
    } catch {
      setItems(snapshot.items);
      setUnread(snapshot.unread);
      toast.error(t("common.errors.generic"));
    }
  }, [items, unread, t]);

  const notif = React.useMemo<NotifCtx>(
    () => ({ items, unread, loading, error, reload, markRead, markAllRead }),
    [items, unread, loading, error, reload, markRead, markAllRead],
  );
  const userCtx = React.useMemo(() => ({ user, setUser }), [user]);

  return (
    <UserContext.Provider value={userCtx}>
      <NotificationsContext.Provider value={notif}>{children}</NotificationsContext.Provider>
    </UserContext.Provider>
  );
}
