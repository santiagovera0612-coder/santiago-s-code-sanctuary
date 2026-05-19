import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, Bot, RotateCcw, Wand2, ArrowRight } from "lucide-react";
import { getStoredAgent, getStoredProducts, type StoredAgent, type StoredProduct } from "@/lib/clerivo-agent";
import { ClerivoBubble } from "@/components/clerivo-bubble";

export const Route = createFileRoute("/app/simulator")({
  head: () => ({ meta: [{ title: "Simulador — Clerivo" }] }),
  component: Simulator,
});

type Msg = { id: string; role: "user" | "bot"; content: string };

const suggestions = ["Hola, quería consultar", "¿Hacen envíos?", "¿Qué medios de pago aceptan?", "Quiero más info"];

function buildResponse(input: string, agent: StoredAgent, products: StoredProduct[]) {
  const i = input.toLowerCase();
  const active = products.filter((p) => p.active);
  const match = active.find((p) => p.name && i.includes(p.name.toLowerCase()));
  if (match) {
    const price = match.price ? ` Sale ${match.currency ?? ""} ${match.price}.` : "";
    return `¡Sí! Tenemos ${match.name} disponible.${price} ¿Querés que te pase más detalles?`;
  }
  if (i.includes("envío") || i.includes("envio")) {
    return `Hacemos envíos. Contame tu zona y te paso los detalles.`;
  }
  if (i.includes("pago") || i.includes("cuota")) {
    return `Te paso las formas de pago disponibles. ¿Querés coordinar una compra?`;
  }
  if (active.length > 0 && (i.includes("producto") || i.includes("catalogo") || i.includes("catálogo") || i.includes("tienen"))) {
    const names = active.slice(0, 3).map((p) => `• ${p.name}`).join("\n");
    return `Estos son algunos productos de ${agent.businessName || "nuestro negocio"}:\n\n${names}\n\n¿Querés saber más de alguno?`;
  }
  return `¡Hola! Soy ${agent.agentName}, te ayudo con consultas de ${agent.businessName || "nuestro negocio"}. Contame un poco más así te respondo mejor.`;
}

function Simulator() {
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setAgent(getStoredAgent());
    setProducts(getStoredProducts());
    setHydrated(true);
  }, []);

  const initial = useMemo<Msg[]>(() => {
    if (!agent) return [];
    return [{
      id: "1", role: "bot",
      content: `¡Hola! Soy ${agent.agentName}, el agente de ${agent.businessName || "tu negocio"}. ¿En qué te puedo ayudar?`,
    }];
  }, [agent]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages(initial); }, [initial]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    if (!text.trim() || !agent) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(p => [...p, { id: `b-${Date.now()}`, role: "bot", content: buildResponse(text, agent, products) }]);
    }, 900);
  };

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
            Necesitás crear tu agente para poder probar cómo respondería a tus clientes.
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

  return (
    <div className="-mb-20 grid h-[calc(100dvh-4rem-4rem)] min-h-0 grid-cols-1 overflow-hidden md:mb-0 md:h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_340px]">
      {/* Chat */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden product-shell">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-success" />
            </div>
            <div>
              <p className="font-display font-semibold leading-tight">{agent.agentName} · Agente IA</p>
              <p className="text-xs text-muted-foreground">{agent.businessName || "Tu negocio"} · Vista previa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMessages(initial)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map(m => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "bot" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
                    <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div className="flex max-w-[78%] flex-col gap-1.5">
                  <div className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border bg-card text-foreground shadow-sm"
                  }`}>
                    {m.content}
                  </div>
                  {m.role === "bot" && (
                    <button className="self-start text-[10px] text-muted-foreground hover:text-primary">
                      <Wand2 className="mr-1 inline h-3 w-3" /> Mejorar respuesta con IA
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            {typing && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
                  <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
          <div className="mx-auto max-w-2xl">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:bg-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
              <input
                value={input} onChange={e => setInput(e.target.value)}
                placeholder="Escribí como si fueras un cliente…"
                className="h-12 flex-1 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary"
              />
              <button type="submit" disabled={!input.trim()}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <aside className="hidden border-l border-border bg-background lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold">Vista previa de respuesta</span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <Section title="Intención detectada">
            <Pill tone="primary">Consulta de producto</Pill>
          </Section>
          <Section title="Estado detectado">
            <Pill tone="warning">Interesado</Pill>
          </Section>
          <Section title="Respuesta sugerida">
            <p className="text-sm text-muted-foreground">
              Ofrecer información del producto, precio y forma de envío. Invitar a dejar su nombre
              para hacer seguimiento.
            </p>
          </Section>
          <Section title="Resultado estimado">
            <p className="text-xs text-muted-foreground">
              Esta es una vista previa basada en cómo configuraste tu agente. Probá distintos
              mensajes para ver cómo respondería.
            </p>
          </Section>
        </div>
      </aside>
      <ClerivoBubble
        id="simulator"
        message="Las respuestas se basan en el tono, las reglas y los productos cargados."
        ctaLabel="Probar mensaje"
        onCtaClick={() => send("Hola, quería consultar")}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 border-b border-border pb-5 last:border-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Pill({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "warning" | "info" | "success" }) {
  const cls = {
    primary: "bg-primary/15 text-primary",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}
function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span>{children}</span>
    </div>
  );
}
