import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Search, Send, Bot, User, Phone, Video, MoreVertical, Paperclip,
  Smile, ArrowLeft, ArrowRight, Filter, Instagram, MessageCircle, Check, CheckCheck,
  Sparkles, ThumbsUp, CalendarClock, Flame,
} from "lucide-react";
import { getStoredAgent, getStoredProducts, type StoredAgent, type StoredProduct } from "@/lib/clerivo-agent";
import { ClerivoBubble } from "@/components/clerivo-bubble";

export const Route = createFileRoute("/app/chats")({
  head: () => ({ meta: [{ title: "Chats — Clerivo" }] }),
  component: ChatsPage,
});

type Channel = "all" | "whatsapp" | "instagram";
type Handler = "bot" | "human";
type Msg = {
  id: string;
  from: "client" | "bot" | "human";
  text: string;
  time: string;
  read?: boolean;
};

type Conversation = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  channel: Exclude<Channel, "all">;
  lastMessage: string;
  time: string;
  unread: number;
  tag?: { label: string; tone: "primary" | "warning" | "success" | "info" };
  handler: Handler;
  online?: boolean;
  messages: Msg[];
};

const channelMeta: Record<Exclude<Channel, "all">, { icon: typeof Instagram; label: string; color: string }> = {
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "text-emerald-500 bg-emerald-500/10" },
  instagram: { icon: Instagram, label: "Instagram", color: "text-pink-500 bg-pink-500/10" },
};

const tagTone: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

function buildSeed(agent: StoredAgent, products: StoredProduct[]): Conversation[] {
  const business = agent.businessName || "tu negocio";
  const agentName = agent.agentName || "tu agente";
  const active = products.filter((p) => p.active);
  const p1 = active[0]?.name;
  const p2 = active[1]?.name;

  const greet = (name: string) =>
    `¡Hola ${name}! Soy ${agentName}, te ayudo con consultas de ${business}.`;

  return [
    {
      id: "1",
      name: "María López",
      initials: "ML",
      avatarColor: "from-pink-500 to-rose-500",
      channel: "whatsapp",
      lastMessage: p1 ? `Quería más info de ${p1}` : "Quería más info por favor",
      time: "17:58",
      unread: 2,
      tag: { label: "Interesado", tone: "info" },
      handler: "bot",
      online: true,
      messages: [
        { id: "m1", from: "client", text: "Hola", time: "17:55" },
        {
          id: "m2",
          from: "client",
          text: p1 ? `Vi ${p1}, ¿está disponible?` : "¿Cómo puedo hacer una consulta?",
          time: "17:55",
        },
        {
          id: "m3",
          from: "bot",
          text: greet("María") + (p1 ? ` Sí, ${p1} está en catálogo. ¿Querés que te pase más detalles?` : " Contame en qué te puedo ayudar."),
          time: "17:56",
          read: true,
        },
        { id: "m4", from: "client", text: "Sí dale", time: "17:57" },
      ],
    },
    {
      id: "2",
      name: "Juan Pérez",
      initials: "JP",
      avatarColor: "from-[#8D6DFC] to-[#A78BFA]",
      channel: "instagram",
      lastMessage: "¿Cómo es el envío?",
      time: "17:42",
      unread: 1,
      tag: { label: "Seguimiento", tone: "primary" },
      handler: "human",
      messages: [
        {
          id: "m1",
          from: "client",
          text: p2 ? `Hola, quería consultar por ${p2}` : "Hola, quería hacer una consulta",
          time: "17:40",
        },
        { id: "m2", from: "human", text: "¡Hola Juan! Te paso los detalles enseguida 🙌", time: "17:41", read: true },
        { id: "m3", from: "client", text: "¿Cómo es el envío?", time: "17:42" },
      ],
    },
    {
      id: "3",
      name: "Carla Gómez",
      initials: "CG",
      avatarColor: "from-amber-500 to-orange-500",
      channel: "whatsapp",
      lastMessage: "Listo, te confirmo la compra",
      time: "16:20",
      unread: 0,
      tag: { label: "Cliente", tone: "success" },
      handler: "bot",
      messages: [
        {
          id: "m1",
          from: "client",
          text: p1 ? `Quiero ${p1}` : "Quiero coordinar una compra",
          time: "16:10",
        },
        {
          id: "m2",
          from: "bot",
          text: greet("Carla") + " Te paso los datos para coordinar el envío.",
          time: "16:12",
          read: true,
        },
        { id: "m3", from: "client", text: "Listo, te confirmo la compra", time: "16:20" },
      ],
    },
  ];
}

