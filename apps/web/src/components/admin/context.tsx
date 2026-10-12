"use client";
import * as React from "react";
import type { Role } from "@eka/shared";
import type { SupportCommand, SupportEvent } from "@/lib/realtime";
import type { SupportStats } from "./types";

export type AdminUser = {
  id: string;
  fullName: string;
  phone?: string | null;
  role: Role;
  avatarUrl?: string | null;
  organization?: { name: string } | null;
};

export type AdminCounts = {
  pendingOrgs: number;
  pendingProjects: number;
  pendingCertificates: number;
  pendingDocuments: number;
  openComplaints: number;
};

export type RealtimeStatus = "idle" | "connecting" | "open" | "closed";

export type AdminContextValue = {
  user: AdminUser;
  counts: AdminCounts | null;
  supportStats: SupportStats | null;
  /** re-fetch sidebar badges after a moderation action */
  refreshCounts: () => void;
  realtime: {
    status: RealtimeStatus;
    send: (cmd: SupportCommand) => void;
    /** listen to support socket events; returns an unsubscribe fn */
    subscribe: (fn: (e: SupportEvent) => void) => () => void;
  };
};

export const AdminContext = React.createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = React.useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminShell>");
  return ctx;
}

/** Subscribe to support socket events for the lifetime of the component. */
export function useSupportEvents(handler: (e: SupportEvent) => void) {
  const { subscribe } = useAdmin().realtime;
  const ref = React.useRef(handler);
  ref.current = handler;
  React.useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}
