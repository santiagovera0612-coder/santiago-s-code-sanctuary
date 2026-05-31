import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  ArrowRight,
  ArrowLeft,
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
  Save,
  Store,
  Tag,
  FileText,
  Target,
  MessageCircle,
  ShoppingBag,
  Lightbulb,
  Camera,
  RotateCcw,
  Globe,
  Power,
  Settings as SettingsIcon,
  Smile as SmileIcon,
  Paperclip,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ClerivoBubble } from "@/components/clerivo-bubble";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  deleteStoredAgent,
  getStoredAgent,
  getStoredProducts,
  saveStoredAgent,
  saveStoredProducts,
  type StoredAgent,
  type StoredProduct,
} from "@/lib/clerivo-agent";
import { ApiError } from "@/lib/api-client";

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
  // Business profile — filled progressively (wizard + Configuración).
  logo?: string;
  description?: string;
  hours?: string;
  country?: string;
  currency?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
  contextItems?: Array<{
    id: string;
    type: "link" | "pdf" | "note";
    label: string;
    value: string;
    size?: number;
    addedAt: string;
  }>;
  // === Fields edited from the new "Agente IA" dashboard ===
  // All optional → backward compatible with previously saved agents.
  /** Whether the agent is currently answering. UI toggle Activo / Apagado. */
  enabled?: boolean;
  /** Multi-select tones. The primary one is mirrored into `tone` for
   *  backward compatibility with the wizard/simulator. */
  tones?: string[];
  /** Free-form instructions textarea ("Instrucciones del agente"). */
  instructions?: string;
  /** UI language for replies. */
  language?: string;
  /** Whether the agent uses emojis. */
  useEmojis?: boolean;
  /** Auto-escalate complex queries to a human. */
  escalateComplex?: boolean;
  /** Prioritise the business tone over the agent's default. */
  prioritizeTone?: boolean;
  /** Optional custom avatar — data URL, falls back to the placeholder. */
  avatarUrl?: string;
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

type CatalogFilter = "all" | "active" | "inactive" | "no-price" | "no-stock";

const STORAGE_CATALOG_CONTEXT = "clerivo:catalog-context";

async function loadAgent(): Promise<AgentProfile | null> {
  return (await getStoredAgent()) as AgentProfile | null;
}

async function saveAgent(a: AgentProfile): Promise<AgentProfile> {
  return (await saveStoredAgent(a as StoredAgent)) as AgentProfile;
}

async function resetAgent(): Promise<void> {
  await deleteStoredAgent();
}

async function loadProducts(): Promise<Product[]> {
  return (await getStoredProducts()) as Product[];
}

async function saveProducts(p: Product[]): Promise<Product[]> {
  return (await saveStoredProducts(p as StoredProduct[])) as Product[];
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const detail = error.detail || error.code;
    return detail ? `${fallback}: ${detail}` : fallback;
  }
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}

// ---------------------------- Root ----------------------------

