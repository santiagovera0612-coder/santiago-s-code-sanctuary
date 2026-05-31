import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, Bot, RotateCcw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getStoredAgent, type StoredAgent } from "@/lib/clerivo-agent";
import { apiPost } from "@/lib/api-client";
import { ClerivoBubble } from "@/components/clerivo-bubble";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/simulator")({
  head: () => ({ meta: [{ title: "Simulador — Clerivo" }] }),
  component: Simulator,
});

type Msg = { id: string; role: "user" | "bot"; content: string };

const suggestions = [
  "Hola, quería consultar",
  "¿Hacen envíos?",
  "¿Qué medios de pago aceptan?",
  "Quiero más info",
];

type ClassifyTone = "primary" | "warning" | "info" | "success";
type Classification = {
  intent: string;
  intentTone: ClassifyTone;
  status: string;
  statusTone: ClassifyTone;
  suggestion: string;
};

function classifyInput(input: string): Classification {
  const i = (input || "").toLowerCase();
  if (/precio|cuesta|cu[aá]nto|cuotas|pago|mercado pago|alias|cbu/.test(i)) {
    return {
      intent: "Consulta comercial",
      intentTone: "primary",
      status: "Caliente",
      statusTone: "warning",
      suggestion: "Pasar precio o forma de pago y proponer cerrar la compra.",
    };
  }
  if (/stock|disponible|disponibilidad|hay |tienen|queda/.test(i)) {
    return {
      intent: "Consulta de disponibilidad",
      intentTone: "info",
      status: "Caliente",
      statusTone: "warning",
      suggestion: "Confirmar disponibilidad y ofrecer reservar el producto.",
    };
  }
  if (/env[ií]o|enviar|mandar|llegar|delivery|domicilio/.test(i)) {
    return {
      intent: "Consulta de envío",
      intentTone: "info",
      status: "Interesado",
      statusTone: "info",
      suggestion: "Pedir zona y ofrecer las opciones de envío y tiempos.",
    };
  }
  if (/producto|cat[aá]logo|venden|opci[oó]n/.test(i)) {
    return {
      intent: "Consulta de productos",
      intentTone: "primary",
      status: "Interesado",
      statusTone: "info",
      suggestion: "Recomendar 1–3 productos relevantes y preguntar para qué busca.",
    };
  }
  if (/hola|buenas|buen d[ií]a|qu[eé] tal/.test(i)) {
    return {
      intent: "Saludo inicial",
      intentTone: "info",
      status: "Nuevo",
      statusTone: "primary",
      suggestion: "Saludar, presentar el agente y preguntar en qué se puede ayudar.",
    };
  }
  return {
    intent: "Consulta general",
    intentTone: "primary",
    status: "Interesado",
    statusTone: "info",
    suggestion: "Hacer una pregunta abierta para entender mejor la intención.",
  };
}

function Simulator() {
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
        toast.error("No pudimos cargar el simulador.");
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

  const initial = useMemo<Msg[]>(() => {
    if (!agent) return [];
    return [
      {
        id: "1",
        role: "bot",
        content: `¡Hola! Soy ${agent.agentName}, el agente de ${agent.businessName || "tu negocio"}. ¿En qué te puedo ayudar?`,
      },
    ];
  }, [agent]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Side panel: derived from the last user message
  const classification = useMemo<Classification>(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    return classifyInput(lastUser?.content ?? "");
  }, [messages]);

  useEffect(() => {
    setMessages(initial);
  }, [initial]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || !agent || typing) return;
    const history = messages;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: clean };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setTyping(true);
    try {
      const data = await apiPost<{ reply: string; sessionId: string }>("simulator/respond", {
        sessionId,
        message: clean,
        history: history.map((message) => ({
          role: message.role === "bot" ? "assistant" : "user",
          content: message.content,
        })),
      });
      setSessionId(data.sessionId);
      setMessages((p) => [...p, { id: `b-${Date.now()}`, role: "bot", content: data.reply }]);
    } catch (error) {
      toast.error("No pudimos generar la respuesta con Claude.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setTyping(false);
    }
  };

  if (!hydrated) return <SimulatorSkeleton />;

  if (!agent) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
        <div className="mx-auto max-w-md text-center surface-card p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
            <Bot className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold">Primero configurá tu Agente IA</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Necesitás crear tu agente para poder probar cómo respondería a tus clientes.
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

  return (
    <div className="-mb-20 grid h-[calc(100dvh-4rem-4rem)] min-h-0 grid-cols-1 overflow-hidden md:mb-0 md:h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_340px]">
      {/* Chat */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden product-shell">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="icon-tile">
                <Bot className="h-5 w-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-success" />
            </div>
            <div>
              <p className="font-display font-semibold leading-tight">
                {agent.agentName} · Agente IA
              </p>
              <p className="text-xs text-muted-foreground">
                {agent.businessName || "Tu negocio"} · Vista previa
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSessionId(undefined);
                setMessages(initial);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
        >
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "bot" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="flex max-w-[78%] flex-col gap-1.5">
                  <div
                    className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-card text-foreground shadow-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              </motion.div>
            ))}
            {typing && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
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
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  disabled={typing}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:bg-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribí como si fueras un cliente…"
                className="h-12 flex-1 rounded-xl bg-card text-sm"
              />
              <Button
                type="submit"
                disabled={!input.trim() || typing}
                size="icon"
                className="h-12 w-12 rounded-xl"
                aria-label="Enviar mensaje"
              >
                <Send className="h-4 w-4" />
              </Button>
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
            <Pill tone={classification.intentTone}>{classification.intent}</Pill>
          </Section>
          <Section title="Estado detectado">
            <Pill tone={classification.statusTone}>{classification.status}</Pill>
          </Section>
          <Section title="Respuesta sugerida">
            <p className="text-sm text-muted-foreground">{classification.suggestion}</p>
          </Section>
          <Section title="Contexto del agente">
            <p className="text-xs text-muted-foreground">
              Tono <b>{agent.tone || "—"}</b>, objetivo{" "}
              <b>{(agent.mainGoal || "—").toLowerCase()}</b>.
            </p>
          </Section>
        </div>
      </aside>
      <ClerivoBubble
        id="simulator"
        message="Las respuestas se basan en el tono y las reglas configuradas en tu agente."
        ctaLabel="Probar mensaje"
        onCtaClick={() => void send("Hola, quería consultar")}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 border-b border-border pb-5 last:border-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Pill({
  children,
  tone = "primary",
}: {
  children: React.ReactNode;
  tone?: "primary" | "warning" | "info" | "success";
}) {
  const cls = {
    primary: "bg-primary/15 text-primary",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  }[tone];
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

/** Skeleton shown while the Simulator loads remote data. */
function SimulatorSkeleton() {
  return (
    <div className="grid h-[calc(100dvh-4rem-4rem)] min-h-0 grid-cols-1 overflow-hidden md:h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_340px]">
      <div className="flex min-h-0 flex-col">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-6">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        {/* Messages */}
        <div className="flex-1 space-y-4 px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <div className="flex gap-2.5">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-14 w-3/4 rounded-2xl" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-1/2 rounded-2xl" />
            </div>
            <div className="flex gap-2.5">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
            </div>
          </div>
        </div>
        {/* Composer */}
        <div className="shrink-0 border-t border-border px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        </div>
      </div>
      {/* Side panel */}
      <aside className="hidden border-l border-border lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-5 px-5 py-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 border-b border-border pb-4 last:border-0">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