function ChatsPage() {
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAgent(getStoredAgent());
    setProducts(getStoredProducts());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  if (!agent) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
        <div className="mx-auto max-w-md text-center surface-card p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Bot className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold">Primero configurá tu Agente IA</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configurá tu agente para ver cómo se organizarían tus conversaciones.
          </p>
          <Link
            to="/app/create"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-primary px-5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Crear Agente IA <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return <ChatsInner agent={agent} products={products} />;
}

function ChatsInner({ agent, products }: { agent: StoredAgent; products: StoredProduct[] }) {
  const seed = useMemo(() => buildSeed(agent, products), [agent, products]);
  const [conversations, setConversations] = useState<Conversation[]>(seed);
  const [activeId, setActiveId] = useState<string>(seed[0].id);
  const [channel, setChannel] = useState<Channel>("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showListMobile, setShowListMobile] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return conversations.filter(c => {
      if (channel !== "all" && c.channel !== channel) return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [conversations, channel, query]);

  const active = conversations.find(c => c.id === activeId) ?? conversations[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, activeId]);

  const counts = useMemo(() => {
    return {
      all: conversations.length,
      whatsapp: conversations.filter(c => c.channel === "whatsapp").length,
      instagram: conversations.filter(c => c.channel === "instagram").length,
    };
  }, [conversations]);

  const send = () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    const time = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    setConversations(prev => prev.map(c => c.id === activeId ? {
      ...c,
      lastMessage: text,
      time,
      messages: [...c.messages, { id: crypto.randomUUID(), from: c.handler, text, time, read: false }],
    } : c));
    setDraft("");
  };

  const toggleHandler = () => {
    setConversations(prev => prev.map(c => c.id === activeId ? {
      ...c,
      handler: c.handler === "bot" ? "human" : "bot",
    } : c));
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    setShowListMobile(false);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
  };

  const agentLabel = agent.agentName || "Agente IA";

  return (
    <div className="flex h-[calc(100vh-4rem-5rem)] md:h-[calc(100vh-4rem)] overflow-hidden">
      {/* Lista de conversaciones */}
      <aside
        className={`${showListMobile ? "flex" : "hidden"} md:flex w-full md:w-80 lg:w-96 shrink-0 flex-col border-r border-border bg-background`}
      >
        <div className="border-b border-border p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-lg font-bold">Chats</h1>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
              <Filter className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            Conversaciones iniciales. Así se verán cuando conectes tus canales.
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-background"
            />
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {([
              { key: "all", label: "Todos", count: counts.all },
              { key: "whatsapp", label: "WhatsApp", count: counts.whatsapp },
              { key: "instagram", label: "Instagram", count: counts.instagram },
            ] as const).map(t => {
              const isActive = channel === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setChannel(t.key as Channel)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 text-[10px] ${isActive ? "bg-primary-foreground/20" : "bg-background/60"}`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">Sin conversaciones</div>
          )}
          {filtered.map(c => {
            const isActive = c.id === activeId;
            const Ch = channelMeta[c.channel].icon;
            return (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`flex w-full items-start gap-3 border-b border-border/60 px-3 py-3 text-left transition ${
                  isActive ? "bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ${c.avatarColor}`}>
                    {c.initials}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${channelMeta[c.channel].color}`}>
                    <Ch className="h-3 w-3" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <span className={`shrink-0 text-[11px] ${c.unread ? "text-primary font-semibold" : "text-muted-foreground"}`}>{c.time}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
                    {c.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  {c.tag && (
                    <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${tagTone[c.tag.tone]}`}>
                      {c.tag.label}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Panel de chat */}
      <section className={`${showListMobile ? "hidden" : "flex"} md:flex flex-1 min-w-0 flex-col bg-surface`}>
        {active && (
          <>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
              <button
                onClick={() => setShowListMobile(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="relative shrink-0">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ${active.avatarColor}`}>
                  {active.initials}
                </div>
                {active.online && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{active.name}</p>
                <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                  {(() => { const Ch = channelMeta[active.channel].icon; return <Ch className="h-3 w-3" />; })()}
                  {channelMeta[active.channel].label}
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Preparado
                  </span>
                </p>
              </div>

              {/* Toggle bot / humano */}
              <div className="flex items-center gap-2 rounded-full border border-border bg-background p-0.5">
                <button
                  onClick={() => active.handler !== "bot" && toggleHandler()}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition sm:px-3 ${
                    active.handler === "bot"
                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{agentLabel}</span>
                  <span className="sm:hidden">IA</span>
                </button>
                <button
                  onClick={() => active.handler !== "human" && toggleHandler()}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition sm:px-3 ${
                    active.handler === "human"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Humano</span>
                  <span className="sm:hidden">Yo</span>
                </button>
              </div>

              <button className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:flex">
                <Phone className="h-4 w-4" />
              </button>
              <button className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:flex">
                <Video className="h-4 w-4" />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                <MoreVertical className="h-4 w-4" />
              </button>
            </header>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,_hsl(var(--border))_1px,_transparent_0)] [background-size:24px_24px] px-3 py-4 sm:px-6">
              <div className="mx-auto flex max-w-3xl flex-col gap-2">
                <div className="my-2 flex justify-center">
                  <span className="rounded-full bg-background/80 px-3 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur">
                    Conversación inicial
                  </span>
                </div>
                {active.messages.map(m => {
                  const mine = m.from !== "client";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`group max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                          mine
                            ? m.from === "bot"
                              ? "rounded-br-sm bg-gradient-primary text-primary-foreground"
                              : "rounded-br-sm bg-foreground text-background"
                            : "rounded-bl-sm bg-background text-foreground"
                        }`}
                      >
                        {m.from === "bot" && (
                          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">
                            <Bot className="h-3 w-3" /> {agentLabel}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                        <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                          {m.time}
                          {mine && (m.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="shrink-0 border-t border-border bg-background px-3 py-2 sm:px-4">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { icon: Sparkles, label: "Generar respuesta sugerida", msg: "Respuesta sugerida generada" },
                  { icon: ThumbsUp, label: "Aprobar respuesta", msg: "Respuesta aprobada" },
                  { icon: User, label: "Tomar control", msg: "Tomaste el control de la conversación", action: () => active?.handler === "bot" && toggleHandler() },
                  { icon: CalendarClock, label: "Agendar seguimiento", msg: "Seguimiento agendado" },
                  { icon: Flame, label: "Marcar cliente caliente", msg: "Cliente marcado como caliente" },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={() => { a.action?.(); toast.success(a.msg); }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-accent hover:text-foreground"
                  >
                    <a.icon className="h-3 w-3" />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Composer */}
            <footer className="shrink-0 border-t border-border bg-background p-3 sm:p-4">
              {active.handler === "bot" ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-xs">
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    {agentLabel} está respondiendo automáticamente.
                  </p>
                  <button
                    onClick={toggleHandler}
                    className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Tomar control
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <button className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <div className="relative flex-1">
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={1}
                      placeholder="Escribí un mensaje…"
                      className="block max-h-32 min-h-10 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-primary focus:bg-background"
                    />
                    <button className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted">
                      <Smile className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={send}
                    disabled={!draft.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
            </footer>
          </>
        )}
      </section>
      <ClerivoBubble
        id="chats"
        message="Así se verán tus conversaciones cuando prepares tus canales."
        ctaLabel="Ver ejemplo"
        onCtaClick={() => setActiveId(conversations[0]?.id ?? activeId)}
      />
    </div>
  );
}
