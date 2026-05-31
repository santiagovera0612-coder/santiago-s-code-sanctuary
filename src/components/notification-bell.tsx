import { useEffect, useMemo, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Bot, ShoppingBag, ShieldCheck, Plug, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  getActivityFeed,
  formatRelative,
  countUnread,
  getLastReadAt,
  markAllRead,
  type ActivityItem,
} from "@/lib/clerivo-activity";

const ICONS = {
  agent: Bot,
  product: ShoppingBag,
  rule: ShieldCheck,
  integration: Plug,
} as const;

function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const node = ref.current;
      if (!node) return;
      if (node.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [ref, handler, enabled]);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const errorShownRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await getActivityFeed());
      errorShownRef.current = false;
    } catch (error) {
      if (!errorShownRef.current) {
        toast.error("No pudimos cargar la actividad reciente.");
        errorShownRef.current = true;
      }
    }
    setLastRead(getLastReadAt());
    setMounted(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!mounted) return;
    const onStorage = () => void refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("clerivo:activity", onStorage as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("clerivo:activity", onStorage as EventListener);
    };
  }, [mounted, refresh]);

  const unread = useMemo(() => countUnread(items, lastRead), [items, lastRead]);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, close, open);

  // Mark as read shortly after opening so the user has a moment to see
  // the "unread" tint, but the counter is consistent next time.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      markAllRead();
      setLastRead(getLastReadAt());
    }, 350);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const handleMarkAll = () => {
    markAllRead();
    setLastRead(getLastReadAt());
  };

  const visible = items.slice(0, 5);
  const cutoff = lastRead ? new Date(lastRead).getTime() : 0;

  return (
    <div ref={wrapperRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
        {mounted && unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--cv-color-accent-red)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Actividad reciente"
          className="cv-card absolute right-0 top-[calc(100%+8px)] z-50 w-[min(360px,calc(100vw-1.5rem))] origin-top-right overflow-hidden p-0 animate-pop"
          style={{ boxShadow: "0 10px 38px -10px rgba(0,0,0,0.18), 0 6px 18px rgba(0,0,0,0.08)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="font-display text-sm font-semibold text-foreground">
                Actividad reciente
              </p>
              {unread > 0 && (
                <span className="rounded-full bg-[var(--cv-color-primary-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--cv-color-primary)] dark:bg-[color:color-mix(in_oklab,var(--primary)_22%,transparent)] dark:text-[color:var(--primary-glow)]">
                  {unread} nueva{unread > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={items.length === 0}
              className="text-xs font-semibold text-[var(--cv-color-primary)] transition hover:text-[var(--cv-color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[color:var(--primary-glow)]"
            >
              Marcar como leído
            </button>
          </div>

          {/* List */}
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="cv-tile mb-3">
                <Inbox className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">Sin actividad reciente</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tus próximos eventos aparecerán acá.
              </p>
            </div>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto py-1">
              {visible.map((item) => {
                const Icon = ICONS[item.icon] ?? Bell;
                const isUnread = new Date(item.ts).getTime() > cutoff;
                return (
                  <li key={item.id}>
                    <div
                      className={`flex items-start gap-3 px-4 py-3 transition ${
                        isUnread
                          ? "bg-[var(--cv-color-primary-light)]/40 dark:bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)]"
                          : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                          item.icon === "agent"
                            ? "cv-tile"
                            : item.icon === "product"
                              ? "cv-tile cv-tile-orange"
                              : item.icon === "rule"
                                ? "cv-tile cv-tile-green"
                                : "cv-tile cv-tile-blue"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm leading-tight ${
                            isUnread
                              ? "font-semibold text-foreground"
                              : "font-medium text-muted-foreground"
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground/80">
                          {formatRelative(item.ts)}
                        </p>
                      </div>
                      {isUnread && (
                        <span
                          aria-hidden
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--cv-color-primary)]"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="border-t border-border bg-[var(--cv-color-bg)] px-4 py-2.5 dark:bg-[color:var(--surface)]">
            <Link
              to="/app/dashboard"
              onClick={close}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-[var(--cv-color-primary)] transition hover:text-[var(--cv-color-primary-hover)] dark:text-[color:var(--primary-glow)]"
            >
              Ver toda la actividad
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
