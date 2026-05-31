import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  Bot,
  User,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  ArrowLeft,
  ArrowRight,
  Instagram,
  MessageCircle,
  CheckCheck,
  Sparkles,
  X,
  Lightbulb,
  Target,
  ShoppingBag,
  Clock,
  HelpCircle,
  Tag,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { getStoredAgent, type StoredAgent } from "@/lib/clerivo-agent";
import { ApiError } from "@/lib/api-client";
import {
  fetchChatConversations,
  markChatRead,
  sendChatMessage,
  setChatHandler,
  subscribeToChatRealtime,
  type ChatChannel,
  type ChatConversation,
  type CustomerInfo,
  type LeadStatus,
} from "@/lib/clerivo-chats";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/chats")({
  head: () => ({ meta: [{ title: "Chats — Clerivo" }] }),
  component: ChatsPage,
});

type Channel = "all" | ChatChannel;
type Conversation = ChatConversation;

/** Channel metadata — uses Lucide icons that already exist in the project. */
const channelMeta: Record<
  Exclude<Channel, "all">,
  { icon: typeof Instagram; label: string; dot: string; bg: string; fg: string }
> = {
  whatsapp: {
    icon: MessageCircle,
    label: "WhatsApp",
    dot: "bg-[#25D366]",
    bg: "bg-[#25D366]",
    fg: "text-white",
  },
  instagram: {
    icon: Instagram,
    label: "Instagram",
    dot: "bg-[#E4405F]",
    bg: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
    fg: "text-white",
  },
};

/** Lead status visual tokens. Colors come from the design spec. */
const leadMeta: Record<LeadStatus, { label: string; bg: string; fg: string; dot: string }> = {
  nuevo: {
    label: "Nuevo",
    bg: "bg-[#EFF6FF]",
    fg: "text-[#2563EB]",
    dot: "bg-[#2563EB]",
  },
  interesado: {
    label: "Interesado",
    bg: "bg-[var(--cv-color-primary-light)]",
    fg: "text-[var(--cv-color-primary)]",
    dot: "bg-[var(--cv-color-primary)]",
  },
  caliente: {
    label: "Caliente",
    bg: "bg-[#FEF2F2]",
    fg: "text-[#DC2626]",
    dot: "bg-[#DC2626]",
  },
  seguimiento: {
    label: "Seguimiento",
    bg: "bg-[#FFF7ED]",
    fg: "text-[#F97316]",
    dot: "bg-[#F97316]",
  },
  cliente: {
    label: "Cliente",
    bg: "bg-[#F0FDF4]",
    fg: "text-[#16A34A]",
    dot: "bg-[#16A34A]",
  },
  perdido: {
    label: "Perdido",
    bg: "bg-[#F3F4F6]",
    fg: "text-[#6B7280]",
    dot: "bg-[#9CA3AF]",
  },
};

const LEAD_FILTERS: Array<{ key: LeadStatus | "all"; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "nuevo", label: "Nuevo" },
  { key: "interesado", label: "Interesado" },
  { key: "caliente", label: "Caliente" },
  { key: "seguimiento", label: "Seguimiento" },
  { key: "cliente", label: "Cliente" },
  { key: "perdido", label: "Perdido" },
];

type MetaGraphError = {
  message?: string;
  code?: number | string;
  error_subcode?: number | string;
  type?: string;
};

function parseMetaGraphError(detail?: string): MetaGraphError | null {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as MetaGraphError) : null;
  } catch {
    return null;
  }
}

function chatApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const meta = parseMetaGraphError(error.detail);
    if (String(meta?.code) === "190") {
      return `${fallback}: el token de Meta expiro o ya no es valido. Renovalo en Integraciones.`;
    }
    if (String(meta?.code) === "131030") {
      return `${fallback}: el numero no esta autorizado para este token de prueba. Agregalo en Meta, genera un token nuevo y guardalo en Integraciones.`;
    }
    if (String(meta?.code) === "131047") {
      return `${fallback}: pasaron mas de 24 horas desde el ultimo mensaje del cliente. Usa una plantilla de WhatsApp para reabrir la conversacion.`;
    }
    const detail = meta?.message || error.detail || error.code;
    return detail ? `${fallback}: ${detail}` : fallback;
  }
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}

function ChatsPage() {
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loadedAgent = await getStoredAgent();
        if (!alive) return;
        setAgent(loadedAgent);
      } catch {
        toast.error("No pudimos cargar los chats.");
        if (!alive) return;
        setAgent(null);
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!hydrated) return <ChatsSkeleton />;

  if (!agent) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
        <div className="mx-auto max-w-md text-center surface-card p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
            <Bot className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold">Primero configurá tu Agente IA</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configurá tu agente para ver cómo se organizarían tus conversaciones.
          </p>
          <Button asChild className="mt-5 h-11 rounded-lg">
            <Link to="/app/create">
              Crear Agente IA <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <ChatsInner agent={agent} />;
}

