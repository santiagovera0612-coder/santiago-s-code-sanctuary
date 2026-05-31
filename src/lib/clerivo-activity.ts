import { apiGet } from "./api-client";

export type ActivityKind =
  | "agent_created"
  | "agent_updated"
  | "product_added"
  | "rule_updated"
  | "integration_pending";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle?: string;
  ts: string;
  icon: "agent" | "product" | "rule" | "integration";
};

const NOTIF_READ_KEY = "clerivo:notifications:lastReadAt";

export function touchActivity(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("clerivo:activity"));
}

export async function getActivityFeed(): Promise<ActivityItem[]> {
  if (typeof window === "undefined") return [];
  const { items } = await apiGet<{ items: ActivityItem[] }>("activity");
  return items;
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Recientemente";
  const diff = Math.max(0, now.getTime() - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Justo ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Hace ${d} d`;
  const w = Math.floor(d / 7);
  if (w < 4) return `Hace ${w} sem`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `Hace ${mo} mes${mo > 1 ? "es" : ""}`;
  return `Hace ${Math.floor(mo / 12)} a`;
}

export function getLastReadAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(NOTIF_READ_KEY);
  } catch {
    return null;
  }
}

export function markAllRead(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIF_READ_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function countUnread(items: ActivityItem[], lastRead: string | null): number {
  if (!items.length) return 0;
  if (!lastRead) return items.length;
  const cutoff = new Date(lastRead).getTime();
  return items.filter((i) => new Date(i.ts).getTime() > cutoff).length;
}
