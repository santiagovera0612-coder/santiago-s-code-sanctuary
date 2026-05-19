import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  ArrowRight,
  Check,
  Bot,
  ChevronDown,
  User2,
  BookOpen,
  Shield,
  Pencil,
  Trash2,
  Upload,
  FileSpreadsheet,
  Wand2,
  Plus,
  Download,
  Search,
  Image as ImageIcon,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { ClerivoBubble } from "@/components/clerivo-bubble";

export const Route = createFileRoute("/app/create")({
  head: () => ({ meta: [{ title: "Agente IA — Clerivo" }] }),
  component: AgenteIAPage,
});

// ---------------------------- Types ----------------------------

type AgentProfile = {
  businessName: string;
  businessType: string;
  agentName: string;
  mainGoal: string;
  tone: string;
  allowedTopics: string[];
  forbiddenClaims: string[];
  escalationRules: string[];
  hotLeadRules: string[];
  followUpRules: string[];
  operatingMode: "suggest" | "approve" | "auto";
  shortDescription: string;
  catalogEnabled: boolean;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  currency?: string;
  stock?: number;
  imageUrl?: string;
  active: boolean;
  aiNotes?: string;
};

const STORAGE_AGENT = "clerivo:agent";
const STORAGE_PRODUCTS = "clerivo:products";
const STORAGE_CATALOG_CONTEXT = "clerivo:catalog-context";

function loadAgent(): AgentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_AGENT);
    return raw ? (JSON.parse(raw) as AgentProfile) : null;
  } catch {
    return null;
  }
}
function saveAgent(a: AgentProfile) {
  localStorage.setItem(STORAGE_AGENT, JSON.stringify(a));
}
function loadProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  } catch {
    return [];
  }
}
function saveProducts(p: Product[]) {
  localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(p));
}

// ---------------------------- Root ----------------------------

function AgenteIAPage() {
  const router = useRouter();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAgent(loadAgent());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const bubble = (
    <ClerivoBubble
      id="create"
      message="Cargar productos ayuda a que tu agente responda con información más precisa."
      ctaLabel="Cargar producto"
    />
  );

  if (!agent && !creating) {
    return (
      <>
        <EmptyState onStart={() => setCreating(true)} />
        {bubble}
      </>
    );
  }

  if (!agent && creating) {
    return (
      <>
        <AgentBuilderChat
          onCancel={() => setCreating(false)}
          onCreated={(a) => {
            saveAgent(a);
            setAgent(a);
            setCreating(false);
            toast.success("Agente creado");
          }}
          onCreatedAndSimulate={(a) => {
            saveAgent(a);
            setAgent(a);
            setCreating(false);
            toast.success("Agente creado");
            router.navigate({ to: "/app/simulator" });
          }}
        />
        {bubble}
      </>
    );
  }

  return (
    <>
      <AgentDashboard
        agent={agent!}
        onUpdate={(a) => {
          saveAgent(a);
          setAgent(a);
        }}
        onReset={() => {
          localStorage.removeItem(STORAGE_AGENT);
          setAgent(null);
        }}
      />
      {bubble}
    </>
  );
}