/** Mobile flow: 3 stacked screens (list → chat → info), each slide-in
 *  from the right. Desktop renders everything as columns simultaneously. */
type MobileScreen = "list" | "chat" | "info";

function ChatsInner({ agent }: { agent: StoredAgent }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loadingChats, setLoadingChats] = useState(true);
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<Channel>("all");
  const [leadFilter, setLeadFilter] = useState<LeadStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  /** Desktop: toggles the right-side customer info column. */
  const [showInfo, setShowInfo] = useState(false);
  /** Mobile screen stack. */
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>("list");

  const scrollRef = useRef<HTMLDivElement>(null);
  const realtimeErrorShown = useRef(false);

  const mergeConversation = useCallback((updated: Conversation) => {
    setConversations((prev) => {
      const exists = prev.some((item) => item.id === updated.id);
      if (!exists) return [updated, ...prev];
      return [updated, ...prev.filter((item) => item.id !== updated.id)];
    });
  }, []);

  const refreshChats = useCallback(async (showError = true) => {
    try {
      const loaded = await fetchChatConversations();
      setConversations(loaded);
      setActiveId((current) => {
        if (current && loaded.some((item) => item.id === current)) return current;
        return loaded[0]?.id ?? "";
      });
    } catch {
      if (showError) toast.error("No pudimos cargar las conversaciones.");
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    void refreshChats();
    const unsubscribe = subscribeToChatRealtime(
      () => void refreshChats(false),
      () => {
        if (!realtimeErrorShown.current) {
          toast.error("No pudimos mantener los chats en tiempo real.");
          realtimeErrorShown.current = true;
        }
      },
    );
    return unsubscribe;
  }, [refreshChats]);

  /** Mobile flicker fix: previously a scroll event listener animated the
   *  filters block hide/show on scroll, which caused per-frame relayouts
   *  and visible flicker. Replaced by **native browser sticky**: the
   *  whole mobile screen 1 lives inside a single scroll container; the
   *  header uses `position: sticky` so the browser's compositor keeps it
   *  pinned with zero JS, and the filters scroll out naturally as part
   *  of the page content. No listener, no rAF, no flicker. */

  /** Desktop-only: collapsible dropdown for the Leads filter.
   *  Renders as a small pill on the left column and expands into a
   *  floating panel with all the lead chips when clicked. Click-outside
   *  and Escape close it. */
  const [leadsOpen, setLeadsOpen] = useState(false);
  const leadsDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!leadsOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const node = leadsDropdownRef.current;
      if (!node) return;
      if (node.contains(e.target as Node)) return;
      setLeadsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLeadsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [leadsOpen]);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (channel !== "all" && c.channel !== channel) return false;
      if (leadFilter !== "all" && c.lead !== leadFilter) return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [conversations, channel, leadFilter, query]);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [active?.messages.length, activeId]);

  const counts = useMemo(() => {
    return {
      all: conversations.length,
      whatsapp: conversations.filter((c) => c.channel === "whatsapp").length,
      instagram: conversations.filter((c) => c.channel === "instagram").length,
    };
  }, [conversations]);

  const send = async () => {
    if (!draft.trim() || !active) return;
    const text = draft.trim();
    setSending(true);
    try {
      const updated = await sendChatMessage(active.id, text);
      mergeConversation(updated);
      setActiveId(updated.id);
      setDraft("");
    } catch (error) {
      toast.error(chatApiErrorMessage(error, "No pudimos enviar el mensaje"));
    } finally {
      setSending(false);
    }
  };

  const toggleHandler = async () => {
    if (!active) return;
    try {
      const updated = await setChatHandler(active.id, active.handler === "bot" ? "human" : "bot");
      mergeConversation(updated);
    } catch {
      toast.error("No pudimos cambiar el modo de respuesta.");
    }
  };

  const openConversation = async (id: string) => {
    setActiveId(id);
    setMobileScreen("chat");
    try {
      const updated = await markChatRead(id);
      mergeConversation(updated);
    } catch {
      toast.error("No pudimos marcar el chat como leído.");
    }
  };

  const agentLabel = agent.agentName || "Agente IA";

  if (loadingChats) return <ChatsSkeleton />;

  /* ============ MOBILE rendering ============ */
  const MobileView = (
    <div className="relative flex h-full w-full overflow-hidden md:hidden">
      {/* Screen 1 — list. One outer scroll container with native sticky
          header. Filters scroll out as content; the title bar stays
          pinned by the browser compositor — zero JS, zero flicker. */}
      {mobileScreen === "list" && (
        <motion.div
          key="m-list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="scrollbar-clerivo flex h-full w-full flex-col overflow-y-auto bg-white"
        >
          <MobileListHeader />
          {SearchAndFilters("mobile")}
          <ConversationList list={filtered} activeId={activeId} onOpen={openConversation} inline />
        </motion.div>
      )}

      {/* Screen 2 — conversation */}
      <AnimatePresence>
        {mobileScreen === "chat" && active && (
          <motion.div
            key="m-chat"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col bg-[var(--cv-color-bg)]"
          >
            <ChatHeader
              conv={active}
              agentLabel={agentLabel}
              onBack={() => setMobileScreen("list")}
              onToggleHandler={toggleHandler}
              onOpenInfo={() => setMobileScreen("info")}
              compact
            />
            <MessagesArea conv={active} scrollRef={scrollRef} />
            {active.handler === "bot" && <AutomaticBanner onTakeOver={toggleHandler} />}
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={send}
              disabled={active.handler === "bot" || sending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 3 — info */}
      <AnimatePresence>
        {mobileScreen === "info" && active && (
          <motion.div
            key="m-info"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col bg-[var(--cv-color-bg)]"
          >
            <CustomerInfoHeader
              onBack={() => setMobileScreen("chat")}
              onClose={() => setMobileScreen("list")}
            />
            <CustomerInfoBody conv={active} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /* ============ DESKTOP rendering ============ */
  const DesktopView = (
    <div className="hidden h-full w-full md:flex">
      {/* LEFT — chat list */}
      <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-[var(--cv-color-border)] bg-white">
        <div className="px-4 pt-4">
          <h1
            className="text-[20px] font-extrabold leading-tight text-[var(--cv-color-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Chats
          </h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--cv-color-text-secondary)]">
            Organizá conversaciones y detectá oportunidades.
          </p>
        </div>
        {SearchAndFilters("desktop")}
        <ConversationList list={filtered} activeId={activeId} onOpen={openConversation} />
      </aside>

      {/* CENTER — conversation */}
      {active ? (
        <section className="flex h-full flex-1 min-w-0 flex-col bg-[var(--cv-color-bg)]">
          <ChatHeader
            conv={active}
            agentLabel={agentLabel}
            onToggleHandler={toggleHandler}
            onOpenInfo={() => setShowInfo((v) => !v)}
            infoOpen={showInfo}
          />
          <MessagesArea conv={active} scrollRef={scrollRef} />
          {active.handler === "bot" && <AutomaticBanner onTakeOver={toggleHandler} />}
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={send}
            disabled={active.handler === "bot" || sending}
          />
        </section>
      ) : (
        <section className="flex h-full flex-1 min-w-0 items-center justify-center bg-[var(--cv-color-bg)] px-6 text-center">
          <div>
            <MessageCircle className="mx-auto h-9 w-9 text-[var(--cv-color-text-muted)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--cv-color-text-primary)]">
              Sin conversaciones
            </p>
            <p className="mt-1 max-w-xs text-xs text-[var(--cv-color-text-muted)]">
              Cuando lleguen chats reales aparecerán acá.
            </p>
          </div>
        </section>
      )}

      {/* RIGHT — customer info (slide-in) */}
      <AnimatePresence>
        {showInfo && active && (
          <motion.aside
            key="info-panel"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="flex h-full w-[300px] shrink-0 flex-col border-l border-[var(--cv-color-border)] bg-white"
          >
            <CustomerInfoHeader onBack={() => setShowInfo(false)} />
            <CustomerInfoBody conv={active} />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );

  /* ============ Inline sub-components (closures over state) ============ */

  /** Converts a vertical mouse wheel event into horizontal scroll on the
   *  current target. Lets desktop users without a horizontal-capable
   *  input (regular mouse wheel) navigate the channel + leads chip rows.
   *  Only acts when the user is not pressing shift (browser already
   *  handles shift+wheel as horizontal). */
  function wheelToHorizontalScroll(e: React.WheelEvent<HTMLDivElement>) {
    if (e.shiftKey) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.currentTarget.scrollLeft += e.deltaY;
  }

  /** Mobile list header — sticky top, no filter icon (per spec).
   *  Stays visible while the filters section below collapses on scroll. */
  function MobileListHeader() {
    return (
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--cv-color-border)] bg-white px-4 py-3">
        <Link
          to="/app/dashboard"
          aria-label="Volver al panel"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-primary)] hover:bg-[var(--cv-color-bg)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1
            className="text-[20px] font-extrabold leading-tight text-[var(--cv-color-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Chats
          </h1>
          <p className="truncate text-[12px] text-[var(--cv-color-text-secondary)]">
            Organizá conversaciones y detectá oportunidades.
          </p>
        </div>
      </div>
    );
  }

  /** Renders the search + channel chips + leads filter. Takes an explicit
   *  `mode` so that the dropdown ref / mobile chip row are each rendered
   *  ONLY ONCE in the DOM. Previously this component was rendered twice
   *  (once for desktop, once for mobile) and both instances attached
   *  themselves to the same `leadsDropdownRef`. Whichever mounted last
   *  won — typically the mobile (hidden) copy — which made the
   *  click-outside listener mark every chip click as "outside" and
   *  close the panel instead of applying the filter. Splitting by mode
   *  guarantees the ref attaches to the single visible dropdown.
   *
   *  Also: this is now called as a plain function (`SearchAndFilters("...")`)
   *  rather than rendered as JSX `<SearchAndFilters />`. Because the
   *  function is defined inside `ChatsInner`, a fresh function reference
   *  is created on every render — used as a JSX component that would
   *  force React to unmount/remount the whole subtree on every state
   *  change. Calling it as a function inlines the JSX directly, so
   *  React's diff sees stable DOM and keeps refs / focus intact. */
  function SearchAndFilters(mode: "desktop" | "mobile") {
    return (
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cv-color-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversaciones"
            className="h-10 w-full rounded-[10px] border border-[var(--cv-color-border)] bg-white pl-9 pr-3 text-[13px] text-[var(--cv-color-text-primary)] placeholder:text-[var(--cv-color-text-muted)] focus:border-[var(--cv-color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--cv-color-primary)]/10"
          />
        </div>

        {/* Channel chips — smaller pills so the 3 fit in the 340px column,
            with horizontal scroll fallback if they ever overflow. */}
        <div
          className="scrollbar-hide mt-3 flex gap-1.5 overflow-x-auto whitespace-nowrap"
          onWheel={wheelToHorizontalScroll}
        >
          {(["all", "whatsapp", "instagram"] as const).map((k) => {
            const isActive = channel === k;
            const label = k === "all" ? "Todos" : channelMeta[k].label;
            return (
              <button
                key={k}
                onClick={() => setChannel(k)}
                className={`flex h-7 shrink-0 items-center gap-1 rounded-full border px-2 text-[12px] font-semibold transition ${
                  isActive
                    ? "border-[var(--cv-color-primary)] bg-[var(--cv-color-primary)] text-white"
                    : "border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-primary)] hover:bg-[var(--cv-color-bg)]"
                }`}
              >
                {k === "whatsapp" && (
                  <MessageCircle className={`h-3 w-3 ${isActive ? "" : "text-[#25D366]"}`} />
                )}
                {k === "instagram" && (
                  <Instagram className={`h-3 w-3 ${isActive ? "" : "text-[#E4405F]"}`} />
                )}
                {label}
                <span
                  className={`-mr-0.5 rounded-full px-1.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-white/20"
                      : "bg-[var(--cv-color-bg)] text-[var(--cv-color-text-muted)]"
                  }`}
                >
                  {counts[k]}
                </span>
              </button>
            );
          })}
        </div>

        {/* === MOBILE leads — single horizontal scrolling row (rendered only in mobile mode) === */}
        {mode === "mobile" && (
          <>
            <p className="mt-3 text-[12px] font-bold uppercase tracking-wider text-[var(--cv-color-text-primary)]">
              Leads
            </p>
            <div
              className="scrollbar-hide mt-1.5 flex gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5"
              onWheel={wheelToHorizontalScroll}
            >
              {LEAD_FILTERS.map((f) => {
                const isAll = f.key === "all";
                const meta = isAll ? null : leadMeta[f.key as LeadStatus];
                const isActive = leadFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setLeadFilter(f.key)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                      isActive
                        ? isAll
                          ? "border-[var(--cv-color-primary)] bg-[var(--cv-color-primary)] text-white"
                          : `${meta!.bg} ${meta!.fg} border-transparent`
                        : "border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-secondary)] hover:bg-[var(--cv-color-bg)]"
                    }`}
                  >
                    {meta && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-current" : meta.dot}`}
                      />
                    )}
                    {f.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* === DESKTOP leads — compact dropdown (rendered only in desktop mode) === */}
        {mode === "desktop" && (
          <div ref={leadsDropdownRef} className="relative mt-3">
            {(() => {
              const activeFilter =
                LEAD_FILTERS.find((f) => f.key === leadFilter) ?? LEAD_FILTERS[0];
              const isAll = activeFilter.key === "all";
              const activeMeta = isAll ? null : leadMeta[activeFilter.key as LeadStatus];
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setLeadsOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={leadsOpen}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[12px] font-semibold transition ${
                      isAll
                        ? "border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-primary)] hover:border-[var(--cv-color-primary)] hover:bg-[var(--cv-color-primary-light)]"
                        : "border-[var(--cv-color-primary)] bg-white text-[var(--cv-color-primary)] hover:bg-[var(--cv-color-primary-light)]"
                    }`}
                  >
                    {activeMeta && (
                      <span className={`h-1.5 w-1.5 rounded-full ${activeMeta.dot}`} />
                    )}
                    {isAll ? "Leads" : `Leads: ${activeFilter.label}`}
                    <ChevronDown
                      className="h-3.5 w-3.5 transition-transform duration-200 ease-out"
                      style={{
                        transform: leadsOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>

                  <AnimatePresence>
                    {leadsOpen && (
                      <motion.div
                        key="leads-panel"
                        role="menu"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute left-0 top-[calc(100%+6px)] z-50 flex min-w-[240px] max-w-[300px] flex-wrap gap-1.5 rounded-[12px] border border-[var(--cv-color-border)] bg-[var(--cv-color-surface)] p-3"
                        style={{
                          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        }}
                      >
                        {LEAD_FILTERS.map((f) => {
                          const dropdownIsAll = f.key === "all";
                          const meta = dropdownIsAll ? null : leadMeta[f.key as LeadStatus];
                          const isActive = leadFilter === f.key;
                          return (
                            <button
                              key={f.key}
                              type="button"
                              // Only apply the filter — the panel must stay
                              // open. Closing happens via click-outside or
                              // Escape (handled by the useEffect above).
                              onClick={() => setLeadFilter(f.key)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                                isActive
                                  ? dropdownIsAll
                                    ? "border-[var(--cv-color-primary)] bg-[var(--cv-color-primary)] text-white"
                                    : `${meta!.bg} ${meta!.fg} border-transparent`
                                  : "border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-secondary)] hover:bg-[var(--cv-color-bg)]"
                              }`}
                            >
                              {meta && (
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isActive ? "bg-current" : meta.dot
                                  }`}
                                />
                              )}
                              {f.label}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Heights are driven by a CSS class so a media query can flip
          between the mobile formula (subtract topbar + bottom nav from
          the dynamic viewport) and the desktop formula (only topbar).
          Inline style would override Tailwind's md: utilities by CSS
          spec, which was creating the empty band at the bottom of the
          desktop view. */}
      <style>{`
        .chats-shell-root {
          height: calc(100dvh - 64px - 80px);
        }
        @media (min-width: 768px) {
          .chats-shell-root {
            height: calc(100vh - 4rem);
          }
        }
      `}</style>
      <div className="chats-shell-root overflow-hidden bg-[var(--cv-color-bg)]">
        <div className="flex h-full w-full">
          {DesktopView}
          {MobileView}
        </div>
      </div>
    </>
  );
}

/* ============================================================
   Conversation list — used by both desktop sidebar and mobile.
   ============================================================ */
function ConversationList({
  list,
  activeId,
  onOpen,
  inline,
}: {
  list: Conversation[];
  activeId: string;
  onOpen: (id: string) => void | Promise<void>;
  /** When true, the list renders its items WITHOUT its own scroll
   *  container — relying on a parent scroll instead. Used by the mobile
   *  screen, where the whole page lives inside a single scroll so the
   *  browser can natively pin the sticky header. Desktop omits it and
   *  gets the default internal scroll. */
  inline?: boolean;
}) {
  if (list.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <MessageCircle className="h-8 w-8 text-[var(--cv-color-text-muted)]" />
        <p className="mt-3 text-[13px] font-semibold text-[var(--cv-color-text-primary)]">
          Sin conversaciones
        </p>
        <p className="mt-1 text-[12px] text-[var(--cv-color-text-muted)]">
          Cuando lleguen chats reales aparecerán acá.
        </p>
      </div>
    );
  }
  return (
    <div className={inline ? "pb-2" : "scrollbar-clerivo flex-1 overflow-y-auto pb-2"}>
      {list.map((c) => {
        const isActive = c.id === activeId;
        const ch = channelMeta[c.channel];
        const lead = leadMeta[c.lead];
        return (
          <button
            key={c.id}
            onClick={() => onOpen(c.id)}
            className={`group flex w-full items-start gap-2.5 border-b border-[var(--cv-color-border)]/50 border-l-[3px] px-4 py-4 text-left transition-colors duration-150 md:gap-2.5 md:px-3 md:py-2.5 ${
              isActive
                ? "border-l-[var(--cv-color-primary)] bg-[var(--cv-color-primary-light)]"
                : "border-l-transparent hover:bg-[var(--cv-color-bg)]"
            }`}
          >
            {/* Avatar + channel badge */}
            <div className="relative shrink-0">
              <div
                className={`flex h-[52px] w-[52px] items-center justify-center rounded-full text-[15px] font-bold text-white md:h-[42px] md:w-[42px] md:text-[13px] ${c.avatarBg}`}
              >
                {c.initials}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 flex h-[20px] w-[20px] items-center justify-center rounded-full ring-2 ring-white md:h-[14px] md:w-[14px] ${ch.bg}`}
                aria-label={ch.label}
              >
                {c.channel === "whatsapp" ? (
                  <MessageCircle className="h-3 w-3 text-white md:h-[8px] md:w-[8px]" />
                ) : (
                  <Instagram className="h-3 w-3 text-white md:h-[8px] md:w-[8px]" />
                )}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[15px] font-bold leading-tight text-[var(--cv-color-text-primary)] md:text-[14px] md:font-semibold">
                  {c.name}
                </p>
                <span
                  className={`shrink-0 text-[12px] leading-tight md:text-[11px] ${
                    c.unread > 0
                      ? "font-bold text-[var(--cv-color-primary)]"
                      : "text-[var(--cv-color-text-muted)]"
                  }`}
                >
                  {c.time}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 md:mt-0.5">
                <p className="truncate text-[13px] leading-snug text-[var(--cv-color-text-secondary)] md:text-[12px] md:leading-tight md:text-[var(--cv-color-text-muted)]">
                  {c.lastMessage}
                </p>
                {c.unread > 0 && (
                  <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--cv-color-primary)] px-1.5 text-[12px] font-bold text-white md:h-[18px] md:min-w-[18px] md:text-[11px]">
                    {c.unread}
                  </span>
                )}
              </div>
              <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[12px] font-semibold md:mt-1 md:h-[18px] md:px-[7px] md:py-[2px] md:text-[11px] ${lead.bg} ${lead.fg}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${lead.dot}`} />
                {lead.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Chat header
   ============================================================ */
function ChatHeader({
  conv,
  agentLabel,
  onBack,
  onToggleHandler,
  onOpenInfo,
  infoOpen,
  compact,
}: {
  conv: Conversation;
  agentLabel: string;
  onBack?: () => void;
  onToggleHandler: () => void | Promise<void>;
  onOpenInfo: () => void;
  infoOpen?: boolean;
  compact?: boolean;
}) {
  const ch = channelMeta[conv.channel];
  // agentLabel is currently unused inside the header — the toggle uses
  // the short "Auto" label. Kept in the prop so the API stays stable.
  void agentLabel;
  return (
    <header
      className={`flex shrink-0 items-center gap-2 border-b border-[var(--cv-color-border)] bg-white px-3 sm:gap-3 sm:px-4 ${
        compact ? "h-14" : "h-[60px]"
      }`}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-primary)] hover:bg-[var(--cv-color-bg)] md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      {/* Avatar + channel badge */}
      <div className="relative shrink-0">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white sm:h-10 sm:w-10 sm:text-[13px] ${conv.avatarBg}`}
        >
          {conv.initials}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${ch.bg}`}
        >
          {conv.channel === "whatsapp" ? (
            <MessageCircle className="h-2 w-2 text-white" />
          ) : (
            <Instagram className="h-2 w-2 text-white" />
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] font-bold leading-tight text-[var(--cv-color-text-primary)] sm:text-[14px]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {conv.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] sm:gap-1.5 sm:text-[11.5px]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              conv.channel === "whatsapp" ? "bg-[#25D366]" : "bg-[#E4405F]"
            }`}
          />
          <span
            className={`truncate font-semibold ${
              conv.channel === "whatsapp" ? "text-[#16A34A]" : "text-[#DC2626]"
            }`}
          >
            {ch.label}
          </span>
        </p>
      </div>

      {/* Auto / Humano toggle — compact pill, fixed max-width on mobile */}
      <div
        className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--cv-color-bg)] p-0.5"
        role="group"
        aria-label="Modo de respuesta"
        style={{ maxWidth: 140 }}
      >
        <button
          type="button"
          onClick={() => conv.handler !== "bot" && onToggleHandler()}
          className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-tight transition sm:px-3 sm:text-[12px] ${
            conv.handler === "bot"
              ? "bg-[var(--cv-color-primary)] text-white shadow-sm"
              : "text-[var(--cv-color-text-secondary)] hover:text-[var(--cv-color-text-primary)]"
          }`}
        >
          Auto
        </button>
        <button
          type="button"
          onClick={() => conv.handler !== "human" && onToggleHandler()}
          className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-tight transition sm:px-3 sm:text-[12px] ${
            conv.handler === "human"
              ? "bg-[var(--cv-color-primary)] text-white shadow-sm"
              : "text-[var(--cv-color-text-secondary)] hover:text-[var(--cv-color-text-primary)]"
          }`}
        >
          Humano
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenInfo}
        aria-label={infoOpen ? "Cerrar panel" : "Información del cliente"}
        className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${
          infoOpen
            ? "bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)]"
            : "text-[var(--cv-color-text-muted)] hover:bg-[var(--cv-color-bg)] hover:text-[var(--cv-color-text-primary)]"
        }`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </header>
  );
}

/* ============================================================
   Messages area
   ============================================================ */
function MessagesArea({
  conv,
  scrollRef,
}: {
  conv: Conversation;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={scrollRef}
      // CRITICAL: min-h-0 lets flex-1 actually constrain this child inside
      // a flex column. Without it the scroll area grows to fit content and
      // pushes the composer below the viewport — the "invisible input" bug.
      className="scrollbar-clerivo min-h-0 flex-1 overflow-y-auto bg-[var(--cv-color-bg)] px-4 py-4"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {conv.messages.map((m) => {
          const isClient = m.from === "client";
          if (isClient) {
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-start"
              >
                <div className="max-w-[80%]">
                  <div className="rounded-[14px] rounded-tl-[4px] border border-[var(--cv-color-border)] bg-white px-4 py-2.5 text-[13.5px] leading-relaxed text-[var(--cv-color-text-primary)]">
                    {m.text}
                  </div>
                  <p className="mt-1 pl-1 text-[10.5px] text-[var(--cv-color-text-muted)]">
                    {m.time}
                  </p>
                </div>
              </motion.div>
            );
          }
          // bot or human → align right
          const isBot = m.from === "bot";
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex justify-end"
            >
              <div className="max-w-[80%]">
                <div className="rounded-[14px] rounded-tr-[4px] bg-[var(--cv-color-primary)] px-4 py-2.5 text-[13.5px] leading-relaxed text-white">
                  {isBot && (
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold opacity-85">
                      <Sparkles className="h-3 w-3" /> CLERIVO
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                <p className="mt-1 flex items-center justify-end gap-1 pr-1 text-[10.5px] text-[var(--cv-color-text-muted)]">
                  {m.time} <CheckCheck className="h-3 w-3" />
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   "CLERIVO está respondiendo automáticamente" banner
   ============================================================ */
function AutomaticBanner({ onTakeOver }: { onTakeOver: () => void | Promise<void> }) {
  return (
    <div className="shrink-0 border-t border-[var(--cv-color-border)] bg-white px-4 py-2.5">
      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--cv-color-border)] bg-[var(--cv-color-primary-light)] px-3.5 py-2.5">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cv-color-primary)]" />
          <div>
            <p className="text-[12.5px] font-bold text-[var(--cv-color-text-primary)]">
              CLERIVO está respondiendo automáticamente.
            </p>
            <p className="text-[11.5px] text-[var(--cv-color-text-secondary)]">
              El agente usa las reglas y el tono definidos para esta conversación.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onTakeOver}
          className="shrink-0 rounded-[8px] border-[1.5px] border-[var(--cv-color-primary)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--cv-color-primary)] transition hover:bg-[var(--cv-color-primary-light)]"
        >
          Tomar control
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Message composer
   ============================================================ */
function Composer({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <footer className="shrink-0 border-t border-[var(--cv-color-border)] bg-white px-3 py-3 sm:px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          onSend();
        }}
        className="flex items-center gap-2"
      >
        <button
          type="button"
          aria-label="Adjuntar archivo"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[var(--cv-color-text-muted)] hover:bg-[var(--cv-color-bg)] hover:text-[var(--cv-color-text-primary)]"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Escribí un mensaje..."
            className="h-11 w-full rounded-[12px] border border-[var(--cv-color-border)] bg-white pl-4 pr-12 text-[13.5px] text-[var(--cv-color-text-primary)] placeholder:text-[var(--cv-color-text-muted)] focus:border-[var(--cv-color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--cv-color-primary)]/10 disabled:bg-[var(--cv-color-bg)] disabled:opacity-50"
          />
          <button
            type="button"
            aria-label="Emoji"
            disabled={disabled}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[var(--cv-color-text-muted)] hover:bg-[var(--cv-color-bg)] disabled:opacity-50"
          >
            <Smile className="h-4 w-4" />
          </button>
        </div>
        <button
          type="submit"
          aria-label="Enviar"
          disabled={disabled || !value.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--cv-color-primary)] text-white transition-all duration-150 hover:bg-[var(--cv-color-primary-hover)] hover:scale-105 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </footer>
  );
}

/* ============================================================
   Customer info header + body
   ============================================================ */
function CustomerInfoHeader({ onBack, onClose }: { onBack: () => void; onClose?: () => void }) {
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--cv-color-border)] bg-white px-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Cerrar panel"
        className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-primary)] hover:bg-[var(--cv-color-bg)]"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p
          className="text-[14px] font-bold leading-tight text-[var(--cv-color-text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Información del cliente
        </p>
        <p className="text-[11px] text-[var(--cv-color-text-muted)]">
          Resumen automático generado por CLERIVO
        </p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--cv-color-text-muted)] hover:bg-[var(--cv-color-bg)] hover:text-[var(--cv-color-text-primary)] md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </header>
  );
}

function CustomerInfoBody({ conv }: { conv: Conversation }) {
  const info = conv.info;
  const ch = channelMeta[conv.channel];
  const lead = leadMeta[conv.lead];
  const lastClient = [...conv.messages].reverse().find((m) => m.from === "client");

  // Helper to render a labeled row with icon + label + value
  const Row = ({
    icon: Icon,
    label,
    value,
    valuePill,
  }: {
    icon: typeof HelpCircle;
    label: string;
    value?: string;
    valuePill?: boolean;
  }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-2.5 py-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cv-color-text-muted)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[var(--cv-color-text-muted)]">{label}</p>
          {valuePill ? (
            <span className="mt-1 inline-block rounded-full bg-[var(--cv-color-primary-light)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--cv-color-primary)]">
              {value}
            </span>
          ) : (
            <p className="mt-0.5 text-[13px] font-medium text-[var(--cv-color-text-primary)]">
              {value}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="scrollbar-clerivo flex-1 space-y-3 overflow-y-auto bg-[var(--cv-color-bg)] p-3">
      {/* Datos principales */}
      <div className="cv-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-[var(--cv-color-primary)]" />
          <h3
            className="text-[13px] font-bold text-[var(--cv-color-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Datos principales
          </h3>
        </div>
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full text-[14px] font-bold text-white ${conv.avatarBg}`}
            >
              {conv.initials}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${ch.bg}`}
            >
              {conv.channel === "whatsapp" ? (
                <MessageCircle className="h-2.5 w-2.5 text-white" />
              ) : (
                <Instagram className="h-2.5 w-2.5 text-white" />
              )}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[15px] font-extrabold text-[var(--cv-color-text-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {conv.name}
            </p>
            {info?.phone && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--cv-color-text-secondary)]">
                <Phone className="h-3 w-3" /> {info.phone}
              </p>
            )}
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--cv-color-text-secondary)]">
              {conv.channel === "whatsapp" ? (
                <MessageCircle className="h-3 w-3" />
              ) : (
                <Instagram className="h-3 w-3" />
              )}
              {ch.label}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${lead.bg} ${lead.fg}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${lead.dot}`} />
            {lead.label}
          </span>
          {info?.oportunidad && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-2.5 py-0.5 text-[11px] font-semibold text-[#16A34A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
              Oportunidad activa
            </span>
          )}
        </div>
      </div>

      {/* Resumen automático */}
      {info?.resumen && (
        <div className="cv-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--cv-color-primary)]" />
            <h3
              className="text-[13px] font-bold text-[var(--cv-color-text-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Resumen automático
            </h3>
          </div>
          <p className="text-[12.5px] leading-relaxed text-[var(--cv-color-text-secondary)]">
            {info.resumen}
          </p>
        </div>
      )}

      {/* Información clave */}
      <div className="cv-card p-4">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--cv-color-primary)]" />
          <h3
            className="text-[13px] font-bold text-[var(--cv-color-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Información clave
          </h3>
        </div>
        <div className="divide-y divide-[var(--cv-color-border)]">
          <Row icon={HelpCircle} label="Consulta principal" value={info?.consulta} />
          <Row icon={Target} label="Intención detectada" value={info?.intencion} valuePill />
          <Row icon={ShoppingBag} label="Producto / interés" value={info?.producto} valuePill />
          <Row icon={MessageCircle} label="Último mensaje" value={lastClient?.text} />
          <Row icon={Clock} label="Última interacción" value={conv.time} />
        </div>
      </div>

      {/* Próxima acción sugerida */}
      {info?.proximaAccion && (
        <div className="rounded-[16px] border border-[var(--cv-color-border)] bg-[var(--cv-color-primary-light)] p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[var(--cv-color-primary)]" />
            <h3
              className="text-[13px] font-bold text-[var(--cv-color-primary-hover)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Próxima acción sugerida
            </h3>
          </div>
          <p className="text-[12.5px] leading-relaxed text-[var(--cv-color-text-secondary)]">
            {info.proximaAccion}
          </p>
        </div>
      )}
    </div>
  );
}

/** Skeleton shown while ChatsPage loads remote data. */
function ChatsSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem-5rem)] overflow-hidden md:h-[calc(100vh-4rem)]">
      {/* Conversation list */}
      <aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-background md:flex lg:w-96">
        <div className="border-b border-border p-4">
          <Skeleton className="mb-3 h-6 w-24" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="mt-3 flex gap-1.5">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex-1 space-y-1 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-2 py-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Active chat */}
      <section className="flex flex-1 min-w-0 flex-col bg-surface">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </header>
        <div className="flex-1 space-y-3 px-3 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="flex justify-start">
              <Skeleton className="h-12 w-1/2 rounded-2xl" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-10 w-1/3 rounded-2xl" />
            </div>
          </div>
        </div>
        <footer className="shrink-0 border-t border-border bg-background p-3 sm:p-4">
          <Skeleton className="h-12 w-full rounded-xl" />
        </footer>
      </section>
    </div>
  );
}