function AgenteIAPage() {
  const router = useRouter();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await loadAgent();
        if (alive) setAgent(loaded);
      } catch {
        toast.error("No pudimos cargar tu Agente IA.");
        if (alive) setAgent(null);
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!hydrated) return <AgentPageSkeleton />;

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
          onCreated={async (a) => {
            try {
              const saved = await saveAgent(a);
              setAgent(saved);
              setCreating(false);
              toast.success("Agente creado");
            } catch (error) {
              toast.error(apiErrorMessage(error, "No pudimos crear el agente"));
            }
          }}
          onCreatedAndSimulate={async (a) => {
            try {
              const saved = await saveAgent(a);
              setAgent(saved);
              setCreating(false);
              toast.success("Agente creado");
              router.navigate({ to: "/app/simulator" });
            } catch (error) {
              toast.error(apiErrorMessage(error, "No pudimos crear el agente"));
            }
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
        onUpdate={async (a) => {
          try {
            const saved = await saveAgent(a);
            setAgent(saved);
          } catch (error) {
            toast.error(apiErrorMessage(error, "No pudimos guardar los cambios del agente"));
            throw new Error("save-agent-failed");
          }
        }}
        onReset={async () => {
          try {
            await resetAgent();
            setAgent(null);
            toast.success("Agente restablecido");
          } catch {
            toast.error("No pudimos restablecer el agente.");
            throw new Error("reset-agent-failed");
          }
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
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary">
          <Bot className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Creá tu Agente IA
        </h1>
        <p className="mx-auto mt-3 max-w-md text-balance text-sm text-muted-foreground sm:text-base">
          CLERIVO te va a hacer algunas preguntas para configurar un asistente adaptado a tu
          negocio.
        </p>
        <Button onClick={onStart} size="lg" className="mt-8 h-12 rounded-xl px-6">
          <Sparkles className="h-4 w-4" />
          Empezar configuración
          <ArrowRight className="h-4 w-4" />
        </Button>
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
  | "businessContext"
  | "mainGoal"
  | "tone"
  | "agentName"
  | "catalog"
  | "summary";

type ChatMsg = {
  id: string;
  role: "ai" | "user";
  content?: React.ReactNode;
  /** Special message kinds:
   *  - "summary": the legacy compact summary card (not used anymore — kept
   *    so older entries don't error out)
   *  - "separator": a thin centered "— Volviste al paso X —" divider that
   *    appears in chat when the user navigates back. */
  kind?: "summary" | "separator";
  agent?: AgentProfile;
  /** Step label for separator messages. */
  stepLabel?: string;
};

function buildFinalAgent(draft: Partial<AgentProfile>): AgentProfile {
  return {
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
    shortDescription: `${draft.agentName ?? "Tu agente"} ayuda a ${
      draft.businessName ?? "tu negocio"
    } a ${(draft.mainGoal ?? "atender clientes").toLowerCase()} con tono ${(
      draft.tone ?? "cercano"
    ).toLowerCase()}.`,
    catalogEnabled: draft.catalogEnabled ?? false,
    // Business profile — carry through whatever the wizard collected.
    logo: draft.logo,
    description: draft.description,
    hours: draft.hours,
    country: draft.country,
    currency: draft.currency,
    websiteUrl: draft.websiteUrl,
    instagramUrl: draft.instagramUrl,
    whatsappNumber: draft.whatsappNumber,
    contextItems: draft.contextItems,
  };
}

// NOTE: "catalog" is intentionally NOT a wizard step anymore — the catalog
// is now managed entirely from the post-wizard AgentDashboard. The step
// is also gone from the live summary and the celebration screen. Catalog
// state on the AgentProfile (catalogEnabled, embeds, etc.) is preserved
// so the dashboard and other product surfaces keep working untouched.
const steps: StepId[] = [
  "businessName",
  "businessType",
  "businessContext",
  "mainGoal",
  "tone",
  "agentName",
  "summary",
];

type TrackerStep = {
  label: string;
  stepIds: StepId[];
};

const trackerSteps: TrackerStep[] = [
  { label: "Negocio", stepIds: ["businessName", "businessType"] },
  { label: "Contexto", stepIds: ["businessContext"] },
  { label: "Objetivo", stepIds: ["mainGoal"] },
  { label: "Tono", stepIds: ["tone"] },
  { label: "Nombre", stepIds: ["agentName"] },
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

/* ============================================================
   Wizard helpers — derived state used across header, stepper, and
   the live summary panel.
   ============================================================ */

/** Index of the active tracker step (0..6). Mapped from the granular
 *  StepId list. */
function trackerIndexForStep(currentStep: StepId): number {
  return trackerSteps.findIndex((t) => t.stepIds.includes(currentStep));
}

/** Status of a given tracker step relative to the current one. */
function trackerStatus(
  trackerIdx: number,
  currentTrackerIdx: number,
): "pending" | "active" | "done" {
  if (trackerIdx < currentTrackerIdx) return "done";
  if (trackerIdx === currentTrackerIdx) return "active";
  return "pending";
}

/* ============================================================
   Desktop stepper — circles + connector lines + labels
   Renders the 7 tracker steps. Pending circles are outlined,
   active is filled with a soft halo, completed shows a check.
   ============================================================ */

function ProgressTracker({
  currentStep,
  onStepClick,
}: {
  currentStep: StepId;
  /** Called when the user clicks a *completed* circle to jump back. */
  onStepClick?: (step: StepId) => void;
}) {
  const currentTrackerIdx = trackerIndexForStep(currentStep);

  return (
    <div className="hidden w-full sm:block">
      <div className="flex items-start">
        {trackerSteps.map((trackerStep, idx) => {
          const status = trackerStatus(idx, currentTrackerIdx);
          const nextStatus =
            idx < trackerSteps.length - 1 ? trackerStatus(idx + 1, currentTrackerIdx) : "pending";
          // Done steps are clickable to jump back. Use the first StepId
          // covered by that tracker step.
          const isClickable = status === "done" && !!onStepClick;
          const targetStepId = trackerStep.stepIds[0];

          return (
            <div
              key={trackerStep.label}
              className="flex flex-1 flex-col items-center"
              style={{ minWidth: 0 }}
            >
              <div className="relative flex w-full items-center">
                {/* Left connector — always rendered (kept invisible on the
                    first step) so every column has the same internal layout
                    and the circle stays centered below its label. */}
                <div
                  className="-ml-px h-[2px] flex-1 overflow-hidden rounded-full bg-[var(--cv-color-border)]"
                  style={{ visibility: idx === 0 ? "hidden" : "visible" }}
                  aria-hidden={idx === 0}
                >
                  <div
                    className="h-full origin-left rounded-full bg-[var(--cv-color-primary)] transition-[width] duration-400 ease-out"
                    style={{
                      width: currentTrackerIdx >= idx ? "100%" : "0%",
                    }}
                  />
                </div>

                {/* Circle */}
                <button
                  type="button"
                  onClick={isClickable ? () => onStepClick!(targetStepId) : undefined}
                  disabled={!isClickable}
                  aria-label={
                    isClickable
                      ? `Volver al paso ${idx + 1}: ${trackerStep.label}`
                      : trackerStep.label
                  }
                  aria-current={status === "active" ? "step" : undefined}
                  className={`relative z-10 mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300 ease-out ${
                    isClickable
                      ? "cursor-pointer hover:ring-4 hover:ring-[var(--cv-color-primary-light)]"
                      : status === "active"
                        ? "cursor-default"
                        : "cursor-default"
                  } ${
                    status === "done"
                      ? "border-0 bg-[var(--cv-color-primary)] text-white"
                      : status === "active"
                        ? "border-0 bg-[var(--cv-color-primary)] text-white"
                        : "border-2 border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-muted)]"
                  }`}
                  style={
                    status === "active"
                      ? { boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.18)" }
                      : undefined
                  }
                >
                  {status === "done" ? (
                    <Check
                      className="h-3.5 w-3.5 animate-[fadeIn_150ms_ease-out_both]"
                      strokeWidth={3}
                    />
                  ) : (
                    idx + 1
                  )}
                </button>

                {/* Right connector — always rendered (kept invisible on the
                    last step) so the column layout stays symmetrical and
                    the circle stays centered below its label. */}
                <div
                  className="-mr-px h-[2px] flex-1 overflow-hidden rounded-full bg-[var(--cv-color-border)]"
                  style={{
                    visibility: idx === trackerSteps.length - 1 ? "hidden" : "visible",
                  }}
                  aria-hidden={idx === trackerSteps.length - 1}
                >
                  <div
                    className="h-full origin-left rounded-full bg-[var(--cv-color-primary)] transition-[width] duration-400 ease-out"
                    style={{
                      width: status === "done" || nextStatus === "done" ? "100%" : "0%",
                    }}
                  />
                </div>
              </div>

              {/* Label */}
              <span
                className={`mt-1 text-[11px] leading-tight tracking-tight transition-colors ${
                  status === "active"
                    ? "font-bold text-[var(--cv-color-primary)]"
                    : status === "done"
                      ? "font-semibold text-[var(--cv-color-text-secondary)]"
                      : "font-medium text-[var(--cv-color-text-muted)]"
                }`}
              >
                {trackerStep.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Mobile compact stepper card
   "Paso X de N"  ·  <step name in primary>
   Small circles + connecting strokes + thin progress bar.
   ============================================================ */

function MobileStepper({ currentStep }: { currentStep: StepId }) {
  const currentTrackerIdx = trackerIndexForStep(currentStep);
  const totalSteps = trackerSteps.length;
  const progressPct = ((currentTrackerIdx + 1) / totalSteps) * 100;
  const activeLabel = trackerSteps[currentTrackerIdx]?.label ?? "";

  return (
    <div className="cv-card animate-fade-up p-4 sm:hidden">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-[var(--cv-color-text-primary)]">
          Paso {currentTrackerIdx + 1} de {totalSteps}
        </p>
        <p className="text-[13px] font-semibold text-[var(--cv-color-primary)]">{activeLabel}</p>
      </div>
      <div className="flex items-center">
        {trackerSteps.map((trackerStep, idx) => {
          const status = trackerStatus(idx, currentTrackerIdx);
          return (
            <div key={trackerStep.label} className="flex flex-1 items-center">
              <div
                className={`relative z-10 mx-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                  status === "done" || status === "active"
                    ? "bg-[var(--cv-color-primary)] text-white"
                    : "border-2 border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-muted)]"
                }`}
                style={
                  status === "active" ? { boxShadow: "0 0 0 3px rgba(79,70,229,0.18)" } : undefined
                }
              >
                {status === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : idx + 1}
              </div>
              {idx < trackerSteps.length - 1 && (
                <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-[var(--cv-color-border)]">
                  <div
                    className="h-full bg-[var(--cv-color-primary)] transition-[width] duration-400"
                    style={{
                      width: status === "done" ? "100%" : "0%",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--cv-color-border)]">
        <div
          className="h-full rounded-full bg-[var(--cv-color-primary)] transition-[width] duration-400 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

/* Old desktop-only fallback retained as-is for reference; nothing
   below references it anymore. */
function _LegacyProgressTracker({ currentStep }: { currentStep: StepId }) {
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
                  ? "border-primary bg-gradient-primary text-primary-foreground"
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
  onCreated: (a: AgentProfile) => void | Promise<void>;
  onCancel: () => void;
  onCreatedAndSimulate: (a: AgentProfile) => void | Promise<void>;
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

  const askNext = (next: StepId, current: Partial<AgentProfile>) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setStep(next);
      if (next === "summary") {
        // Final step: render a compact summary card inside the chat itself.
        // The action buttons live in the card, so the bottom StepInput area
        // is hidden for this step.
        setMessages((m) => [
          ...m,
          {
            id: `ai-summary-${Date.now()}`,
            role: "ai",
            kind: "summary",
            agent: buildFinalAgent(current),
          },
        ]);
        return;
      }
      setMessages((m) => [
        ...m,
        { id: `ai-${next}-${Date.now()}`, role: "ai", content: promptFor(next, current) },
      ]);
    }, 700);
  };

  const pushUser = (display: React.ReactNode) => {
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: display }]);
  };

  const advance = (from: StepId, updated: Partial<AgentProfile>, display: React.ReactNode) => {
    pushUser(display);
    setDraft(updated);
    // The current step has just been confirmed — clear it from the
    // "revisited / Pendiente" set so the summary shows the value again.
    setRevisitedSteps((s) => {
      if (!s.has(from)) return s;
      const next = new Set(s);
      next.delete(from);
      return next;
    });
    const idx = steps.indexOf(from);
    const next = steps[idx + 1];
    if (next) askNext(next, updated);
  };

  const restart = () => {
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
        id: "intro-restart",
        role: "ai",
        content: (
          <>
            Empecemos de nuevo. <b>¿Cómo se llama tu negocio?</b>
          </>
        ),
      },
    ]);
    setCatalogMethod(null);
    setOtherActive(false);
    setFreeText("");
  };

  // ============ Interactive state for the active question block ============
  /** When the user picks one of the catalog method chips, the corresponding
   *  embedded card replaces chips inside the chat until they finish or
   *  pick another option. Hacerlo después advances directly and never sets
   *  this. */
  const [catalogMethod, setCatalogMethod] = useState<null | "csv" | "manual" | "ai">(null);
  /** "Otro" chip is selected — the FIXED input below the chat takes over.
   *  No second input is ever rendered. */
  const [otherActive, setOtherActive] = useState(false);
  /** Free-text input shown below the chat scroll. */
  const [freeText, setFreeText] = useState("");
  /** Steps that the user navigated back to. Their summary values render as
   *  "Pendiente" until re-confirmed (the draft itself keeps the value). */
  const [revisitedSteps, setRevisitedSteps] = useState<Set<StepId>>(new Set());
  /** Bumped each time we want the fixed input to play its attention pulse.
   *  ChatInputRow re-keys on this value. */
  const [attentionKey, setAttentionKey] = useState(0);
  /** Ref to the fixed bottom input — used by "Otro" and back-navigation
   *  to programmatically focus the user's typing cursor. */
  const freeTextInputRef = useRef<HTMLInputElement>(null);

  // Reset all interactive state whenever the step changes.
  useEffect(() => {
    setOtherActive(false);
    setFreeText("");
    if (step !== "catalog") setCatalogMethod(null);
  }, [step]);

  /** Pull focus to the fixed bottom input and trigger one pulse. */
  function focusFixedInput() {
    setAttentionKey((k) => k + 1);
    // Wait a tick for the input to mount with the new key.
    setTimeout(() => freeTextInputRef.current?.focus(), 30);
  }

  /** Step → human-readable tracker label. Used by the separator message. */
  function trackerLabelForStep(s: StepId): string {
    const idx = trackerIndexForStep(s);
    return trackerSteps[idx]?.label ?? "";
  }

  /** Go back one step. Adds a subtle separator to the chat. Does not touch
   *  the draft — the previous value is still there if the user wants to
   *  confirm the same answer. */
  function goBack() {
    const idx = steps.indexOf(step);
    if (idx <= 0) return;
    const prev = steps[idx - 1];
    setStep(prev);
    setRevisitedSteps((s) => new Set(s).add(prev));
    setCatalogMethod(null);
    setOtherActive(false);
    setFreeText("");
    setMessages((m) => [
      ...m,
      {
        id: `sep-${Date.now()}`,
        role: "ai",
        kind: "separator",
        stepLabel: trackerLabelForStep(prev),
      },
    ]);
    focusFixedInput();
  }

  /** Allow jumping to a specific (already-completed) step via the stepper. */
  function jumpToStep(targetStep: StepId) {
    const targetIdx = steps.indexOf(targetStep);
    const currentIdx = steps.indexOf(step);
    if (targetIdx < 0 || targetIdx >= currentIdx) return;
    setStep(targetStep);
    setRevisitedSteps((s) => new Set(s).add(targetStep));
    setCatalogMethod(null);
    setOtherActive(false);
    setFreeText("");
    setMessages((m) => [
      ...m,
      {
        id: `sep-${Date.now()}`,
        role: "ai",
        kind: "separator",
        stepLabel: trackerLabelForStep(targetStep),
      },
    ]);
    focusFixedInput();
  }

  /** Maps a (possibly custom) string answer to the right draft patch. */
  function applyAnswer(value: string, base: Partial<AgentProfile> = draft): Partial<AgentProfile> {
    switch (step) {
      case "businessName":
        return { ...base, businessName: value };
      case "businessType":
        return { ...base, businessType: value };
      case "mainGoal":
        return { ...base, mainGoal: value };
      case "tone":
        return { ...base, tone: value };
      case "agentName":
        return { ...base, agentName: value };
      default:
        return base;
    }
  }

  /** Handles a chip click for the current step. */
  function pickChip(value: string) {
    // "Otro" — pull focus to the FIXED input below the chat. No second
    // input is ever rendered. The placeholder changes contextually and
    // the input plays one attention pulse.
    if (value === "Otro") {
      setOtherActive(true);
      focusFixedInput();
      return;
    }

    // Any other chip clears any pending "Otro" state.
    if (otherActive) setOtherActive(false);

    if (step === "catalog") {
      if (value === "Hacerlo después") {
        const updated = { ...draft, catalogEnabled: false };
        advance(step, updated, value);
        return;
      }
      const method: "csv" | "manual" | "ai" =
        value === "Cargar CSV" ? "csv" : value === "Agregar manualmente" ? "manual" : "ai";
      // Push user msg + AI intro for this method.
      pushUser(value);
      setCatalogMethod(method);
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMessages((m) => [
          ...m,
          {
            id: `ai-cat-${method}-${Date.now()}`,
            role: "ai",
            content: catalogIntroFor(method),
          },
        ]);
      }, 500);
      return;
    }

    // Other steps — advance immediately with the picked value.
    const updated = applyAnswer(value);
    advance(step, updated, value);
  }

  /** Submits the bottom free-text input as the current step's answer.
   *  Same path whether the user typed freely or is replying to the "Otro"
   *  chip — the only difference is the visual hint above. */
  function submitFreeText() {
    const v = freeText.trim();
    if (!v) return;
    setFreeText("");
    // Clear "revisited" status for the current step — the user just
    // confirmed an answer for it.
    setRevisitedSteps((s) => {
      if (!s.has(step)) return s;
      const next = new Set(s);
      next.delete(step);
      return next;
    });
    setOtherActive(false);
    if (step === "businessContext") {
      const looksIg = /^@|instagram\.com/i.test(v);
      const updated = looksIg ? { ...draft, instagramUrl: v } : { ...draft, websiteUrl: v };
      advance(step, updated, v);
      return;
    }
    if (step === "catalog") {
      advance(step, { ...draft, catalogEnabled: true }, v);
      return;
    }
    advance(step, applyAnswer(v), v);
  }

  /** Called when a catalog embed (CSV / Manual / IA) completes. */
  function finishCatalog(displayText: string) {
    setCatalogMethod(null);
    advance(step, { ...draft, catalogEnabled: true }, displayText);
  }

  const isSummary = step === "summary";
  const finalAgent = isSummary ? buildFinalAgent(draft) : null;

  // Whether the bottom Continuar button is currently meaningful. Disabled
  // while there's no free text and the active step requires an answer.
  // The bottom Continuar button is meaningful only when the user has
  // typed something in the fixed input. Catalog method picks finish via
  // the embed's own primary button.
  const continueEnabled = !typing && freeText.trim().length > 0;

  return (
    <div
      className="mx-auto w-full max-w-[1240px] px-4 pb-32 pt-4 sm:px-6 sm:pb-6 sm:pt-4 lg:px-8"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* ============ Mobile header ============ */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-3 border-b border-[var(--cv-color-border)] bg-white/95 px-4 py-3 backdrop-blur-xl sm:hidden">
        <button
          type="button"
          onClick={() => {
            // Back to previous step if there's one, otherwise exit wizard.
            if (steps.indexOf(step) > 0) goBack();
            else onCancel();
          }}
          aria-label={steps.indexOf(step) > 0 ? "Volver al paso anterior" : "Cancelar"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-primary)] transition hover:bg-[var(--cv-color-bg)] ${
            steps.indexOf(step) === 0 ? "opacity-50" : ""
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[var(--cv-color-primary)]" />
            <h1
              className="text-[17px] font-bold text-[var(--cv-color-text-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Crear Agente IA
            </h1>
          </div>
          <p className="text-[12.5px] text-[var(--cv-color-text-muted)]">
            CLERIVO te guía paso a paso.
          </p>
        </div>
      </div>

      {/* ============ Desktop header ============ */}
      <header className="hidden animate-fade-up sm:block">
        <h1
          className="text-[20px] font-extrabold leading-tight tracking-tight text-[var(--cv-color-text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Crear Agente IA
        </h1>
        <p className="mt-0.5 text-[12px] text-[var(--cv-color-text-secondary)]">
          CLERIVO te guía paso a paso para configurar tu asistente.
        </p>
      </header>

      {/* ============ Mobile stepper card ============ */}
      <div className="mt-4 sm:hidden">
        <MobileStepper currentStep={step} />
      </div>

      {/* ============ Desktop stepper ============ */}
      <div className="mt-2.5 hidden sm:block">
        <ProgressTracker currentStep={step} onStepClick={jumpToStep} />
      </div>

      {/* ============ Main grid (chat / summary) ============ */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_300px]">
        {/* -------- LEFT: chat card or celebration card -------- */}
        {isSummary && finalAgent ? (
          <CelebrationCard
            agent={finalAgent}
            onSimulate={() => onCreatedAndSimulate(finalAgent)}
            onView={() => onCreated(finalAgent)}
          />
        ) : (
          <div className="cv-card flex min-h-[300px] flex-col overflow-hidden lg:min-h-[340px]">
            {/* === Chat scroll: messages + active answer block === */}
            <div
              ref={scrollRef}
              className="scrollbar-clerivo flex-1 space-y-2 overflow-y-auto p-4 sm:p-3"
              style={{ maxHeight: "min(360px, 44vh)" }}
            >
              <AnimatePresence initial={false}>
                {messages.map((m) => {
                  // Subtle "— Volviste al paso X —" separator
                  if (m.kind === "separator") {
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center justify-center gap-2 py-1.5"
                      >
                        <span className="h-px w-10 bg-[var(--cv-color-border)]" />
                        <span className="text-[11px] font-medium text-[var(--cv-color-text-muted)]">
                          Volviste al paso {m.stepLabel}
                        </span>
                        <span className="h-px w-10 bg-[var(--cv-color-border)]" />
                      </motion.div>
                    );
                  }
                  if (m.role === "ai") {
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="flex items-start gap-3"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)]"
                          aria-hidden
                        >
                          <Sparkles className="h-[14px] w-[14px]" />
                        </span>
                        <div className="max-w-[85%]">
                          <div
                            className="rounded-[12px] rounded-tl-[6px] bg-[#F3F4F6] px-3 py-1.5 text-[13px] leading-snug text-[var(--cv-color-text-primary)]"
                            style={{ fontFamily: "var(--font-body)" }}
                          >
                            {m.content}
                          </div>
                          <p className="mt-0.5 pl-1 text-[10px] text-[var(--cv-color-text-muted)]">
                            {formatNowHM()}
                          </p>
                        </div>
                      </motion.div>
                    );
                  }
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[70%]">
                        <div
                          className="rounded-[12px] rounded-tr-[6px] bg-[var(--cv-color-primary-light)] px-3 py-1.5 text-right text-[13px] font-medium leading-snug text-[var(--cv-color-primary)]"
                          style={{ fontFamily: "var(--font-body)" }}
                        >
                          {m.content}
                        </div>
                        <p className="mt-0.5 pr-1 text-right text-[10px] text-[var(--cv-color-text-muted)]">
                          {formatNowHM()} <span aria-hidden>✓✓</span>
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                {typing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-3"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)]"
                      aria-hidden
                    >
                      <Sparkles className="h-[14px] w-[14px]" />
                    </span>
                    <div className="rounded-[14px] rounded-tl-[6px] bg-[#F3F4F6] px-4 py-2.5">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--cv-color-primary)]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--cv-color-primary)] [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--cv-color-primary)] [animation-delay:300ms]" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* === Active answer block — chips + (optional) catalog embed === */}
              {!typing && !isSummary && (
                <ActiveAnswerBlock
                  step={step}
                  draft={draft}
                  catalogMethod={catalogMethod}
                  otherActive={otherActive}
                  onPickChip={pickChip}
                  onCatalogFinish={finishCatalog}
                  onContextSubmit={(web, ig) => {
                    const updated = {
                      ...draft,
                      websiteUrl: web || undefined,
                      instagramUrl: ig || undefined,
                    };
                    const display = [web, ig].filter(Boolean).join(" · ") || "Saltar este paso";
                    advance(step, updated, display);
                  }}
                />
              )}
            </div>

            {/* === Bottom free-text input + hint === */}
            <div className="border-t border-[var(--cv-color-border)] p-3 sm:px-3 sm:py-2.5">
              <ChatInputRow
                ref={freeTextInputRef}
                value={freeText}
                onChange={setFreeText}
                onSubmit={submitFreeText}
                placeholder={otherActive ? otherPlaceholderFor(step) : "Escribí tu respuesta..."}
                disabled={typing || catalogMethod !== null}
                attention={otherActive}
                attentionKey={attentionKey}
              />
              <div className="mt-1 flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3 text-[var(--cv-color-text-muted)]" />
                <p className="text-[11px] text-[var(--cv-color-text-muted)]">
                  {otherActive
                    ? "Escribí tu respuesta personalizada y enviá."
                    : "Podés elegir una opción sugerida o escribir tu propia respuesta."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* -------- RIGHT: Live summary (desktop only) -------- */}
        <div className="hidden lg:block">
          <LiveSummary draft={draft} currentStep={step} revisitedSteps={revisitedSteps} />
        </div>
      </div>

      {/* ============ Footer actions — always visible ============ */}
      {!isSummary && (
        <>
          {/* Desktop footer — Cancelar | ← Atrás | Continuar */}
          <div className="mt-2 hidden items-center justify-between sm:flex">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[10px] border-[1.5px] border-[var(--cv-color-border)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--cv-color-text-primary)] transition hover:bg-[var(--cv-color-bg)]"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-2">
              {steps.indexOf(step) > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-[var(--cv-color-border)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--cv-color-text-primary)] transition hover:bg-[var(--cv-color-bg)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Atrás
                </button>
              )}
              <button
                type="button"
                onClick={submitFreeText}
                disabled={!continueEnabled}
                className="cv-btn-primary px-5 py-2 text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Mobile sticky footer — always visible */}
          <div
            className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-[var(--cv-color-border)] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 sm:hidden"
            style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}
          >
            <button
              type="button"
              onClick={submitFreeText}
              disabled={!continueEnabled}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--cv-color-primary)] text-[16px] font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-3 text-center text-[14px] text-[var(--cv-color-text-secondary)]"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Catalog intro messages (used when user picks CSV / Manual / IA)
   ============================================================ */
function catalogIntroFor(method: "csv" | "manual" | "ai"): React.ReactNode {
  switch (method) {
    case "csv":
      return (
        <>
          Perfecto. Podés subir un archivo CSV con tus productos para cargar tu catálogo más rápido.
        </>
      );
    case "manual":
      return <>Perfecto. Podés cargar tus productos uno por uno desde acá.</>;
    case "ai":
      return (
        <>
          Perfecto. Puedo ayudarte a crear tu catálogo a partir de una breve descripción de tus
          productos o de tu negocio.
        </>
      );
  }
}

/* ============================================================
   Active answer block — chips, Other input, or catalog embed
   Rendered INSIDE the chat scroll, right below the latest AI message.
   ============================================================ */
function ActiveAnswerBlock({
  step,
  draft,
  catalogMethod,
  otherActive,
  onPickChip,
  onCatalogFinish,
  onContextSubmit,
}: {
  step: StepId;
  draft: Partial<AgentProfile>;
  catalogMethod: null | "csv" | "manual" | "ai";
  /** When true, mark the "Otro" chip as selected. The actual typing
   *  happens in the FIXED input below the chat — no second input. */
  otherActive: boolean;
  onPickChip: (value: string) => void;
  onCatalogFinish: (displayText: string) => void;
  onContextSubmit: (web: string, ig: string) => void;
}) {
  // businessContext step — dual web + IG form (no chips)
  if (step === "businessContext") {
    return (
      <div className="pl-2 sm:pl-11">
        <BusinessContextInput draft={draft} disabled={false} onSubmit={onContextSubmit} />
      </div>
    );
  }

  const chips = chipsForStep(step, draft);
  if (!chips.length) return null;

  // For catalog step, the picked method maps to a chip label so we can
  // render the selected/filled state and still let the user switch.
  const catalogLabelOf = (m: typeof catalogMethod): string | null =>
    m === "csv"
      ? "Cargar CSV"
      : m === "manual"
        ? "Agregar manualmente"
        : m === "ai"
          ? "Crear con IA"
          : null;
  const selectedCatalogLabel = catalogLabelOf(catalogMethod);

  return (
    <div className="space-y-3 pl-2 sm:pl-11">
      {/* Chips — always visible. Picked one gets filled-primary state.
          "Otro" only marks itself selected; the actual input is the fixed
          one below the chat (no second input rendered here). */}
      <div className="flex flex-wrap gap-2">
        {chips.map((label) => {
          const isOtherSel = label === "Otro" && otherActive;
          const isCatalogSel = step === "catalog" && label === selectedCatalogLabel;
          const selected = isOtherSel || isCatalogSel;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onPickChip(label)}
              className={`min-h-8 rounded-full border-[1.5px] px-[12px] py-[6px] text-[13px] font-medium transition-all duration-150 ease-out active:scale-95 ${
                selected
                  ? "border-[var(--cv-color-primary)] bg-[var(--cv-color-primary)] text-white shadow-[0_1px_2px_rgba(79,70,229,0.15)]"
                  : "border-[var(--cv-color-primary)] bg-white text-[var(--cv-color-primary)] hover:bg-[var(--cv-color-primary-light)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Catalog embed — appears below the chips, never replaces them */}
      <AnimatePresence mode="wait">
        {step === "catalog" && catalogMethod && (
          <motion.div
            key={`embed-${catalogMethod}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut", delay: 0.2 }}
          >
            {catalogMethod === "csv" && <CsvEmbed onFinish={onCatalogFinish} />}
            {catalogMethod === "manual" && <ManualEmbed onFinish={onCatalogFinish} />}
            {catalogMethod === "ai" && <AiEmbed onFinish={onCatalogFinish} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Returns the chip set for the current step. Returns [] for steps that
 *  don't use chips (businessName free input, businessContext form,
 *  summary). */
function chipsForStep(step: StepId, draft: Partial<AgentProfile>): string[] {
  switch (step) {
    case "businessName":
      return []; // free text only
    case "businessType":
      return [...businessTypes.filter((t) => t !== "Otro"), "Otro"];
    case "mainGoal":
      return [...goals, "Otro"];
    case "tone":
      return [...tones, "Otro"];
    case "agentName":
      return [...suggestAgentNames(draft.businessType ?? ""), "Otro"];
    case "catalog":
      return ["Cargar CSV", "Agregar manualmente", "Crear con IA", "Hacerlo después"];
    case "businessContext":
    case "summary":
    default:
      return [];
  }
}

/** Placeholder shown in the "Otro" inline input. */
function otherPlaceholderFor(step: StepId): string {
  switch (step) {
    case "businessName":
      return "Escribí el nombre de tu negocio...";
    case "businessType":
      return "Describí el rubro de tu negocio...";
    case "mainGoal":
      return "Describí el objetivo principal...";
    case "tone":
      return "Describí el tono que querés usar...";
    case "agentName":
      return "Escribí el nombre para tu agente...";
    default:
      return "Escribí tu respuesta...";
  }
}

/* ============================================================
   Catalog embedded forms — all live INSIDE the chat scroll,
   never navigate away. Each one operates on real local state
   and persists actual products to Supabase on confirm.
   ============================================================ */

/** Loads what's currently saved. Used by the embeds so they
 *  merge their additions instead of overwriting. */
async function loadProductsSafe(): Promise<Product[]> {
  try {
    return await loadProducts();
  } catch {
    toast.error("No pudimos cargar tus productos.");
    return [];
  }
}

/* ----- CSV embed ----- */
function CsvEmbed({ onFinish }: { onFinish: (display: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<{ rows: Product[]; errors: string[] }>({
    rows: [],
    errors: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse on file change
  useEffect(() => {
    if (!file) {
      setParsed({ rows: [], errors: [] });
      return;
    }
    file.text().then((t) => setParsed(parseCsv(t)));
  }, [file]);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-catalogo.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importAndFinish = async () => {
    if (!parsed.rows.length || !file) return;
    try {
      const existing = await loadProductsSafe();
      await saveProducts([...existing, ...parsed.rows]);
      onFinish(
        `${parsed.rows.length} producto${parsed.rows.length === 1 ? "" : "s"} importado${parsed.rows.length === 1 ? "" : "s"} desde CSV`,
      );
    } catch {
      toast.error("No pudimos importar los productos.");
    }
  };

  return (
    <div className="cv-card p-4 sm:p-5">
      <h3
        className="text-[15px] font-bold text-[var(--cv-color-text-primary)]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Subir archivo CSV
      </h3>
      <p className="mt-0.5 text-[12.5px] text-[var(--cv-color-text-secondary)]">
        Cargá un archivo con nombre, precio, descripción y stock.
      </p>

      {/* Drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-dashed p-5 text-center transition-all duration-150 ${
          dragOver
            ? "border-[var(--cv-color-primary)] bg-[var(--cv-color-primary-light)]"
            : "border-[var(--cv-color-primary)] bg-white hover:bg-[var(--cv-color-primary-light)]"
        }`}
      >
        <Upload className="h-7 w-7 text-[var(--cv-color-primary)]" />
        <p className="mt-2 text-[13px] text-[var(--cv-color-text-secondary)]">
          Arrastrá tu archivo acá o hacé clic para seleccionar
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-[var(--cv-color-primary)] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--cv-color-primary)]">
          <Upload className="h-3.5 w-3.5" />
          Seleccionar archivo
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
      </label>

      <button
        type="button"
        onClick={downloadTemplate}
        className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--cv-color-primary)] underline-offset-2 hover:underline"
      >
        <Download className="h-3.5 w-3.5" /> Descargar plantilla CSV
      </button>

      {/* Loaded file row — only when file picked */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex items-center gap-3 rounded-[10px] border border-[var(--cv-color-border)] bg-[var(--cv-color-bg)] px-3 py-2.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--cv-color-accent-green-bg)] text-[var(--cv-color-accent-green)]">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[var(--cv-color-text-primary)]">
                {file.name}
              </p>
              <p className="text-[11px] text-[var(--cv-color-text-muted)]">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.2 }}
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                parsed.errors.length === 0 && parsed.rows.length > 0
                  ? "bg-[var(--cv-color-accent-green-bg)] text-[var(--cv-color-accent-green)]"
                  : "bg-[var(--cv-color-accent-red-bg)] text-[var(--cv-color-accent-red)]"
              }`}
            >
              {parsed.errors.length === 0 && parsed.rows.length > 0
                ? `✓ ${parsed.rows.length} producto${parsed.rows.length === 1 ? "" : "s"}`
                : "✗ Revisar archivo"}
            </motion.span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              aria-label="Quitar archivo"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--cv-color-text-muted)] hover:bg-white hover:text-[var(--cv-color-accent-red)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {parsed.errors.length > 0 && (
        <ul className="mt-2 space-y-1">
          {parsed.errors.slice(0, 3).map((e, i) => (
            <li key={i} className="text-[11.5px] text-[var(--cv-color-accent-red)]">
              · {e}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={importAndFinish}
        disabled={!parsed.rows.length || parsed.errors.length > 0}
        className="cv-btn-primary mt-4 w-full justify-center py-3 text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        Importar productos
      </button>

      <p className="mt-2 text-[11.5px] text-[var(--cv-color-text-muted)]">
        ⓘ CLERIVO usará esta información para responder consultas con contexto.
      </p>
    </div>
  );
}

/* ----- Manual embed ----- */
function ManualEmbed({ onFinish }: { onFinish: (display: string) => void }) {
  // Pending products only — these aren't saved until the user hits
  // "Continuar"; the existing catalog is fetched on save and merged there.
  const [added, setAdded] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [stock, setStock] = useState("");

  const reset = () => {
    setName("");
    setPrice("");
    setDesc("");
    setStock("");
  };

  const canAdd = name.trim().length > 0;

  const addProduct = () => {
    if (!canAdd) return;
    const p: Product = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: desc.trim() || undefined,
      price: price.trim() ? Number(price.replace(/[^\d.]/g, "")) : undefined,
      currency: "ARS",
      stock: stock.trim() ? Number(stock.replace(/[^\d]/g, "")) : undefined,
      active: true,
    };
    setAdded((p2) => [...p2, p]);
    reset();
  };

  const remove = (id: string) => setAdded((a) => a.filter((x) => x.id !== id));

  const persistAndFinish = async () => {
    if (!added.length) return;
    try {
      const existing = await loadProductsSafe();
      await saveProducts([...existing, ...added]);
      onFinish(
        `${added.length} producto${added.length === 1 ? "" : "s"} cargado${added.length === 1 ? "" : "s"} manualmente`,
      );
    } catch {
      toast.error("No pudimos guardar los productos.");
    }
  };

  const inputCls =
    "h-10 w-full rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3.5 text-[13px] text-[var(--cv-color-text-primary)] placeholder:text-[var(--cv-color-text-muted)] focus:border-[var(--cv-color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--cv-color-primary)]/10";

  return (
    <div className="cv-card p-4 sm:p-5">
      <h3
        className="text-[15px] font-bold text-[var(--cv-color-text-primary)]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Agregar producto manualmente
      </h3>
      <p className="mt-0.5 text-[12.5px] text-[var(--cv-color-text-secondary)]">
        Completá los datos básicos para sumar productos a tu catálogo.
      </p>

      {/* Form fields — 2 cols desktop, stacked mobile */}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
            Nombre del producto
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Lámpara Nórdica"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
            Precio
          </span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej: $ 24.990"
            inputMode="decimal"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
            Descripción breve
          </span>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ej: Lámpara colgante estilo nórdico..."
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
            Stock
          </span>
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Ej: 15"
            inputMode="numeric"
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={addProduct}
          disabled={!canAdd}
          className="cv-btn-ghost px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar producto
        </button>
      </div>

      {/* Added list — only when there's something */}
      {added.length > 0 && (
        <div className="mt-4 border-t border-[var(--cv-color-border)] pt-3">
          <p className="mb-2 text-[12.5px] font-bold text-[var(--cv-color-text-primary)]">
            Productos cargados ({added.length})
          </p>
          <ul className="space-y-1.5">
            {added.map((p) => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2.5 rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--cv-color-text-primary)]">
                    {p.name}
                  </p>
                  <p className="text-[11.5px] text-[var(--cv-color-text-muted)]">
                    {p.price != null ? `$ ${p.price}` : "Sin precio"}
                  </p>
                </div>
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, duration: 0.2 }}
                  className="rounded-full bg-[var(--cv-color-accent-green-bg)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--cv-color-accent-green)]"
                >
                  Listo
                </motion.span>
                <button
                  type="button"
                  aria-label="Eliminar"
                  onClick={() => remove(p.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--cv-color-text-muted)] hover:text-[var(--cv-color-accent-red)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            ))}
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[var(--cv-color-accent-green)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--cv-color-accent-green)]" />
            {added.length} producto{added.length === 1 ? "" : "s"} cargado
            {added.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={persistAndFinish}
        disabled={!added.length}
        className="cv-btn-primary mt-4 w-full justify-center py-3 text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continuar <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-2 text-[11.5px] text-[var(--cv-color-text-muted)]">
        💡 Podés seguir agregando productos o continuar con la configuración del agente.
      </p>
    </div>
  );
}

/* ----- AI embed ----- */
function AiEmbed({ onFinish }: { onFinish: (display: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [adopted, setAdopted] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setSuggestions([]);
    setAdopted(new Set());
    setTimeout(() => {
      const parsed = parseFreeText(prompt);
      setSuggestions(parsed);
      setGenerating(false);
    }, 700);
  };

  const adopt = (p: Product) => setAdopted((s) => new Set(s).add(p.id));
  const adoptAll = () => setAdopted(new Set(suggestions.map((s) => s.id)));

  const finishWith = async () => {
    const picked = suggestions.filter((s) => adopted.has(s.id));
    if (!picked.length) return;
    try {
      const existing = await loadProductsSafe();
      await saveProducts([...existing, ...picked]);
      onFinish(
        `${picked.length} producto${picked.length === 1 ? "" : "s"} agregado${picked.length === 1 ? "" : "s"} con IA`,
      );
    } catch {
      toast.error("No pudimos guardar los productos.");
    }
  };

  return (
    <div className="cv-card p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3
            className="text-[15px] font-bold text-[var(--cv-color-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Crear catálogo con IA
          </h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--cv-color-text-secondary)]">
            Describí qué vendés y CLERIVO te propondrá productos iniciales.
          </p>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ej: vendo lámparas colgantes artesanales, pantallas de ratán y focos decorativos..."
        rows={3}
        className="mt-3 w-full resize-y rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--cv-color-text-primary)] placeholder:text-[var(--cv-color-text-muted)] focus:border-[var(--cv-color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--cv-color-primary)]/10"
        style={{ minHeight: 80 }}
      />

      <button
        type="button"
        onClick={generate}
        disabled={!prompt.trim() || generating}
        className="cv-btn-primary mt-3 w-full justify-center py-3 text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {generating ? "Generando..." : "Generar productos"}
      </button>

      {/* Generated suggestions */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4"
          >
            <p className="mb-2 text-[12.5px] font-bold text-[var(--cv-color-text-primary)]">
              Sugerencias generadas por IA
            </p>
            <ul className="space-y-2">
              {suggestions.map((s, idx) => (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.2 }}
                  className="flex items-center gap-3 rounded-[10px] border border-[var(--cv-color-border)] bg-white p-2.5"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-[var(--cv-color-bg)] text-[var(--cv-color-text-muted)]"
                    aria-hidden
                  >
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--cv-color-text-primary)]">
                      {s.name}
                    </p>
                    {s.description && (
                      <p className="truncate text-[11.5px] text-[var(--cv-color-text-muted)]">
                        {s.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11.5px] font-semibold text-[var(--cv-color-text-primary)]">
                      {s.price != null ? `$ ${s.price}` : "Sin precio"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => adopt(s)}
                    disabled={adopted.has(s.id)}
                    className={`shrink-0 rounded-[8px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      adopted.has(s.id)
                        ? "border-[var(--cv-color-accent-green)] bg-[var(--cv-color-accent-green-bg)] text-[var(--cv-color-accent-green)]"
                        : "border-[var(--cv-color-primary)] bg-white text-[var(--cv-color-primary)] hover:bg-[var(--cv-color-primary-light)]"
                    }`}
                  >
                    {adopted.has(s.id) ? "✓ Agregado" : "Agregar"}
                  </button>
                </motion.li>
              ))}
            </ul>
            <button
              type="button"
              onClick={adoptAll}
              className="cv-btn-ghost mt-3 w-full justify-center py-2.5 text-[13px]"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar todos al catálogo
            </button>
            <p className="mt-2 text-[11.5px] text-[var(--cv-color-text-muted)]">
              ⓘ Podés editar estos productos más adelante.
            </p>
            {adopted.size > 0 && (
              <button
                type="button"
                onClick={finishWith}
                className="cv-btn-primary mt-3 w-full justify-center py-3 text-[14px]"
              >
                Continuar con {adopted.size} producto
                {adopted.size === 1 ? "" : "s"}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Returns the question shown in the "active question" row below the
 *  chat history. We re-derive it from the same prompts so wording stays
 *  consistent. */
function questionTextFor(step: StepId, d: Partial<AgentProfile>): string {
  switch (step) {
    case "businessName":
      return "¿Cómo se llama tu negocio?";
    case "businessType":
      return "¿A qué se dedica tu negocio?";
    case "businessContext":
      return "¿Tenés sitio web o Instagram para sumar contexto?";
    case "mainGoal":
      return "¿Cuál querés que sea el objetivo del agente?";
    case "tone":
      return "¿Qué tono querés que use tu agente?";
    case "agentName":
      return "¿Cómo querés llamar a tu agente?";
    case "catalog":
      return "¿Cómo querés cargar tu catálogo?";
    default:
      return "";
  }
}

/** "11:42" — local hour/minute for chat timestamps. */
function formatNowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ============================================================
   Active question row — small numbered dot + question text + timestamp
   ============================================================ */
function ActiveQuestion({ stepNumber, question }: { stepNumber: number; question: string }) {
  if (!question) return null;
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--cv-color-primary)] text-[11px] font-bold text-white"
        aria-hidden
      >
        {stepNumber}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-[15.5px] font-semibold text-[var(--cv-color-text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {question}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--cv-color-text-muted)]">{formatNowHM()}</p>
      </div>
    </div>
  );
}

/* ============================================================
   Live summary — desktop sidebar with 6 items + progress bar + motivational footer
   ============================================================ */

/** Maps each tracker step to: label, sidebar-equivalent icon, and the
 *  derived "value or pendiente" string from the current draft. */
function summaryItemsFor(
  d: Partial<AgentProfile>,
  revisited?: Set<StepId>,
): Array<{
  key: string;
  label: string;
  icon: typeof Store;
  value: string | null;
}> {
  // Helper: if the step has been revisited (user went back), hide its
  // value in the summary even though the draft still holds it. The user
  // can re-confirm to make it reappear.
  const v = (stepId: StepId, raw: string | null): string | null => {
    if (revisited?.has(stepId)) return null;
    return raw;
  };

  return [
    {
      key: "negocio",
      label: "Negocio",
      icon: Store,
      value: v("businessName", d.businessName?.trim() || null),
    },
    {
      key: "rubro",
      label: "Rubro",
      icon: Tag,
      value: v("businessType", d.businessType?.trim() || null),
    },
    {
      key: "contexto",
      label: "Contexto",
      icon: FileText,
      value: v(
        "businessContext",
        [d.websiteUrl, d.instagramUrl].filter(Boolean).join(" · ") || null,
      ),
    },
    {
      key: "objetivo",
      label: "Objetivo",
      icon: Target,
      value: v("mainGoal", d.mainGoal?.trim() || null),
    },
    {
      key: "tono",
      label: "Tono",
      icon: MessageCircle,
      value: v("tone", d.tone?.trim() || null),
    },
    {
      key: "agente",
      label: "Agente",
      icon: Bot,
      value: v("agentName", d.agentName?.trim() || null),
    },
    // Catálogo intentionally omitted — the wizard no longer asks for it.
    // Catalog management lives in the post-wizard AgentDashboard.
  ];
}

function LiveSummary({
  draft,
  currentStep,
  revisitedSteps,
}: {
  draft: Partial<AgentProfile>;
  currentStep: StepId;
  revisitedSteps?: Set<StepId>;
}) {
  const items = summaryItemsFor(draft, revisitedSteps);
  const completed = items.filter((it) => !!it.value).length;
  const total = items.length;
  const pct = (completed / total) * 100;

  const currentTrackerIdx = trackerIndexForStep(currentStep);
  let motivational = "Vas por buen camino. · Podés ajustar estos datos después.";
  // Tracker indices after removing "Catálogo": 0..5 (Listo is now 5).
  if (currentTrackerIdx === 5) {
    motivational = "¡Todo listo! · Tu agente está preparado para empezar.";
  }

  return (
    <aside className="cv-card animate-fade-up p-3 lg:sticky lg:top-3" aria-label="Resumen en vivo">
      <h2
        className="text-[14px] font-bold leading-tight text-[var(--cv-color-text-primary)]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Resumen en vivo
      </h2>
      <p className="mt-0.5 text-[11.5px] text-[var(--cv-color-text-secondary)]">
        {completed} de {total} pasos completados
      </p>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--cv-color-border)]">
        <div
          className="h-full rounded-full bg-[var(--cv-color-primary)] transition-[width] duration-400 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-2">
        {items.map((it, idx) => {
          const Icon = it.icon;
          const done = !!it.value;
          return (
            <li
              key={it.key}
              className={`flex items-center gap-2 py-1.5 ${
                idx < items.length - 1 ? "border-b border-[var(--cv-color-border)]" : ""
              }`}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)]"
                aria-hidden
              >
                <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium leading-tight text-[var(--cv-color-text-muted)]">
                  {it.label}
                </p>
                <p
                  className={`mt-0.5 truncate text-[12px] font-semibold leading-tight ${
                    done
                      ? "text-[var(--cv-color-text-primary)]"
                      : "text-[var(--cv-color-text-secondary)]"
                  }`}
                >
                  {it.value || "Pendiente"}
                </p>
              </div>
              {done ? (
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--cv-color-accent-green)] text-white animate-[pop_400ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
                  aria-label="Completado"
                >
                  <Check className="h-[9px] w-[9px]" strokeWidth={3} />
                </span>
              ) : (
                <span
                  className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-[var(--cv-color-border)]"
                  aria-label="Pendiente"
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-start gap-1.5 rounded-[8px] bg-[var(--cv-color-primary-light)] px-3 py-2">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[var(--cv-color-primary)]" />
        <p className="text-[11px] font-medium leading-snug text-[var(--cv-color-primary-hover)]">
          {motivational}
        </p>
      </div>
    </aside>
  );
}

/* ============================================================
   Step 7 — celebration card with animated check + sparkles
   ============================================================ */

function CelebrationCard({
  agent,
  onSimulate,
  onView,
}: {
  agent: AgentProfile;
  onSimulate: () => void | Promise<void>;
  onView: () => void | Promise<void>;
}) {
  const name = agent.agentName?.trim() || "Tu agente";
  return (
    <div className="cv-card animate-[fadeUp_300ms_ease-out_both] overflow-hidden">
      {/* System final message */}
      <div className="border-b border-[var(--cv-color-border)] p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)]"
            aria-hidden
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="max-w-[85%]">
            <div className="rounded-[16px] rounded-tl-[6px] bg-[#F3F4F6] px-4 py-3 text-[14.5px] leading-relaxed text-[var(--cv-color-text-primary)]">
              <b>Listo.</b> Tu Agente IA ya está configurado. Ahora podés probar cómo responde antes
              de usarlo con tus clientes.
            </div>
            <p className="mt-1 pl-1 text-[11px] text-[var(--cv-color-text-muted)]">
              {formatNowHM()}
            </p>
          </div>
        </div>
      </div>

      {/* Celebration block */}
      <div className="bg-[var(--cv-color-primary-light)] px-6 py-10 text-center sm:px-10 sm:py-12">
        <div className="relative mx-auto h-[88px] w-[88px]">
          {/* Decorative sparkles */}
          <Sparkles
            className="absolute -left-6 -top-3 h-4 w-4 text-[var(--cv-color-primary)] opacity-0"
            style={{
              animation:
                "fadeIn 200ms ease-out 700ms forwards, float 3s ease-in-out 700ms infinite",
            }}
          />
          <Sparkles
            className="absolute -right-5 top-1 h-3 w-3 text-[var(--cv-color-primary)] opacity-0"
            style={{
              animation:
                "fadeIn 200ms ease-out 850ms forwards, float 3.2s ease-in-out 850ms infinite",
            }}
          />
          <Sparkles
            className="absolute -bottom-2 -right-7 h-4 w-4 text-[var(--cv-color-primary)] opacity-0"
            style={{
              animation:
                "fadeIn 200ms ease-out 1000ms forwards, float 3.4s ease-in-out 1000ms infinite",
            }}
          />
          {/* Animated circle */}
          <svg viewBox="0 0 88 88" className="h-full w-full" aria-hidden>
            <circle
              cx="44"
              cy="44"
              r="40"
              fill="none"
              stroke="var(--cv-color-primary)"
              strokeWidth="2.5"
              style={{
                strokeDasharray: 252,
                strokeDashoffset: 252,
                animation: "celebStroke 600ms ease-in-out forwards",
                transformOrigin: "center",
                transform: "rotate(-90deg)",
              }}
            />
          </svg>
          {/* Check inside */}
          <span
            className="absolute inset-0 flex items-center justify-center text-[var(--cv-color-primary)] opacity-0"
            style={{
              animation: "celebCheck 300ms ease-out 500ms forwards",
            }}
            aria-hidden
          >
            <Check className="h-9 w-9" strokeWidth={3} />
          </span>
        </div>

        <h2
          className="mt-6 text-[22px] font-extrabold tracking-tight text-[var(--cv-color-text-primary)] sm:text-[24px]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {name} IA listo
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[var(--cv-color-text-secondary)]">
          {name} ya está configurada para responder consultas, usar el tono de tu negocio y trabajar
          con las reglas iniciales de CLERIVO.
        </p>

        {/* Confirmation chips — catalog is no longer part of the wizard
            so its chip is gone too. */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {["Perfil configurado", "Reglas iniciales listas"].map((label, idx) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--cv-color-accent-green)] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[var(--cv-color-accent-green)] opacity-0"
              style={{
                animation: `fadeUp 280ms ease-out ${900 + idx * 100}ms forwards`,
              }}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2.5 p-4 sm:flex-row sm:p-6">
        <button
          type="button"
          onClick={onSimulate}
          className="cv-btn-primary flex-1 justify-center px-6 py-3.5 text-[14.5px]"
        >
          <Sparkles className="h-4 w-4" />
          Probar en Simulador
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onView}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-[var(--cv-color-border)] bg-white px-6 py-3.5 text-[14.5px] font-semibold text-[var(--cv-color-text-primary)] transition hover:bg-[var(--cv-color-bg)]"
        >
          <Eye className="h-4 w-4" />
          Ver Agente IA
        </button>
      </div>

      {/* Mobile-only final summary list */}
      <MobileFinalSummary agent={agent} />
    </div>
  );
}

/** Mobile-only resumen final inside the celebration card. Mirrors the
 *  desktop "Resumen en vivo" data but with all checks completed. */
function MobileFinalSummary({ agent }: { agent: AgentProfile }) {
  const draftLike: Partial<AgentProfile> = {
    businessName: agent.businessName,
    businessType: agent.businessType,
    websiteUrl: agent.websiteUrl,
    instagramUrl: agent.instagramUrl,
    mainGoal: agent.mainGoal,
    tone: agent.tone,
    agentName: agent.agentName,
    catalogEnabled: agent.catalogEnabled,
  };
  const items = summaryItemsFor(draftLike);

  return (
    <div className="border-t border-[var(--cv-color-border)] p-4 lg:hidden">
      <h3
        className="text-[15px] font-bold text-[var(--cv-color-text-primary)]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Resumen final
      </h3>
      <ul className="mt-3">
        {items.map((it, idx) => {
          const Icon = it.icon;
          return (
            <li
              key={it.key}
              className={`flex items-center gap-3 py-2.5 ${
                idx < items.length - 1 ? "border-b border-[var(--cv-color-border)]" : ""
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[var(--cv-color-text-muted)]">
                  {it.label}
                </p>
                <p className="truncate text-[13.5px] font-semibold text-[var(--cv-color-text-primary)]">
                  {it.value || "—"}
                </p>
              </div>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--cv-color-accent-green)] text-white">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-center text-[12px] text-[var(--cv-color-text-muted)]">
        Podés ajustar esta configuración más adelante.
      </p>
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
    case "businessContext":
      return (
        <>
          ¿Tu negocio tiene <b>página web</b> o <b>Instagram</b> donde pueda conocerte mejor? Es
          opcional, pero ayuda a que las respuestas sean más precisas.
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
      return (
        <>
          <b>Tu agente quedó configurado.</b> Revisá el resumen y confirmá.
        </>
      );
    default:
      return null;
  }
}

/** Shared chip — pill outlined in primary purple, fills on click. */
function OptionChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group min-h-9 rounded-full border-[1.5px] px-[18px] py-[7px] text-[14px] font-medium transition-all duration-150 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-[var(--cv-color-primary)] bg-[var(--cv-color-primary)] text-white"
          : "border-[var(--cv-color-primary)] bg-white text-[var(--cv-color-primary)] hover:bg-[var(--cv-color-primary-light)]"
      }`}
    >
      {label}
    </button>
  );
}

/** Shared text input + send button row used by the name steps. */
/** Free-text input row. Supports:
 *  - inputRef: parent can call .focus() on it (used by the "Otro" chip flow)
 *  - attention: when true, the input glows in primary + plays a single
 *    pulse animation to draw the user's eye to it. */
const ChatInputRow = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    placeholder: string;
    disabled?: boolean;
    attention?: boolean;
    /** Bumped key forces a re-run of the pulse animation. */
    attentionKey?: number;
  }
>(function ChatInputRow(
  { value, onChange, onSubmit, placeholder, disabled, attention, attentionKey },
  ref,
) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onSubmit();
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={ref}
        key={`input-${attentionKey ?? 0}`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`h-10 flex-1 rounded-[10px] border-[1.5px] bg-white px-3.5 text-[13.5px] text-[var(--cv-color-text-primary)] placeholder:text-[var(--cv-color-text-muted)] focus:outline-none focus:ring-[3px] focus:ring-[var(--cv-color-primary)]/15 disabled:opacity-50 ${
          attention
            ? "border-[var(--cv-color-primary)] shadow-[0_0_0_3px_rgba(79,70,229,0.18)] animate-[inputPulse_300ms_ease-out_1]"
            : "border-[var(--cv-color-border)] focus:border-[var(--cv-color-primary)]"
        }`}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Enviar"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--cv-color-primary)] text-white transition-all duration-150 hover:bg-[var(--cv-color-primary-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    </form>
  );
});

function StepInput({
  step,
  draft,
  disabled,
  onAdvance,
  onFinish: _onFinish,
  onFinishAndSimulate: _onFinishAndSimulate,
  onRestart: _onRestart,
  registerSubmit,
}: {
  step: StepId;
  draft: Partial<AgentProfile>;
  disabled: boolean;
  onAdvance: (updated: Partial<AgentProfile>, display: React.ReactNode) => void;
  onFinish: (final: AgentProfile) => void;
  onFinishAndSimulate: (final: AgentProfile) => void;
  onRestart: () => void;
  /** Lets the parent (desktop "Continuar" button, mobile sticky bottom)
   *  trigger this step's submit logic without owning the input state. */
  registerSubmit?: (fn: () => void) => void;
}) {
  const [text, setText] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  // For the businessContext step we keep both fields locally so the
  // parent can submit both via registerSubmit.
  const [web, setWeb] = useState(draft.websiteUrl ?? "");
  const [ig, setIg] = useState(draft.instagramUrl ?? "");

  useEffect(() => {
    setText("");
    setMulti([]);
    setWeb(draft.websiteUrl ?? "");
    setIg(draft.instagramUrl ?? "");
    // step change resets local state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ---- Name steps ---- */
  if (step === "businessName" || step === "agentName") {
    const isAgent = step === "agentName";
    const suggestions = isAgent ? suggestAgentNames(draft.businessType ?? "") : [];
    const submit = () => {
      const v = text.trim();
      if (!v) return;
      const updated = isAgent ? { ...draft, agentName: v } : { ...draft, businessName: v };
      onAdvance(updated, v);
    };
    registerSubmit?.(submit);
    return (
      <div className="space-y-3">
        {isAgent && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <OptionChip
                key={s}
                label={s}
                disabled={disabled}
                onClick={() => onAdvance({ ...draft, agentName: s }, s)}
              />
            ))}
          </div>
        )}
        <ChatInputRow
          value={text}
          onChange={setText}
          onSubmit={submit}
          placeholder={isAgent ? "Ej: Sofía" : "Escribí tu respuesta..."}
          disabled={disabled}
        />
      </div>
    );
  }

  /* ---- Chip-only steps ---- */
  if (step === "businessType") {
    registerSubmit?.(() => {});
    return (
      <div className="flex flex-wrap gap-2">
        {businessTypes.map((o) => (
          <OptionChip
            key={o}
            label={o}
            disabled={disabled}
            onClick={() => onAdvance({ ...draft, businessType: o }, o)}
          />
        ))}
      </div>
    );
  }

  if (step === "tone") {
    registerSubmit?.(() => {});
    return (
      <div className="flex flex-wrap gap-2">
        {tones.map((o) => (
          <OptionChip
            key={o}
            label={o}
            disabled={disabled}
            onClick={() => onAdvance({ ...draft, tone: o }, o)}
          />
        ))}
      </div>
    );
  }

  /* ---- Business context (web + IG) ---- */
  if (step === "businessContext") {
    const submit = () => {
      const w = web.trim();
      const i = ig.trim();
      const updated = {
        ...draft,
        websiteUrl: w || undefined,
        instagramUrl: i || undefined,
      };
      const summary = [w, i].filter(Boolean).join(" · ") || "Saltar este paso";
      onAdvance(updated, summary);
    };
    registerSubmit?.(submit);
    return (
      <BusinessContextInput
        draft={{ ...draft, websiteUrl: web, instagramUrl: ig }}
        disabled={disabled}
        onChange={(w, i) => {
          setWeb(w);
          setIg(i);
        }}
        onSubmit={submit}
      />
    );
  }

  /* ---- Main goal (single-select chips + advance immediately) ---- */
  if (step === "mainGoal") {
    registerSubmit?.(() => {
      if (!multi.length) return;
      onAdvance({ ...draft, mainGoal: multi[0] }, multi.join(", "));
    });
    return (
      <div className="flex flex-wrap gap-2">
        {goals.map((o) => (
          <OptionChip
            key={o}
            label={o}
            disabled={disabled}
            onClick={() => {
              setMulti([o]);
              onAdvance({ ...draft, mainGoal: o }, o);
            }}
          />
        ))}
      </div>
    );
  }

  /* ---- Catalog ---- */
  if (step === "catalog") {
    registerSubmit?.(() => {});
    const opts: Array<{ label: string; enabled: boolean }> = [
      { label: "Cargar CSV", enabled: true },
      { label: "Agregar manualmente", enabled: true },
      { label: "Crear con IA", enabled: true },
      { label: "Hacerlo después", enabled: false },
    ];
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {opts.map((o) => (
            <OptionChip
              key={o.label}
              label={o.label}
              disabled={disabled}
              onClick={() => onAdvance({ ...draft, catalogEnabled: o.enabled }, o.label)}
            />
          ))}
        </div>
        <div className="flex items-start gap-2 rounded-[12px] bg-[var(--cv-color-primary-light)] px-3.5 py-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cv-color-primary)]" />
          <p className="text-[12.5px] font-medium leading-snug text-[var(--cv-color-primary-hover)]">
            Catálogo inteligente · podés ajustar los productos más tarde desde Agente IA.
          </p>
        </div>
      </div>
    );
  }

  // summary is rendered as the CelebrationCard externally
  return null;
}

/** Optional website + Instagram step in the builder chat.
 *  Both inputs are optional; the user can submit with empty values to skip. */
function BusinessContextInput({
  draft,
  disabled,
  onSubmit,
  onChange,
}: {
  draft: Partial<AgentProfile>;
  disabled: boolean;
  onSubmit: (web: string, instagram: string) => void;
  onChange?: (web: string, instagram: string) => void;
}) {
  const [web, setWeb] = useState(draft.websiteUrl ?? "");
  const [ig, setIg] = useState(draft.instagramUrl ?? "");

  const inputCls =
    "h-12 w-full rounded-[12px] border-[1.5px] border-[var(--cv-color-border)] bg-white px-4 text-[14px] text-[var(--cv-color-text-primary)] placeholder:text-[var(--cv-color-text-muted)] focus:border-[var(--cv-color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--cv-color-primary)]/10 disabled:opacity-50";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(web.trim(), ig.trim());
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="url"
          inputMode="url"
          autoComplete="url"
          value={web}
          onChange={(e) => {
            setWeb(e.target.value);
            onChange?.(e.target.value, ig);
          }}
          disabled={disabled}
          placeholder="https://tunegocio.com"
          className={inputCls}
        />
        <input
          type="text"
          autoComplete="off"
          value={ig}
          onChange={(e) => {
            setIg(e.target.value);
            onChange?.(web, e.target.value);
          }}
          disabled={disabled}
          placeholder="@tu_negocio o instagram.com/…"
          className={inputCls}
        />
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit("", "")}
        className="text-[12.5px] font-semibold text-[var(--cv-color-primary)] underline-offset-2 hover:underline disabled:opacity-50"
      >
        Saltar este paso
      </button>
    </form>
  );
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
                  ? "border-primary bg-gradient-primary text-primary-foreground"
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

/**
 * SummaryCard — compact, premium agent recap rendered as the last AI
 * message in the builder chat.  Replaces the old large grid-of-rows card.
 *
 * Layout: avatar + name (·listo) · subtitle  +  chips · note · 3 actions
 * The primary CTA keeps the gradient + glow; the other two are subordinate.
 */
function SummaryCard({
  agent,
  onSimulate,
  onView,
  onRestart,
}: {
  agent: AgentProfile;
  onSimulate: () => void | Promise<void>;
  onView: () => void | Promise<void>;
  onRestart: () => void;
}) {
  const initial = (agent.agentName || "A").trim().charAt(0).toUpperCase();
  const subtitle =
    [agent.businessName, agent.businessType].filter(Boolean).join(" · ") || "Tu negocio";

  return (
    <div className="surface-card max-w-md rounded-2xl rounded-bl-md p-4">
      {/* Identity row */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-base font-bold text-primary-foreground">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-tight">
            {agent.agentName || "Tu agente"}
            <span className="ml-1.5 font-normal text-muted-foreground">· listo</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Meta chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {agent.mainGoal && (
          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary">
            {agent.mainGoal}
          </span>
        )}
        {agent.tone && (
          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary">
            {agent.tone}
          </span>
        )}
        {agent.catalogEnabled && (
          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary">
            Con catálogo
          </span>
        )}
      </div>

      {/* Note */}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Las reglas avanzadas las podés configurar después en{" "}
        <b className="text-foreground">Agente IA &gt; Reglas</b>.
      </p>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onSimulate} className="h-9 rounded-lg text-xs">
          <Sparkles className="h-3.5 w-3.5" /> Probar en Simulador
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onView}
          className="h-9 rounded-lg text-xs"
        >
          Ver configuración
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onRestart}
          className="ml-auto h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:no-underline sm:ml-0"
        >
          Empezar de nuevo
        </Button>
      </div>
    </div>
  );
}

// ---------------------------- Dashboard with accordions ----------------------------

/* ============================================================
   AgentDashboard — Apple-grade redesign
   --------------------------------------------------------------
   Two views: a presentation "card" (the default) and an editable
   "edit" form. The legacy accordions for catalog and rules were
   removed at the user's request — agent configuration now lives
   entirely within the new EditView.

   Backwards-compatible: every field saved here lands inside the
   existing AgentProfile (newly added optional fields). Old agents
   keep working — missing fields fall back to sensible defaults.
   ============================================================ */

type DashView = "card" | "edit";

/** Pool of selectable tones shown in the edit screen. The agent's
 *  primary `tone` is always included in this list so prior selections
 *  remain visible. */
const TONE_OPTIONS = [
  "Amable",
  "Cercano",
  "Profesional",
  "Claro y directo",
  "Empático",
  "Formal",
  "Casual",
  "Cálido",
  "Premium",
];

/** Renders the avatar — custom upload or a sleek placeholder built from
 *  the agent's initials over a primary-light disc. */
function AgentAvatar({
  agent,
  size,
  className,
}: {
  agent: AgentProfile;
  /** Diameter in pixels. */
  size: number;
  className?: string;
}) {
  const initials = (agent.agentName || "A").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ${
        className ?? ""
      }`}
      style={{
        width: size,
        height: size,
        background: "var(--cv-color-primary-light)",
      }}
      aria-label={`Avatar de ${agent.agentName || "tu agente"}`}
    >
      {agent.avatarUrl ? (
        <img
          src={agent.avatarUrl}
          alt={agent.agentName || "Agente"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-extrabold text-[var(--cv-color-primary)]"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: Math.round(size * 0.38),
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

/** Apple-style sliding switch — purely visual, drives a boolean. */
function IOSSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out ${
        checked ? "bg-[var(--cv-color-primary)]" : "bg-[var(--cv-color-border)]"
      }`}
      style={{ touchAction: "manipulation" }}
    >
      <span
        className="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm"
        style={{
          transform: checked ? "translateX(22px)" : "translateX(2px)",
          transition: "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />
    </button>
  );
}

/** Apple-style segmented Activo / Apagado pill. */
function ActiveToggle({
  enabled,
  onToggle,
  size = "md",
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void | Promise<void>;
  size?: "md" | "lg";
}) {
  const padding = size === "lg" ? "px-5 py-2" : "px-4 py-1.5";
  const text = size === "lg" ? "text-[14px]" : "text-[13px]";
  return (
    <div
      role="group"
      aria-label="Estado del agente"
      className="inline-flex items-center gap-1 rounded-full bg-[var(--cv-color-bg)] p-1"
    >
      <button
        type="button"
        onClick={() => onToggle(true)}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold leading-tight transition-all duration-200 ease-out ${padding} ${text} ${
          enabled
            ? "bg-[#F0FDF4] text-[#16A34A] shadow-sm"
            : "text-[var(--cv-color-text-muted)] hover:text-[var(--cv-color-text-primary)]"
        }`}
      >
        {enabled && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        Activo
      </button>
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold leading-tight transition-all duration-200 ease-out ${padding} ${text} ${
          !enabled
            ? "bg-white text-[var(--cv-color-text-primary)] shadow-sm"
            : "text-[var(--cv-color-text-muted)] hover:text-[var(--cv-color-text-primary)]"
        }`}
      >
        Apagado
      </button>
    </div>
  );
}

/** Apple curves used through the dashboard. */
const APPLE_EASE_OUT = [0.25, 0.46, 0.45, 0.94] as const;
const APPLE_SPRING = [0.34, 1.56, 0.64, 1] as const;

/** Capability item with icon + label rendered on the presentation card. */
function CapabilityRow({
  icon: Icon,
  label,
  delay,
}: {
  icon: typeof MessageCircle;
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay, ease: APPLE_EASE_OUT as unknown as number[] }}
      className="flex items-center gap-3 border-t border-[var(--cv-color-border)]/60 py-3 first:border-t-0 first:pt-0"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)]">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="text-[15px] font-medium text-[var(--cv-color-text-primary)]">{label}</span>
    </motion.div>
  );
}

/** Derives 3 short capability labels from the agent's main goal. */
function capabilitiesFor(agent: AgentProfile): Array<{
  icon: typeof MessageCircle;
  label: string;
}> {
  const goal = (agent.mainGoal || "").toLowerCase();
  const items: Array<{ icon: typeof MessageCircle; label: string }> = [];
  // 1. Always a "respond" capability — every agent answers queries.
  items.push({ icon: MessageCircle, label: "Responde consultas" });
  // 2. Sales-related capability — when the goal is selling or qualifying leads.
  if (goal.includes("vend") || goal.includes("calif")) {
    items.push({ icon: ShoppingBag, label: "Ayuda a vender" });
  } else if (goal.includes("seguim")) {
    items.push({ icon: ShoppingBag, label: "Da seguimiento a clientes" });
  } else {
    items.push({ icon: ShoppingBag, label: "Guía a los clientes" });
  }
  // 3. Tone-keeping capability — always present.
  items.push({ icon: Shield, label: "Mantiene el tono del negocio" });
  return items;
}

function AgentDashboard({
  agent,
  onUpdate,
  onReset,
}: {
  agent: AgentProfile;
  onUpdate: (a: AgentProfile) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}) {
  const [view, setView] = useState<DashView>("card");
  const enabled = agent.enabled ?? true;

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--cv-color-bg)] px-4 py-6 sm:px-6 sm:py-8 lg:px-10"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="mx-auto max-w-5xl">
        <AnimatePresence mode="wait">
          {view === "card" && (
            <motion.div
              key="card-view"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.3, ease: APPLE_EASE_OUT as unknown as number[] }}
            >
              <CardView
                agent={agent}
                enabled={enabled}
                onToggleEnabled={(v) => onUpdate({ ...agent, enabled: v })}
                onOpenEdit={() => setView("edit")}
              />
            </motion.div>
          )}

          {view === "edit" && (
            <motion.div
              key="edit-view"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{
                duration: 0.3,
                delay: 0.05,
                ease: APPLE_EASE_OUT as unknown as number[],
              }}
            >
              <EditView
                agent={agent}
                onSave={async (a) => {
                  await onUpdate(a);
                  setView("card");
                }}
                onCancel={() => setView("card")}
                onReset={onReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================================================
   CARD VIEW — presentation (matches agenteclerivopc.png / mobile.png)
   ============================================================ */
function CardView({
  agent,
  enabled,
  onToggleEnabled,
  onOpenEdit,
}: {
  agent: AgentProfile;
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void | Promise<void>;
  onOpenEdit: () => void;
}) {
  const description =
    agent.shortDescription?.trim() ||
    agent.description?.trim() ||
    `Responde consultas, guía a los clientes y mantiene el tono de ${
      agent.businessName || "tu negocio"
    }.`;
  const capabilities = capabilitiesFor(agent);
  const handleToggleEnabled = async (value: boolean) => {
    try {
      await onToggleEnabled(value);
    } catch {
      /* parent shows the API error toast */
    }
  };

  return (
    <>
      {/* Page title */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: APPLE_EASE_OUT as unknown as number[] }}
        className="mb-5 sm:mb-6"
      >
        <h1
          className="text-[26px] font-extrabold tracking-tight text-[var(--cv-color-text-primary)] sm:text-[30px]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Agente IA
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--cv-color-text-secondary)] sm:text-[15px]">
          Revisá y ajustá el asistente principal de tu negocio de forma simple y guiada.
        </p>
      </motion.header>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: APPLE_EASE_OUT as unknown as number[] }}
        className="cv-card overflow-hidden"
      >
        <div className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-stretch md:gap-10">
          {/* LEFT — profile */}
          <div className="flex flex-1 flex-col items-center justify-center text-center md:py-2">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.1, ease: APPLE_SPRING as unknown as number[] }}
            >
              <AgentAvatar
                agent={agent}
                size={typeof window !== "undefined" && window.innerWidth < 768 ? 160 : 200}
                className="mx-auto"
              />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.2,
                ease: APPLE_EASE_OUT as unknown as number[],
              }}
              className="mt-5 text-[28px] font-extrabold leading-tight text-[var(--cv-color-text-primary)] sm:text-[32px]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {agent.agentName || "Tu agente"}
            </motion.h2>

            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.3 }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--cv-color-primary)] bg-white px-3 py-1 text-[12.5px] font-semibold text-[var(--cv-color-primary)]"
            >
              <User2 className="h-3.5 w-3.5" />
              Asistente principal
            </motion.span>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.35 }}
              className="mt-4"
            >
              <ActiveToggle enabled={enabled} onToggle={handleToggleEnabled} size="lg" />
            </motion.div>
          </div>

          {/* RIGHT — capabilities + CTA */}
          <div className="flex flex-1 flex-col">
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.25,
                ease: APPLE_EASE_OUT as unknown as number[],
              }}
              className="text-[15px] leading-relaxed text-[var(--cv-color-text-primary)] sm:text-[16px]"
            >
              {description}
            </motion.p>

            <div className="mt-5 flex-1">
              {capabilities.map((c, idx) => (
                <CapabilityRow
                  key={c.label}
                  icon={c.icon}
                  label={c.label}
                  delay={0.35 + idx * 0.08}
                />
              ))}
            </div>

            <motion.button
              type="button"
              onClick={onOpenEdit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.6 }}
              whileTap={{ scale: 0.97 }}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-[var(--cv-color-primary)] bg-white text-[15px] font-semibold text-[var(--cv-color-primary)] transition-colors duration-150 hover:bg-[var(--cv-color-primary-light)]"
            >
              Ver agente
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ============================================================
   EDIT VIEW — full configuration form (matches agenteclerivopc2.png)
   ============================================================ */
function EditView({
  agent,
  onSave,
  onCancel,
  onReset,
}: {
  agent: AgentProfile;
  onSave: (a: AgentProfile) => void | Promise<void>;
  onCancel: () => void;
  onReset: () => void | Promise<void>;
}) {
  // Local working copy — only persists when the user hits "Guardar".
  const [draft, setDraft] = useState<AgentProfile>(() => ({
    ...agent,
    enabled: agent.enabled ?? true,
    tones: agent.tones && agent.tones.length > 0 ? agent.tones : agent.tone ? [agent.tone] : [],
    instructions: agent.instructions ?? agent.shortDescription ?? "",
    language: agent.language ?? "Español",
    useEmojis: agent.useEmojis ?? false,
    escalateComplex: agent.escalateComplex ?? false,
    prioritizeTone: agent.prioritizeTone ?? false,
  }));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const update = <K extends keyof AgentProfile>(key: K, value: AgentProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleTone = (t: string) => {
    setDraft((d) => {
      const tones = d.tones ?? [];
      const next = tones.includes(t) ? tones.filter((x) => x !== t) : [...tones, t];
      // Keep the legacy single-tone field in sync with the first selection.
      return { ...d, tones: next, tone: next[0] ?? d.tone };
    });
  };

  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => update("avatarUrl", String(reader.result));
    reader.readAsDataURL(f);
  };

  const inputCls =
    "h-10 w-full rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3.5 text-[13.5px] text-[var(--cv-color-text-primary)] placeholder:text-[var(--cv-color-text-muted)] focus:border-[var(--cv-color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--cv-color-primary)]/10";
  const textareaCls =
    "w-full resize-y rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[var(--cv-color-text-primary)] placeholder:text-[var(--cv-color-text-muted)] focus:border-[var(--cv-color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--cv-color-primary)]/10";

  const selectedTones = draft.tones ?? [];
  const handleSave = async () => {
    try {
      await onSave(draft);
    } catch {
      /* parent shows the API error toast */
    }
  };
  const handleReset = async () => {
    try {
      await onReset();
    } catch {
      /* parent shows the API error toast */
    }
  };

  return (
    <>
      {/* Back + header */}
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Volver"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--cv-color-bg)] px-3 py-1.5 text-[13px] font-semibold text-[var(--cv-color-text-primary)] transition hover:bg-[var(--cv-color-border)]/60"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </div>

      <header className="mb-5 sm:mb-6">
        <h1
          className="text-[26px] font-extrabold tracking-tight text-[var(--cv-color-text-primary)] sm:text-[30px]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Agente IA
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--cv-color-text-secondary)] sm:text-[15px]">
          Editá la personalidad, información y comportamiento principal de tu asistente.
        </p>
      </header>

      {/* Main edit card */}
      <div className="cv-card p-5 sm:p-7">
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:gap-8">
          {/* LEFT — Configuración del agente */}
          <section>
            <h2
              className="mb-4 text-[15px] font-bold text-[var(--cv-color-text-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Configuración del agente
            </h2>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* Avatar + change button */}
              <div className="flex shrink-0 flex-col items-center gap-2 sm:items-start">
                <AgentAvatar agent={draft} size={104} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarPick}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3 text-[12.5px] font-semibold text-[var(--cv-color-text-primary)] transition hover:bg-[var(--cv-color-bg)]"
                >
                  <Camera className="h-3.5 w-3.5" /> Cambiar avatar
                </button>
              </div>

              {/* Form fields */}
              <div className="flex-1 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
                    Nombre del agente
                  </span>
                  <input
                    value={draft.agentName}
                    onChange={(e) => update("agentName", e.target.value)}
                    placeholder="Ej: Clara"
                    className={inputCls}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
                    Descripción breve
                  </span>
                  <textarea
                    value={draft.description ?? ""}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Asistente principal que responde consultas, guía a tus clientes y mantiene el tono del negocio."
                    rows={3}
                    className={textareaCls}
                    style={{ minHeight: 72 }}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
                    Objetivo principal
                  </span>
                  <input
                    value={draft.mainGoal}
                    onChange={(e) => update("mainGoal", e.target.value)}
                    placeholder="Ej: Responder consultas y ayudar a vender"
                    className={inputCls}
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
                    Estado del agente
                  </span>
                  <ActiveToggle
                    enabled={draft.enabled ?? true}
                    onToggle={(v) => update("enabled", v)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT — Tone + Instructions */}
          <section className="flex flex-col gap-6">
            <div>
              <h2
                className="mb-3 text-[15px] font-bold text-[var(--cv-color-text-primary)]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Tono del agente
              </h2>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((t) => {
                  const selected = selectedTones.includes(t);
                  return (
                    <motion.button
                      key={t}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleTone(t)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150 ease-out ${
                        selected
                          ? "border-transparent bg-[var(--cv-color-primary)] text-white shadow-sm"
                          : "border-[var(--cv-color-border)] bg-white text-[var(--cv-color-text-primary)] hover:border-[var(--cv-color-primary)] hover:bg-[var(--cv-color-primary-light)]"
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                      {t}
                    </motion.button>
                  );
                })}
              </div>
              {selectedTones.length > 0 && (
                <p className="mt-2 text-[12px] italic text-[var(--cv-color-text-muted)]">
                  Tonos seleccionados: {humanList(selectedTones)}.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2
                  className="text-[15px] font-bold text-[var(--cv-color-text-primary)]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Instrucciones del agente
                </h2>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--cv-color-text-primary)] transition hover:bg-[var(--cv-color-bg)]"
                  onClick={() => {
                    /* Anchor for future attachments — no-op for now */
                  }}
                >
                  <Paperclip className="h-3 w-3" /> Adjuntar texto
                </button>
              </div>
              <textarea
                value={draft.instructions ?? ""}
                onChange={(e) => update("instructions", e.target.value)}
                placeholder="Definí instrucciones específicas que el agente debe seguir. Reglas de cortesía, frases prohibidas, escalación, etc."
                rows={7}
                className={`${textareaCls} scrollbar-clerivo`}
                style={{ minHeight: 160 }}
              />
            </div>
          </section>
        </div>

        {/* Parámetros adicionales */}
        <div className="mt-7 border-t border-[var(--cv-color-border)] pt-6">
          <h2
            className="mb-4 text-[15px] font-bold text-[var(--cv-color-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Parámetros adicionales
          </h2>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Idioma */}
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
                Idioma
              </span>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cv-color-text-muted)]" />
                <select
                  value={draft.language ?? "Español"}
                  onChange={(e) => update("language", e.target.value)}
                  className={`${inputCls} appearance-none pl-9 pr-9`}
                >
                  <option>Español</option>
                  <option>Inglés</option>
                  <option>Portugués</option>
                  <option>Francés</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cv-color-text-muted)]" />
              </div>
            </label>

            {/* Uso de emojis */}
            <div>
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--cv-color-text-secondary)]">
                Uso de emojis
              </span>
              <div className="inline-flex items-center gap-1 rounded-full bg-[var(--cv-color-bg)] p-1">
                {(["sí", "no"] as const).map((opt) => {
                  const active = (opt === "sí" ? true : false) === (draft.useEmojis ?? false);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => update("useEmojis", opt === "sí")}
                      className={`rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize leading-tight transition-all duration-200 ease-out ${
                        active
                          ? "bg-white text-[var(--cv-color-text-primary)] shadow-sm"
                          : "text-[var(--cv-color-text-muted)] hover:text-[var(--cv-color-text-primary)]"
                      }`}
                    >
                      {opt === "sí" ? "Sí" : "No"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Switches (ocupan la tercera columna en lg, full en mobile) */}
            <div className="space-y-3 lg:col-span-1 sm:col-span-2 lg:row-span-1">
              <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3.5 py-2.5">
                <span className="text-[12.5px] font-semibold text-[var(--cv-color-text-primary)]">
                  Derivar a humano si la consulta es compleja
                </span>
                <IOSSwitch
                  checked={draft.escalateComplex ?? false}
                  onChange={(v) => update("escalateComplex", v)}
                  ariaLabel="Derivar a humano si la consulta es compleja"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--cv-color-border)] bg-white px-3.5 py-2.5">
                <span className="text-[12.5px] font-semibold text-[var(--cv-color-text-primary)]">
                  Prioridad al tono del negocio
                </span>
                <IOSSwitch
                  checked={draft.prioritizeTone ?? false}
                  onChange={(v) => update("prioritizeTone", v)}
                  ariaLabel="Prioridad al tono del negocio"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-7 flex flex-col gap-3 border-t border-[var(--cv-color-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[var(--cv-color-primary)] px-5 text-[14px] font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[var(--cv-color-primary-hover)]"
            >
              <Save className="h-4 w-4" />
              Guardar cambios
            </motion.button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[var(--cv-color-border)] bg-white px-5 text-[14px] font-semibold text-[var(--cv-color-text-primary)] transition hover:bg-[var(--cv-color-bg)]"
            >
              Cancelar
            </button>
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#DC2626] transition hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer agente
            </button>
          ) : (
            <div className="inline-flex flex-wrap items-center gap-2 rounded-[10px] border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2">
              <span className="text-[12.5px] font-semibold text-[#DC2626]">
                ¿Seguro? Vas a borrar la configuración actual.
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-[8px] bg-[#DC2626] px-3 py-1 text-[12px] font-bold text-white"
              >
                Sí, restablecer
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-[12px] font-semibold text-[var(--cv-color-text-secondary)] hover:text-[var(--cv-color-text-primary)]"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Joins a list of strings with comma + "y" for the last one. */
function humanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/* ============================================================
   ADVANCED VIEW — legacy accordions (catalog + rules) preserved
   ============================================================ */
// AdvancedView removed. The legacy ProfilePanel / CatalogPanel /
// RulesPanel / Accordion components remain defined below as dead
// code — the tree-shaker drops them from the bundle since nothing
// imports or renders them anymore.

function Accordion({
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: LucideIcon;
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
          <div className="icon-tile">
            <Icon className="h-4 w-4" />
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

  const modes: { v: AgentProfile["operatingMode"]; label: string; desc: string; soon?: boolean }[] =
    [
      { v: "approve", label: "Aprobar", desc: "Responde con tu aprobación (recomendado)" },
      { v: "auto", label: "Automático", desc: "Próximamente", soon: true },
    ];

  const initial = (draft.agentName || "A").trim().charAt(0).toUpperCase();
  const modeLabel = modes.find((m) => m.v === draft.operatingMode)?.label ?? "Aprobar";

  return (
    <div className="space-y-6">
      {/* Premium identity card — compact, editorial, single line of identity
          + minimal inline stats.  Replaces the previous tall, layered hero. */}
      <div className="surface-card relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-primary opacity-10 blur-3xl" />

        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-2xl font-bold text-primary-foreground ring-2 ring-background">
              {initial}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-success">
              <Check className="h-2.5 w-2.5 text-success-foreground" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-xl font-bold leading-tight sm:text-2xl">
              {draft.agentName || "Tu agente"}
            </h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              Agente de {(draft.mainGoal || "atención").toLowerCase()}
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              <span className="font-medium text-foreground/90">
                {draft.businessName || "tu negocio"}
              </span>
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <ProfileMeta label="Objetivo" value={draft.mainGoal || "—"} />
          <ProfileMeta label="Tono" value={draft.tone || "—"} />
          <ProfileMeta label="Modo" value={modeLabel} />
        </div>
      </div>

      {/* Edit form — clean 2-column grid, no redundant description / summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Nombre del agente">
          <Input
            value={draft.agentName}
            onChange={(e) => update("agentName", e.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>
        <Field label="Nombre del negocio">
          <Input
            value={draft.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            className="h-10 rounded-xl"
          />
        </Field>
        <Field label="Rubro">
          <Select value={draft.businessType} onValueChange={(v) => update("businessType", v)}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Elegí un rubro" />
            </SelectTrigger>
            <SelectContent>
              {businessTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Objetivo principal">
          <Select value={draft.mainGoal} onValueChange={(v) => update("mainGoal", v)}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Elegí un objetivo" />
            </SelectTrigger>
            <SelectContent>
              {goals.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tono de respuesta">
          <Select value={draft.tone} onValueChange={(v) => update("tone", v)}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Elegí un tono" />
            </SelectTrigger>
            <SelectContent>
              {tones.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Modo de trabajo">
          <div className="grid gap-2 sm:grid-cols-2">
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
                        description:
                          "El modo automático estará disponible cuando conectes tus canales.",
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
      </div>

      {/* Save action — right aligned, sole primary CTA */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => {
            onSave(draft);
            toast.success("Cambios guardados");
          }}
          className="h-11 rounded-xl px-5"
        >
          <Save className="h-4 w-4" /> Guardar cambios
        </Button>
      </div>
    </div>
  );
}

/** Inline meta stat — used by the ProfilePanel hero.  No borders, no card —
 *  just typographic hierarchy (label uppercase muted · value bold). */
function ProfileMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
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

function RulesPanel({ agent, onSave }: { agent: AgentProfile; onSave: (a: AgentProfile) => void }) {
  const [draft, setDraft] = useState<AgentProfile>(agent);
  useEffect(() => setDraft(agent), [agent]);

  return (
    <div className="space-y-8">
      {/* Grupo 1 — Qué hace tu agente */}
      <section className="space-y-5">
        <div className="border-l-2 border-primary/40 pl-3">
          <p className="font-display text-sm font-semibold">Qué hace tu agente</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Los temas que puede responder, lo que no debe inventar y cuándo derivar a una persona.
          </p>
        </div>
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
      </section>

      {/* Grupo 2 — Cómo detecta intención */}
      <section className="space-y-5">
        <div className="border-l-2 border-primary/40 pl-3">
          <p className="font-display text-sm font-semibold">Cómo detecta intención</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Señales para marcar un cliente como caliente o para programar un seguimiento.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
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
      </section>

      <Button
        onClick={() => {
          onSave(draft);
          toast.success("Reglas guardadas");
        }}
        className="h-11 rounded-xl px-5"
      >
        <Save className="h-4 w-4" /> Guardar reglas
      </Button>
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
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Agregar otro…"
          className="h-9 flex-1 rounded-lg text-xs"
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
    let alive = true;
    (async () => {
      try {
        const loaded = await loadProducts();
        if (alive) setProducts(loaded);
      } catch {
        toast.error("No pudimos cargar tus productos.");
        if (alive) setProducts([]);
      }
    })();
    setContextEnabled(localStorage.getItem(STORAGE_CATALOG_CONTEXT) !== "0");
    return () => {
      alive = false;
    };
  }, []);

  const persist = async (p: Product[]): Promise<boolean> => {
    setProducts(p);
    try {
      const saved = await saveProducts(p);
      setProducts(saved);
      return true;
    } catch {
      toast.error("No pudimos guardar el catálogo.");
      return false;
    }
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
        <ManualCatalog products={products} setProducts={persist} onBack={() => setTab("home")} />
      )}
      {tab === "csv" && (
        <CsvCatalog
          onBack={() => setTab("home")}
          onImport={async (rows) => {
            if (await persist([...products, ...rows])) {
              toast.success(`${rows.length} productos importados`);
              setTab("manual");
            }
          }}
        />
      )}
      {tab === "ai" && (
        <AiCatalog
          onBack={() => setTab("home")}
          onImport={async (rows) => {
            if (await persist([...products, ...rows])) {
              toast.success(`${rows.length} productos importados`);
              setTab("manual");
            }
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
              onCheckedChange={(v) => {
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
  icon: LucideIcon;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
    >
      <div className="icon-tile">
        <Icon className="h-4 w-4" />
      </div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
        Abrir <ArrowRight className="h-3 w-3" />
      </span>
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
  setProducts: (p: Product[]) => void | Promise<boolean>;
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
        <Button
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: "",
              active: true,
              currency: "ARS",
            })
          }
          className="h-10 rounded-xl"
        >
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      </div>

      {editing && (
        <ProductForm
          product={editing}
          onCancel={() => setEditing(null)}
          onSave={async (p) => {
            const exists = products.find((x) => x.id === p.id);
            const next = exists ? products.map((x) => (x.id === p.id ? p : x)) : [...products, p];
            const ok = await setProducts(next);
            if (ok === false) return;
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
  onSave: (p: Product) => void | Promise<void>;
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
            <Input
              value={p.name}
              onChange={(e) => u("name", e.target.value)}
              placeholder="Ej: Lámpara Nórdica"
              className="h-10 rounded-xl"
            />
          </Field>
        </div>
        <Field label="Precio">
          <Input
            type="number"
            inputMode="decimal"
            value={p.price ?? ""}
            onChange={(e) => u("price", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="h-10 rounded-xl"
          />
        </Field>
        <Field label="Categoría (opcional)">
          <Input
            value={p.category ?? ""}
            onChange={(e) => u("category", e.target.value)}
            placeholder="Ej: Iluminación"
            className="h-10 rounded-xl"
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
              <Textarea
                value={p.description ?? ""}
                onChange={(e) => u("description", e.target.value)}
                rows={2}
                placeholder="Contale a la IA qué es este producto."
                className="rounded-xl"
              />
            </Field>
          </div>
          <Field label="Moneda">
            <Select value={p.currency ?? "ARS"} onValueChange={(v) => u("currency", v)}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Stock">
            <Input
              type="number"
              value={p.stock ?? ""}
              onChange={(e) => u("stock", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="0"
              className="h-10 rounded-xl"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Foto del producto (URL)">
              <Input
                value={p.imageUrl ?? ""}
                onChange={(e) => u("imageUrl", e.target.value)}
                placeholder="https://…"
                className="h-10 rounded-xl"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notas para la IA">
              <Textarea
                value={p.aiNotes ?? ""}
                onChange={(e) => u("aiNotes", e.target.value)}
                rows={2}
                placeholder="Ej: Recomendarlo para regalos, consultar stock antes de confirmar…"
                className="rounded-xl"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Usá este campo para aclarar cuándo recomendar el producto o qué no debe prometer
                CLERIVO.
              </p>
            </Field>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={p.active} onCheckedChange={(v) => u("active", v)} />
            <span className="text-sm">{p.active ? "Producto activo" : "Producto inactivo"}</span>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="outline" onClick={onCancel} className="h-10 rounded-xl">
          Cancelar
        </Button>
        <Button
          onClick={() => {
            if (!p.name) return;
            void Promise.resolve(onSave(p)).catch(() => {
              toast.error("No pudimos guardar el producto.");
            });
          }}
          disabled={!p.name}
          className="h-10 flex-1 rounded-xl sm:flex-none"
        >
          <Save className="h-4 w-4" /> Guardar producto
        </Button>
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
  setProducts: (p: Product[]) => void | Promise<boolean>;
  onEdit?: (p: Product) => void;
}) {
  const [filter, setFilter] = useState<CatalogFilter>("all");
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
        {(
          [
            { v: "all", l: "Todos" },
            { v: "active", l: "Activos" },
            { v: "inactive", l: "Inactivos" },
            { v: "no-price", l: "Sin precio" },
            { v: "no-stock", l: "Sin stock" },
          ] satisfies Array<{ v: CatalogFilter; l: string }>
        ).map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f.v
                ? "border-primary bg-accent text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.l}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-primary/40">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="h-9 w-40 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay productos para mostrar.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="surface-card group relative flex flex-col overflow-hidden p-0 transition hover:shadow-md"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-muted to-accent/30">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                )}
                <span
                  className={`absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${
                    p.active
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : "bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      p.active ? "bg-emerald-500" : "bg-muted-foreground/60"
                    }`}
                  />
                  {p.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                    {p.category?.trim() || "Sin categoría"}
                  </p>
                </div>
                <p className="font-display text-base font-semibold text-foreground">
                  {p.price != null ? `${p.currency ?? "ARS"} ${p.price}` : "Sin precio"}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(p)}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  )}
                  <button
                    onClick={() => void setProducts(products.filter((x) => x.id !== p.id))}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    aria-label="Eliminar producto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
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
  onImport: (rows: Product[]) => void | Promise<void>;
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
          <Button
            onClick={() =>
              void Promise.resolve(onImport(preview)).catch(() => {
                toast.error("No pudimos importar los productos.");
              })
            }
            className="h-10 rounded-xl"
          >
            <Check className="h-4 w-4" /> Confirmar importación
          </Button>
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
  onImport: (rows: Product[]) => void | Promise<void>;
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
            Lámpara Nórdica $35.000
            <br />
            Lámpara Rattan $42.000
            <br />
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
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Sparkles className="h-3 w-3" />
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
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-primary">
                <Sparkles className="h-3 w-3" />
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
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pegá tu lista de productos…"
            className="h-10 flex-1 rounded-xl"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl"
            aria-label="Adjuntar imagen"
            title="Adjuntar imagen"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button type="submit" size="icon" className="h-10 w-10 rounded-xl" aria-label="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {draft.length > 0 && (
        <DraftTable
          draft={draft}
          setDraft={setDraft}
          onImport={() =>
            void Promise.resolve(onImport(draft)).catch(() => {
              toast.error("No pudimos importar los productos.");
            })
          }
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
      const price = priceMatch
        ? Number(priceMatch[1].replace(/\./g, "").replace(",", "."))
        : undefined;
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
  const update = (id: string, k: keyof Product, v: Product[keyof Product]) =>
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
                  <Input
                    value={p.name}
                    onChange={(e) => update(p.id, "name", e.target.value)}
                    className="h-8 w-full rounded-md text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={p.category ?? ""}
                    onChange={(e) => update(p.id, "category", e.target.value)}
                    className="h-8 w-full rounded-md text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    type="number"
                    value={p.price ?? ""}
                    onChange={(e) =>
                      update(p.id, "price", e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="h-8 w-24 rounded-md text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    type="number"
                    value={p.stock ?? ""}
                    onChange={(e) =>
                      update(p.id, "stock", e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="h-8 w-20 rounded-md text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={p.aiNotes ?? ""}
                    onChange={(e) => update(p.id, "aiNotes", e.target.value)}
                    className="h-8 w-full rounded-md text-xs"
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
        <Button onClick={onImport} className="h-10 rounded-xl">
          <Check className="h-4 w-4" /> Importar al catálogo
        </Button>
        <Button onClick={downloadCsv} variant="outline" className="h-10 rounded-xl">
          <Download className="h-4 w-4" /> Descargar CSV
        </Button>
      </div>
    </div>
  );
}

/** Skeleton shown while AgenteIAPage loads remote data.
 *  Approximates either the empty state or the dashboard layout — whichever
 *  the user lands on, the visual rhythm is preserved during the brief flash. */
function AgentPageSkeleton() {
  return (
    <div className="product-shell min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 sm:h-9" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>

        {/* 3 accordion cards */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="surface-card flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