// ---------------------------- Empty state ----------------------------

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="product-shell flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-xl text-center"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
          <Bot className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Creá tu Agente IA
        </h1>
        <p className="mx-auto mt-3 max-w-md text-balance text-sm text-muted-foreground sm:text-base">
          CLERIVO te va a hacer algunas preguntas para configurar un asistente adaptado a tu
          negocio.
        </p>
        <button
          onClick={onStart}
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-primary px-6 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
        >
          <Sparkles className="h-4 w-4" />
          Empezar configuración
          <ArrowRight className="h-4 w-4" />
        </button>
        <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
          {[
            { icon: User2, t: "Perfil", d: "Tono, objetivo y nombre" },
            { icon: BookOpen, t: "Catálogo", d: "Productos como contexto" },
            { icon: Shield, t: "Reglas", d: "Qué responde y qué no" },
          ].map((x) => (
            <div key={x.t} className="surface-card p-4 text-sm">
              <x.icon className="mb-2 h-4 w-4 text-primary" />
              <p className="font-semibold">{x.t}</p>
              <p className="text-xs text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------- Builder chat ----------------------------

type StepId =
  | "businessName"
  | "businessType"
  | "mainGoal"
  | "tone"
  | "agentName"
  | "catalog"
  | "summary";

type ChatMsg = {
  id: string;
  role: "ai" | "user";
  content: React.ReactNode;
};

const steps: StepId[] = [
  "businessName",
  "businessType",
  "mainGoal",
  "tone",
  "agentName",
  "catalog",
  "summary",
];

type TrackerStep = {
  label: string;
  stepIds: StepId[];
};

const trackerSteps: TrackerStep[] = [
  { label: "Negocio", stepIds: ["businessName", "businessType"] },
  { label: "Objetivo", stepIds: ["mainGoal"] },
  { label: "Tono", stepIds: ["tone"] },
  { label: "Nombre", stepIds: ["agentName"] },
  { label: "Catálogo", stepIds: ["catalog"] },
  { label: "Listo", stepIds: ["summary"] },
];

const businessTypes = [
  "Tienda de ropa",
  "Decoración",
  "Comida",
  "Servicios",
  "Belleza",
  "Tecnología",
  "Otro",
];
const goals = [
  "Responder consultas",
  "Vender productos",
  "Calificar clientes",
  "Agendar seguimientos",
  "Atención al cliente",
];
const tones = ["Profesional", "Cercano", "Amigable", "Formal", "Vendedor pero natural"];
const allowedTopicsOpts = [
  "Precios",
  "Horarios",
  "Formas de pago",
  "Productos disponibles",
  "Envíos",
  "Promociones",
  "Ubicación",
  "Disponibilidad",
];
const forbiddenOpts = [
  "Stock",
  "Descuentos",
  "Fechas de entrega",
  "Precios",
  "Promesas de envío",
  "Disponibilidad",
];
const escalationOpts = [
  "Cuando el cliente se queja",
  "Cuando pide hablar con alguien",
  "Cuando hay un reclamo",
  "Cuando la IA no está segura",
  "Cuando quiere comprar algo especial",
];
const hotLeadOpts = [
  "Pregunta por stock",
  "Pide formas de pago",
  "Pide alias o CBU",
  "Pregunta por envío",
  "Dice que quiere comprar",
];

function suggestAgentNames(type: string): string[] {
  const base = ["Sofía", "Mateo", "Lola", "Bruno", "Vera"];
  const map: Record<string, string[]> = {
    "Tienda de ropa": ["Lola", "Vera", "Mía"],
    Decoración: ["Iris", "Nora", "Bruno"],
    Comida: ["Bruno", "Tomi", "Nina"],
    Belleza: ["Vera", "Lía", "Mía"],
    Tecnología: ["Neo", "Aria", "Kai"],
  };
  return map[type] ?? base;
}

function ProgressTracker({ currentStep }: { currentStep: StepId }) {
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto sm:justify-center">
      {trackerSteps.map((trackerStep, idx) => {
        const lastStepId = trackerStep.stepIds[trackerStep.stepIds.length - 1];
        const stepIndex = steps.indexOf(lastStepId);
        const isCompleted = currentStepIndex > stepIndex;
        const isCurrent = trackerStep.stepIds.includes(currentStep);
        const isPending = currentStepIndex < stepIndex;

        return (
          <div key={trackerStep.label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                isCurrent
                  ? "border-primary bg-gradient-primary text-primary-foreground shadow-glow"
                  : isCompleted
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  isCurrent
                    ? "bg-white/20 text-primary-foreground"
                    : isCompleted
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="h-2.5 w-2.5" /> : idx + 1}
              </span>
              {trackerStep.label}
            </div>
            {idx < trackerSteps.length - 1 && (
              <div
                className={`hidden h-px w-4 flex-shrink-0 sm:block ${
                  isCompleted ? "bg-primary/50" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgentBuilderChat({
  onCreated,
  onCancel,
  onCreatedAndSimulate,
}: {
  onCreated: (a: AgentProfile) => void;
  onCancel: () => void;
  onCreatedAndSimulate: (a: AgentProfile) => void;
}) {
  const [step, setStep] = useState<StepId>("businessName");
  const [draft, setDraft] = useState<Partial<AgentProfile>>({
    operatingMode: "approve",
    allowedTopics: [],
    forbiddenClaims: [],
    escalationRules: [],
    hotLeadRules: [],
    followUpRules: ['Dice "lo pienso"', 'Dice "te aviso"', "Deja de responder"],
    catalogEnabled: false,
  });
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "intro",
      role: "ai",
      content: (
        <>
          <b>Hola, soy CLERIVO.</b> Te voy a ayudar a crear tu agente IA para que pueda responder
          clientes, entender tu negocio y seguir tus reglas de atención.
          <br />
          Primero, <b>¿cómo se llama tu negocio?</b>
        </>
      ),
    },
  ]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const progress = (steps.indexOf(step) / (steps.length - 1)) * 100;

  const askNext = (next: StepId, current: Partial<AgentProfile>) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setStep(next);
      setMessages((m) => [...m, { id: `ai-${next}-${Date.now()}`, role: "ai", content: promptFor(next, current) }]);
    }, 700);
  };

  const pushUser = (display: React.ReactNode) => {
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: display }]);
  };

  const advance = (from: StepId, updated: Partial<AgentProfile>, display: React.ReactNode) => {
    pushUser(display);
    setDraft(updated);
    const idx = steps.indexOf(from);
    const next = steps[idx + 1];
    if (next) askNext(next, updated);
  };

  return (
    <div className="product-shell flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-border bg-background/86 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Creando tu agente IA</p>
              <p className="text-xs text-muted-foreground">Guía paso a paso</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
        <div className="mx-auto mt-4 max-w-3xl">
          <ProgressTracker currentStep={step} />
        </div>
        <div className="mx-auto mt-3 h-1 max-w-3xl overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md surface-card text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
            {typing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="rounded-2xl rounded-bl-md surface-card px-4 py-3.5">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-border bg-background/86 px-4 py-5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-3xl">
          <StepInput
            step={step}
            draft={draft}
            disabled={typing}
            onAdvance={(updated, display) => advance(step, updated, display)}
            onFinish={(final) => onCreated(final)}
            onFinishAndSimulate={(final) => onCreatedAndSimulate(final)}
            onRestart={() => {
              setStep("businessName");
              setDraft({
                operatingMode: "approve",
                allowedTopics: [],
                forbiddenClaims: [],
                escalationRules: [],
                hotLeadRules: [],
                followUpRules: ['Dice "lo pienso"', 'Dice "te aviso"', "Deja de responder"],
                catalogEnabled: false,
              });
              setMessages([
                {
                  id: "intro2",
                  role: "ai",
                  content: <>Empecemos de nuevo. <b>¿Cómo se llama tu negocio?</b></>,
                },
              ]);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function promptFor(step: StepId, d: Partial<AgentProfile>): React.ReactNode {
  switch (step) {
    case "businessType":
      return (
        <>
          Genial, <b>{d.businessName}</b>. ¿A qué se dedica tu negocio?
        </>
      );
    case "mainGoal":
      return <>¿Qué querés que haga principalmente tu agente? Podés elegir uno o varios.</>;
    case "tone":
      return <>¿Cómo querés que hable tu agente?</>;
    case "agentName":
      return (
        <>
          ¿Qué nombre querés ponerle a tu agente? Te dejo algunas sugerencias o podés escribir el
          tuyo.
        </>
      );
    case "catalog":
      return (
        <>
          ¿Querés cargar productos ahora para que tu agente pueda responder con información real de
          tu catálogo?
        </>
      );
    case "summary":
      return <><b>Tu agente quedó configurado.</b> Revisá el resumen y confirmá.</>;
    default:
      return null;
  }
}

function StepInput({
  step,
  draft,
  disabled,
  onAdvance,
  onFinish,
  onFinishAndSimulate,
  onRestart,
}: {
  step: StepId;
  draft: Partial<AgentProfile>;
  disabled: boolean;
  onAdvance: (updated: Partial<AgentProfile>, display: React.ReactNode) => void;
  onFinish: (final: AgentProfile) => void;
  onFinishAndSimulate: (final: AgentProfile) => void;
  onRestart: () => void;
}) {
  const [text, setText] = useState("");
  const [multi, setMulti] = useState<string[]>([]);

  useEffect(() => {
    setText("");
    setMulti([]);
  }, [step]);

  const toggle = (v: string) =>
    setMulti((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  if (step === "businessName" || step === "agentName") {
    const isAgent = step === "agentName";
    const suggestions = isAgent ? suggestAgentNames(draft.businessType ?? "") : [];
    return (
      <div className="space-y-3">
        {isAgent && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                disabled={disabled}
                onClick={() => onAdvance({ ...draft, agentName: s }, s)}
                className="min-h-9 rounded-full border border-border bg-card px-3 text-xs font-medium hover:border-primary hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = text.trim();
            if (!v) return;
            const updated = isAgent ? { ...draft, agentName: v } : { ...draft, businessName: v };
            onAdvance(updated, v);
          }}
          className="flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            placeholder={isAgent ? "Ej: Sofía" : "Ej: Estudio Norte"}
            className="h-12 flex-1 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    );
  }

  if (step === "businessType") {
    return (
      <div className="flex flex-wrap gap-2">
        {businessTypes.map((o) => (
          <button
            key={o}
            disabled={disabled}
            onClick={() => onAdvance({ ...draft, businessType: o }, o)}
            className="min-h-10 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary hover:bg-accent"
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  if (step === "tone") {
    return (
      <div className="flex flex-wrap gap-2">
        {tones.map((o) => (
          <button
            key={o}
            disabled={disabled}
            onClick={() => onAdvance({ ...draft, tone: o }, o)}
            className="min-h-10 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary hover:bg-accent"
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  if (step === "mainGoal") {
    const opts = goals;
    const single = true;
    return (
      <MultiChips
        opts={opts}
        multi={multi}
        toggle={(v) => (single ? setMulti([v]) : toggle(v))}
        disabled={disabled}
        onConfirm={() => {
          if (!multi.length) return;
          const display = multi.join(", ");
          onAdvance({ ...draft, mainGoal: multi[0] }, display);
        }}
      />
    );
  }

  if (step === "catalog") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          disabled={disabled}
          onClick={() => onAdvance({ ...draft, catalogEnabled: true }, "Sí, cargar productos ahora")}
          className="min-h-10 rounded-xl bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          Sí, cargar productos ahora
        </button>
        <button
          disabled={disabled}
          onClick={() =>
            onAdvance({ ...draft, catalogEnabled: false }, "Prefiero hacerlo después")
          }
          className="min-h-10 rounded-xl border border-border bg-card px-4 text-sm font-medium hover:border-primary hover:bg-accent"
        >
          Prefiero hacerlo después
        </button>
      </div>
    );
  }

  if (step === "summary") {
    const final: AgentProfile = {
      businessName: draft.businessName ?? "",
      businessType: draft.businessType ?? "",
      agentName: draft.agentName ?? "",
      mainGoal: draft.mainGoal ?? "",
      tone: draft.tone ?? "Cercano",
      allowedTopics: draft.allowedTopics ?? [],
      forbiddenClaims: draft.forbiddenClaims ?? [],
      escalationRules: draft.escalationRules ?? [],
      hotLeadRules: draft.hotLeadRules ?? [],
      followUpRules: draft.followUpRules ?? [],
      operatingMode: draft.operatingMode ?? "approve",
      shortDescription: `${draft.agentName ?? "Tu agente"} ayuda a ${draft.businessName ?? "tu negocio"} a ${(
        draft.mainGoal ?? "atender clientes"
      ).toLowerCase()} con tono ${(draft.tone ?? "cercano").toLowerCase()}.`,
      catalogEnabled: draft.catalogEnabled ?? false,
    };
    return (
      <div className="space-y-3">
        <div className="surface-card border-primary/30 p-5 shadow-elegant">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">{final.agentName || "Tu agente"}</h3>
              <p className="text-xs text-muted-foreground">Tu agente quedó listo</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Nombre del agente" value={final.agentName} />
            <Row label="Negocio" value={final.businessName} />
            <Row label="Rubro" value={final.businessType} />
            <Row label="Objetivo" value={final.mainGoal} />
            <Row label="Tono" value={final.tone} />
            <Row
              label="Catálogo"
              value={final.catalogEnabled ? "Carga iniciada" : "Pendiente"}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Las reglas avanzadas (qué puede responder, qué no inventar, cuándo derivar, clientes
            calientes) las configurás después en <b>Agente IA &gt; Reglas de respuesta</b>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onFinishAndSimulate(final)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-primary px-5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Sparkles className="h-4 w-4" /> Probar en Simulador
          </button>
          <button
            onClick={() => onFinish(final)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-accent"
          >
            <Shield className="h-4 w-4" /> Ver configuración del agente
          </button>
          <button
            onClick={onRestart}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold"
          >
            <RotateCcw className="h-4 w-4" /> Reiniciar configuración
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function MultiChips({
  opts,
  multi,
  toggle,
  onConfirm,
  disabled,
}: {
  opts: string[];
  multi: string[];
  toggle: (v: string) => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {opts.map((o) => {
          const active = multi.includes(o);
          return (
            <button
              key={o}
              disabled={disabled}
              onClick={() => toggle(o)}
              className={`min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-primary bg-gradient-primary text-primary-foreground shadow-glow"
                  : "border-border bg-card hover:border-primary hover:bg-accent"
              }`}
            >
              {active && <Check className="mr-1 inline h-3.5 w-3.5" />}
              {o}
            </button>
          );
        })}
      </div>
      <button
        disabled={disabled || !multi.length}
        onClick={onConfirm}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40"
      >
        Confirmar {multi.length > 0 && `(${multi.length})`} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words font-medium">{value || "—"}</p>
    </div>
  );
}

// ---------------------------- Dashboard with accordions ----------------------------

function AgentDashboard({
  agent,
  onUpdate,
  onReset,
}: {
  agent: AgentProfile;
  onUpdate: (a: AgentProfile) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState<string | null>("profile");

  return (
    <div className="product-shell min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Agente IA</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configurá cómo responde tu asistente, qué productos conoce y qué reglas debe seguir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
              <span className="flex h-2 w-2 rounded-full bg-success" />
              <span className="font-medium">{agent.agentName} activo</span>
            </div>
            <button
              onClick={() => {
                if (confirm("¿Reiniciar y crear un nuevo agente?")) onReset();
              }}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              Reiniciar
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <Accordion
            id="profile"
            icon={User2}
            title="Perfil del agente"
            subtitle="Nombre, tono y modo de trabajo"
            open={open === "profile"}
            onToggle={() => setOpen(open === "profile" ? null : "profile")}
          >
            <ProfilePanel agent={agent} onSave={onUpdate} />
          </Accordion>

          <Accordion
            id="catalog"
            icon={BookOpen}
            title="Catálogo inteligente"
            subtitle="Productos que la IA puede usar como contexto"
            open={open === "catalog"}
            onToggle={() => setOpen(open === "catalog" ? null : "catalog")}
          >
            <CatalogPanel />
          </Accordion>

          <Accordion
            id="rules"
            icon={Shield}
            title="Reglas de respuesta"
            subtitle="Qué puede responder y cuándo derivar"
            open={open === "rules"}
            onToggle={() => setOpen(open === "rules" ? null : "rules")}
          >
            <RulesPanel agent={agent} onSave={onUpdate} />
          </Accordion>
        </div>
      </div>
    </div>
  );
}

function Accordion({
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: any;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-accent/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Icon className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-base font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="border-t border-border px-5 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------- Profile panel ----------------------------

function ProfilePanel({
  agent,
  onSave,
}: {
  agent: AgentProfile;
  onSave: (a: AgentProfile) => void;
}) {
  const [draft, setDraft] = useState<AgentProfile>(agent);
  useEffect(() => setDraft(agent), [agent]);

  const update = <K extends keyof AgentProfile>(k: K, v: AgentProfile[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const modes: { v: AgentProfile["operatingMode"]; label: string; desc: string; soon?: boolean }[] = [
    { v: "suggest", label: "Solo sugerir", desc: "Solo sugiere respuestas" },
    { v: "approve", label: "Aprobar", desc: "Responde con aprobación (recomendado)" },
    { v: "auto", label: "Automático", desc: "Próximamente", soon: true },
  ];

  const initial = (draft.agentName || "A").trim().charAt(0).toUpperCase();
  const modeLabel = modes.find((m) => m.v === draft.operatingMode)?.label ?? "Aprobar";

  return (
    <div className="space-y-6">
      {/* Premium visual agent card */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-elegant">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-primary text-3xl font-bold text-primary-foreground shadow-glow ring-4 ring-background">
              {initial}
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-success">
                <Check className="h-3 w-3 text-success-foreground" />
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                toast("Próximamente", {
                  description: "Vas a poder personalizar el avatar de tu agente más adelante.",
                })
              }
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-card px-3 py-1 text-[10px] font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <ImageIcon className="h-3 w-3" /> Cambiar avatar · Próximamente
            </button>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-display text-2xl font-bold leading-tight">
                {draft.agentName || "Tu agente"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Agente de {(draft.mainGoal || "atención").toLowerCase()} de{" "}
                <span className="font-medium text-foreground">
                  {draft.businessName || "tu negocio"}
                </span>
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <AgentBadge label="Objetivo" value={draft.mainGoal || "—"} />
              <AgentBadge label="Tono" value={draft.tone || "—"} />
              <AgentBadge label="Modo" value={modeLabel} />
            </div>
            {draft.shortDescription && (
              <p className="rounded-lg border border-border bg-card/60 p-3 text-sm leading-relaxed text-muted-foreground">
                {draft.shortDescription}
              </p>
            )}
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tu agente está listo para
              </p>
              <ul className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                {[
                  "Responder consultas",
                  "Recomendar productos",
                  "Detectar clientes calientes",
                  "Derivar cuando no esté seguro",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-1.5 text-foreground/90">
                    <Check className="h-3 w-3 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
      <Field label="Nombre del agente">
        <input
          value={draft.agentName}
          onChange={(e) => update("agentName", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Nombre del negocio">
        <input
          value={draft.businessName}
          onChange={(e) => update("businessName", e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Rubro">
        <select
          value={draft.businessType}
          onChange={(e) => update("businessType", e.target.value)}
          className="input"
        >
          {businessTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Objetivo principal">
        <select
          value={draft.mainGoal}
          onChange={(e) => update("mainGoal", e.target.value)}
          className="input"
        >
          {goals.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Tono de respuesta">
        <select
          value={draft.tone}
          onChange={(e) => update("tone", e.target.value)}
          className="input"
        >
          {tones.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Modo de trabajo">
        <div className="grid gap-2 sm:grid-cols-3">
          {modes.map((m) => {
            const active = draft.operatingMode === m.v;
            const soon = m.soon;
            return (
              <button
                key={m.v}
                type="button"
                onClick={() => {
                  if (soon) {
                    toast("Próximamente", {
                      description: "El modo automático estará disponible cuando conectes tus canales.",
                    });
                    return;
                  }
                  update("operatingMode", m.v);
                }}
                className={`relative rounded-xl border px-3 py-2 text-left text-xs transition ${
                  soon
                    ? "cursor-not-allowed border-dashed border-border bg-muted/40 opacity-70"
                    : active
                    ? "border-primary bg-accent"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                <p className="font-semibold">
                  {m.label}
                  {soon && (
                    <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Próximamente
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </Field>
      <div className="lg:col-span-2">
        <Field label="Descripción corta del agente">
          <textarea
            value={draft.shortDescription}
            onChange={(e) => update("shortDescription", e.target.value)}
            rows={2}
            className="input"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4 text-sm lg:col-span-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Resumen</p>
        <p className="mt-1 leading-relaxed">
          Tu agente <b>{draft.agentName}</b> está configurado para{" "}
          <b>{(draft.mainGoal || "atender").toLowerCase()}</b>, responder con tono{" "}
          <b>{(draft.tone || "cercano").toLowerCase()}</b> y trabajar en modo{" "}
          <b>
            {modes.find((m) => m.v === draft.operatingMode)?.label.toLowerCase()}
          </b>
          .
        </p>
      </div>

      <div className="lg:col-span-2">
        <button
          onClick={() => {
            onSave(draft);
            toast.success("Cambios guardados");
          }}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-primary px-5 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Save className="h-4 w-4" /> Guardar cambios
        </button>
      </div>
      </div>
    </div>
  );
}

function AgentBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// ---------------------------- Rules panel ----------------------------

function RulesPanel({
  agent,
  onSave,
}: {
  agent: AgentProfile;
  onSave: (a: AgentProfile) => void;
}) {
  const [draft, setDraft] = useState<AgentProfile>(agent);
  useEffect(() => setDraft(agent), [agent]);

  return (
    <div className="space-y-5">
      <ChipsEditor
        label="Qué puede responder la IA"
        suggestions={allowedTopicsOpts}
        values={draft.allowedTopics}
        onChange={(v) => setDraft({ ...draft, allowedTopics: v })}
      />
      <ChipsEditor
        label="Qué no debe inventar"
        suggestions={forbiddenOpts}
        values={draft.forbiddenClaims}
        onChange={(v) => setDraft({ ...draft, forbiddenClaims: v })}
      />
      <ChipsEditor
        label="Cuándo derivar a una persona"
        suggestions={escalationOpts}
        values={draft.escalationRules}
        onChange={(v) => setDraft({ ...draft, escalationRules: v })}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChipsEditor
          label="Cliente caliente cuando…"
          suggestions={hotLeadOpts}
          values={draft.hotLeadRules}
          onChange={(v) => setDraft({ ...draft, hotLeadRules: v })}
          tone="hot"
        />
        <ChipsEditor
          label="Seguimiento cuando…"
          suggestions={['Dice "lo pienso"', 'Dice "te aviso"', "Deja de responder"]}
          values={draft.followUpRules}
          onChange={(v) => setDraft({ ...draft, followUpRules: v })}
          tone="follow"
        />
      </div>
      <button
        onClick={() => {
          onSave(draft);
          toast.success("Reglas guardadas");
        }}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-primary px-5 text-sm font-semibold text-primary-foreground shadow-glow"
      >
        <Save className="h-4 w-4" /> Guardar reglas
      </button>
    </div>
  );
}

function ChipsEditor({
  label,
  suggestions,
  values,
  onChange,
  tone,
}: {
  label: string;
  suggestions: string[];
  values: string[];
  onChange: (v: string[]) => void;
  tone?: "hot" | "follow";
}) {
  const [text, setText] = useState("");
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setText("");
  };
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span
            key={v}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              tone === "hot"
                ? "bg-destructive/15 text-destructive"
                : tone === "follow"
                ? "bg-warning/15 text-warning"
                : "bg-primary/15 text-primary"
            }`}
          >
            {v}
            <button onClick={() => toggle(v)} className="opacity-70 hover:opacity-100">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions
          .filter((s) => !values.includes(s))
          .map((s) => (
            <button
              key={s}
              onClick={() => toggle(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-transparent px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Agregar otro…"
          className="input h-9 flex-1 text-xs"
        />
        <button
          onClick={add}
          className="rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-accent"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

// ---------------------------- Catalog panel ----------------------------

type CatalogTab = "home" | "manual" | "csv" | "ai";

function CatalogPanel() {
  const [tab, setTab] = useState<CatalogTab>("home");
  const [products, setProducts] = useState<Product[]>([]);
  const [contextEnabled, setContextEnabled] = useState(true);

  useEffect(() => {
    setProducts(loadProducts());
    setContextEnabled(localStorage.getItem(STORAGE_CATALOG_CONTEXT) !== "0");
  }, []);

  const persist = (p: Product[]) => {
    setProducts(p);
    saveProducts(p);
  };

  return (
    <div className="space-y-5">
      {tab === "home" && (
        <>
          <div>
            <h3 className="font-display text-base font-semibold">Catálogo inteligente</h3>
            <p className="text-sm text-muted-foreground">
              Subí tus productos para que CLERIVO pueda responder con información real de tu
              negocio.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <OptionCard
              icon={Pencil}
              title="Cargar manualmente"
              desc="Agregá productos uno por uno"
              onClick={() => setTab("manual")}
            />
            <OptionCard
              icon={FileSpreadsheet}
              title="Importar CSV"
              desc="Subí un archivo con tu catálogo"
              onClick={() => setTab("csv")}
            />
            <OptionCard
              icon={Wand2}
              title="Crear catálogo con IA"
              desc="Mandale productos en texto o fotos"
              onClick={() => setTab("ai")}
            />
          </div>
        </>
      )}

      {tab === "manual" && (
        <ManualCatalog
          products={products}
          setProducts={persist}
          onBack={() => setTab("home")}
        />
      )}
      {tab === "csv" && (
        <CsvCatalog
          onBack={() => setTab("home")}
          onImport={(rows) => {
            persist([...products, ...rows]);
            toast.success(`${rows.length} productos importados`);
            setTab("manual");
          }}
        />
      )}
      {tab === "ai" && (
        <AiCatalog
          onBack={() => setTab("home")}
          onImport={(rows) => {
            persist([...products, ...rows]);
            toast.success(`${rows.length} productos importados`);
            setTab("manual");
          }}
        />
      )}

      {tab === "home" && (
        <>
          <ProductsList products={products} setProducts={persist} />
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
            <div>
              <p className="text-sm font-semibold">Usar catálogo como contexto para la IA</p>
              <p className="text-xs text-muted-foreground">
                La IA usará estos productos para responder mejor en Chats y Simulador.
              </p>
            </div>
            <Switch
              checked={contextEnabled}
              onChange={(v) => {
                setContextEnabled(v);
                localStorage.setItem(STORAGE_CATALOG_CONTEXT, v ? "1" : "0");
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function OptionCard({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: any;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-elegant"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
        <Icon className="h-4 w-4 text-primary-foreground" />
      </div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
        Abrir <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? "bg-gradient-primary shadow-glow" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

// ---------------------------- Manual catalog ----------------------------

function ManualCatalog({
  products,
  setProducts,
  onBack,
}: {
  products: Product[];
  setProducts: (p: Product[]) => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<Product | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          ← Volver
        </button>
        <button
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: "",
              active: true,
              currency: "ARS",
            })
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4" /> Nuevo producto
        </button>
      </div>

      {editing && (
        <ProductForm
          product={editing}
          onCancel={() => setEditing(null)}
          onSave={(p) => {
            const exists = products.find((x) => x.id === p.id);
            const next = exists ? products.map((x) => (x.id === p.id ? p : x)) : [...products, p];
            setProducts(next);
            setEditing(null);
            toast.success("Producto guardado");
          }}
        />
      )}

      <ProductsList products={products} setProducts={setProducts} onEdit={setEditing} />
    </div>
  );
}

function ProductForm({
  product,
  onSave,
  onCancel,
}: {
  product: Product;
  onSave: (p: Product) => void;
  onCancel: () => void;
}) {
  const [p, setP] = useState<Product>(product);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const u = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));

  return (
    <div className="surface-card border-primary/30 p-5 sm:p-6">
      <div className="mb-5">
        <h4 className="font-display text-lg font-semibold">Cargá un producto</h4>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Empezá con lo básico. Después podés agregar más detalles si los necesitás.
        </p>
      </div>

      {/* Básicos */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nombre del producto">
            <input
              value={p.name}
              onChange={(e) => u("name", e.target.value)}
              placeholder="Ej: Lámpara Nórdica"
              className="input"
            />
          </Field>
        </div>
        <Field label="Precio">
          <input
            type="number"
            inputMode="decimal"
            value={p.price ?? ""}
            onChange={(e) => u("price", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="input"
          />
        </Field>
        <Field label="Categoría (opcional)">
          <input
            value={p.category ?? ""}
            onChange={(e) => u("category", e.target.value)}
            placeholder="Ej: Iluminación"
            className="input"
          />
        </Field>
      </div>

      {/* Avanzadas */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
        />
        {showAdvanced ? "Ocultar opciones avanzadas" : "Ver opciones avanzadas"}
      </button>

      {showAdvanced && (
        <div className="mt-4 grid gap-3 rounded-xl border border-dashed border-border/80 bg-surface/40 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Descripción">
              <textarea
                value={p.description ?? ""}
                onChange={(e) => u("description", e.target.value)}
                rows={2}
                placeholder="Contale a la IA qué es este producto."
                className="input"
              />
            </Field>
          </div>
          <Field label="Moneda">
            <select
              value={p.currency ?? "ARS"}
              onChange={(e) => u("currency", e.target.value)}
              className="input"
            >
              <option>ARS</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </Field>
          <Field label="Stock">
            <input
              type="number"
              value={p.stock ?? ""}
              onChange={(e) => u("stock", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="0"
              className="input"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Foto del producto (URL)">
              <input
                value={p.imageUrl ?? ""}
                onChange={(e) => u("imageUrl", e.target.value)}
                placeholder="https://…"
                className="input"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notas para la IA">
              <textarea
                value={p.aiNotes ?? ""}
                onChange={(e) => u("aiNotes", e.target.value)}
                rows={2}
                placeholder="Ej: Recomendarlo para regalos, consultar stock antes de confirmar…"
                className="input"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Usá este campo para aclarar cuándo recomendar el producto o qué no debe prometer
                CLERIVO.
              </p>
            </Field>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={p.active} onChange={(v) => u("active", v)} />
            <span className="text-sm">{p.active ? "Producto activo" : "Producto inactivo"}</span>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <button
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={() => p.name && onSave(p)}
          disabled={!p.name}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40 sm:flex-none"
        >
          <Save className="h-4 w-4" /> Guardar producto
        </button>
      </div>
    </div>
  );
}

// ---------------------------- Products list ----------------------------

function ProductsList({
  products,
  setProducts,
  onEdit,
}: {
  products: Product[];
  setProducts: (p: Product[]) => void;
  onEdit?: (p: Product) => void;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "no-price" | "no-stock">(
    "all",
  );
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filter === "active" && !p.active) return false;
      if (filter === "inactive" && p.active) return false;
      if (filter === "no-price" && p.price != null) return false;
      if (filter === "no-stock" && (p.stock ?? 0) > 0) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [products, filter, q]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Productos cargados</p>
        <p className="text-xs text-muted-foreground">{products.length} en total</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: "all", l: "Todos" },
          { v: "active", l: "Activos" },
          { v: "inactive", l: "Inactivos" },
          { v: "no-price", l: "Sin precio" },
          { v: "no-stock", l: "Sin stock" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v as any)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f.v
                ? "border-primary bg-accent text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.l}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="h-9 w-40 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay productos para mostrar.
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.category ?? "Sin categoría"} ·{" "}
                  {p.price != null ? `${p.currency ?? "ARS"} ${p.price}` : "Sin precio"} · Stock{" "}
                  {p.stock ?? 0}
                </p>
              </div>
              <span
                className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${
                  p.active
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.active ? "Activo" : "Inactivo"}
              </span>
              {onEdit && (
                <button
                  onClick={() => onEdit(p)}
                  className="rounded-lg border border-border p-2 hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setProducts(products.filter((x) => x.id !== p.id))}
                className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------- CSV catalog ----------------------------

const CSV_TEMPLATE =
  "name,description,category,price,currency,stock,image_url,active,tags,ai_notes\nLámpara Nórdica,Lámpara de madera estilo nórdico,Iluminación,35000,ARS,5,,true,,Recomendar para living\n";

function CsvCatalog({
  onBack,
  onImport,
}: {
  onBack: () => void;
  onImport: (rows: Product[]) => void;
}) {
  const [preview, setPreview] = useState<Product[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalogo-clerivo.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { rows, errors } = parseCsv(text);
      setPreview(rows);
      setErrors(errors);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          ← Volver
        </button>
        <button
          onClick={downloadTemplate}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium"
        >
          <Download className="h-3.5 w-3.5" /> Descargar plantilla CSV
        </button>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center transition hover:border-primary"
      >
        <Upload className="h-6 w-6 text-primary" />
        <p className="text-sm font-semibold">Subí tu archivo CSV</p>
        <p className="text-xs text-muted-foreground">Columnas: name, price, stock, etc.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {errors.map((e, i) => (
            <p key={i}>• {e}</p>
          ))}
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Vista previa ({preview.length} productos)</p>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface text-left">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Precio</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2">
                      {p.price != null ? `${p.currency ?? "ARS"} ${p.price}` : "—"}
                    </td>
                    <td className="px-3 py-2">{p.stock ?? "—"}</td>
                    <td className="px-3 py-2">{p.category ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => onImport(preview)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Check className="h-4 w-4" /> Confirmar importación
          </button>
        </div>
      )}
    </div>
  );
}

function parseCsv(text: string): { rows: Product[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["El archivo está vacío."] };
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  if (!headers.includes("name")) errors.push('Falta la columna "name".');
  const rows: Product[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const get = (k: string) => {
      const idx = headers.indexOf(k);
      return idx >= 0 ? cols[idx]?.trim() : undefined;
    };
    const name = get("name");
    if (!name) {
      errors.push(`Fila ${i + 1}: falta nombre.`);
      continue;
    }
    rows.push({
      id: crypto.randomUUID(),
      name,
      description: get("description"),
      category: get("category"),
      price: get("price") ? Number(get("price")) : undefined,
      currency: get("currency") || "ARS",
      stock: get("stock") ? Number(get("stock")) : undefined,
      imageUrl: get("image_url"),
      active: (get("active") ?? "true").toLowerCase() !== "false",
      aiNotes: get("ai_notes"),
    });
  }
  return { rows, errors };
}

// ---------------------------- AI catalog ----------------------------

function AiCatalog({
  onBack,
  onImport,
}: {
  onBack: () => void;
  onImport: (rows: Product[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "ai-1",
      role: "ai",
      content: (
        <>
          Mandame nombres, fotos o detalles de tus productos y armo una tabla ordenada lista para
          importar. Por ejemplo:
          <div className="mt-2 rounded-lg bg-muted/60 p-2 text-xs">
            Lámpara Nórdica $35.000<br />
            Lámpara Rattan $42.000<br />
            Velador Minimal $28.000
          </div>
        </>
      ),
    },
  ]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState<Product[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: t }]);
    setTyping(true);
    setTimeout(() => {
      const parsed = parseFreeText(t);
      const merged = [...draft, ...parsed];
      setDraft(merged);
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: parsed.length ? (
            <>
              Listo. Detecté <b>{parsed.length}</b> producto{parsed.length === 1 ? "" : "s"}. Revisá
              la tabla y editá lo que necesites antes de importar.
            </>
          ) : (
            <>No pude detectar productos. Probá con un nombre por línea y un precio opcional.</>
          ),
        },
      ]);
    }, 800);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        ← Volver
      </button>

      <div className="surface-card flex h-[420px] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "ai" && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
                  <Sparkles className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted/60"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
                <Sparkles className="h-3 w-3 text-primary-foreground" />
              </div>
              <div className="rounded-2xl rounded-bl-md bg-muted/60 px-3 py-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 border-t border-border p-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pegá tu lista de productos…"
            className="input h-10 flex-1"
          />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
            title="Adjuntar imagen"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            type="submit"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {draft.length > 0 && (
        <DraftTable
          draft={draft}
          setDraft={setDraft}
          onImport={() => onImport(draft)}
        />
      )}
    </div>
  );
}

function parseFreeText(t: string): Product[] {
  return t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const priceMatch = line.match(/\$?\s?([\d.]+(?:[.,]\d+)?)/);
      const price = priceMatch ? Number(priceMatch[1].replace(/\./g, "").replace(",", ".")) : undefined;
      const name = line.replace(/\$?\s?[\d.,]+/g, "").trim();
      return {
        id: crypto.randomUUID(),
        name: name || line,
        price,
        currency: "ARS",
        active: true,
        stock: 0,
      } as Product;
    });
}

function DraftTable({
  draft,
  setDraft,
  onImport,
}: {
  draft: Product[];
  setDraft: (p: Product[]) => void;
  onImport: () => void;
}) {
  const update = (id: string, k: keyof Product, v: any) =>
    setDraft(draft.map((p) => (p.id === id ? { ...p, [k]: v } : p)));

  const downloadCsv = () => {
    const headers = "name,description,category,price,currency,stock,image_url,active,ai_notes\n";
    const rows = draft
      .map((p) =>
        [
          p.name,
          p.description ?? "",
          p.category ?? "",
          p.price ?? "",
          p.currency ?? "ARS",
          p.stock ?? "",
          p.imageUrl ?? "",
          p.active,
          p.aiNotes ?? "",
        ]
          .map((x) => `"${String(x).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalogo-generado.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Vista previa editable</p>
      <div className="max-h-72 overflow-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-surface text-left">
            <tr>
              <th className="px-2 py-2">Nombre</th>
              <th className="px-2 py-2">Categoría</th>
              <th className="px-2 py-2">Precio</th>
              <th className="px-2 py-2">Stock</th>
              <th className="px-2 py-2">Notas IA</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {draft.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-2 py-1">
                  <input
                    value={p.name}
                    onChange={(e) => update(p.id, "name", e.target.value)}
                    className="input h-8 w-full text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={p.category ?? ""}
                    onChange={(e) => update(p.id, "category", e.target.value)}
                    className="input h-8 w-full text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={p.price ?? ""}
                    onChange={(e) =>
                      update(p.id, "price", e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="input h-8 w-24 text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={p.stock ?? ""}
                    onChange={(e) =>
                      update(p.id, "stock", e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="input h-8 w-20 text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={p.aiNotes ?? ""}
                    onChange={(e) => update(p.id, "aiNotes", e.target.value)}
                    className="input h-8 w-full text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <button
                    onClick={() => setDraft(draft.filter((x) => x.id !== p.id))}
                    className="rounded-lg border border-border p-1.5 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onImport}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Check className="h-4 w-4" /> Importar al catálogo
        </button>
        <button
          onClick={downloadCsv}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium"
        >
          <Download className="h-4 w-4" /> Descargar CSV
        </button>
      </div>
    </div>
  );
}
