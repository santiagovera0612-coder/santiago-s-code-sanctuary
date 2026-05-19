import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Bot,
  Package,
  Shield,
  Plug,
  Check,
  Circle,
  MessageSquare,
} from "lucide-react";
import {
  getStoredAgent,
  getStoredProducts,
  type StoredAgent,
  type StoredProduct,
} from "@/lib/clerivo-agent";
import { ClerivoBubble } from "@/components/clerivo-bubble";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Centro de puesta en marcha — Clerivo AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAgent(getStoredAgent());
    setProducts(getStoredProducts());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const activeProducts = products.filter((p) => p.active);
  const hasAgent = !!agent;
  const hasProducts = activeProducts.length > 0;
  const hasRules =
    !!agent &&
    ((agent.allowedTopics?.length ?? 0) > 0 ||
      (agent.forbiddenClaims?.length ?? 0) > 0 ||
      (agent.escalationRules?.length ?? 0) > 0);
  const hasTested = hasAgent && hasProducts && hasRules; // visual heuristic only
  const hasIntegrations = false;

  const steps = [
    { key: "agent", title: "Crear Agente IA", to: "/app/create", done: hasAgent },
    { key: "catalog", title: "Cargar productos", to: "/app/create", done: hasProducts },
    { key: "rules", title: "Revisar reglas", to: "/app/create", done: hasRules },
    { key: "simulator", title: "Probar en Simulador", to: "/app/simulator", done: hasTested },
    { key: "integrations", title: "Preparar Integraciones", to: "/app/integrations", done: hasIntegrations },
  ];

  const nextStep =
    steps.find((s) => !s.done) ?? steps[steps.length - 1];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Clerivo
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Centro de puesta en marcha
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Configurá tu agente, cargá productos y probá respuestas antes de
          conectar tus canales.
        </p>
      </div>

      {/* Card principal: Estado del Agente IA */}
      <AgentStateCard agent={agent} />

      {/* Checklist + Próxima acción */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-5 sm:p-6 animate-fade-up lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Checklist
              </p>
              <h2 className="font-display text-lg font-semibold">Primeros pasos</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {completed} / {steps.length}
            </span>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-3 py-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    s.done
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-accent text-muted-foreground"
                  }`}
                >
                  {s.done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </span>
                <span
                  className={`flex-1 text-sm ${
                    s.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {s.title}
                </span>
                {!s.done && (
                  <Link
                    to={s.to}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Ir
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        <NextActionCard
          title={nextStep.title}
          to={nextStep.to}
          allDone={completed === steps.length}
        />
      </div>

      {/* Cards simples */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        <SimpleCard
          icon={Bot}
          title="Agente IA"
          status={hasAgent ? "Configurado" : "Sin configurar"}
          ok={hasAgent}
          desc="Definí perfil, tono y objetivo."
          cta={hasAgent ? "Editar" : "Crear"}
          to="/app/create"
        />
        <SimpleCard
          icon={Package}
          title="Catálogo inteligente"
          status={hasProducts ? "Productos cargados" : "Vacío"}
          ok={hasProducts}
          desc="Cargá lo que querés vender."
          cta={hasProducts ? "Ver catálogo" : "Cargar"}
          to="/app/create"
        />
        <SimpleCard
          icon={Shield}
          title="Reglas"
          status={hasRules ? "Revisadas" : "Pendientes"}
          ok={hasRules}
          desc="Qué puede y qué no puede decir."
          cta={hasRules ? "Revisar" : "Configurar"}
          to="/app/create"
        />
        <SimpleCard
          icon={Plug}
          title="Integraciones"
          status="Pendientes"
          ok={false}
          desc="WhatsApp e Instagram próximamente."
          cta="Preparar"
          to="/app/integrations"
        />
      </div>

      <ClerivoBubble
        id="dashboard"
        message={
          hasAgent
            ? "Seguí con el próximo paso del checklist y dejá tu agente listo para salir al aire."
            : "Te recomiendo empezar creando tu Agente IA. Después vas a poder cargar productos y probar respuestas."
        }
        ctaLabel={hasAgent ? "Ver próximo paso" : "Crear Agente IA"}
        ctaTo={hasAgent ? nextStep.to : "/app/create"}
      />
    </div>
  );
}

function AgentStateCard({ agent }: { agent: StoredAgent | null }) {
  if (!agent) {
    return (
      <div className="surface-card relative overflow-hidden p-6 sm:p-8 animate-fade-up">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Estado del Agente IA
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold sm:text-2xl">
                Todavía no configuraste tu Agente IA
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Es el primer paso. Te tomamos los datos básicos del negocio y lo
                dejamos listo para probar.
              </p>
            </div>
          </div>
          <Link
            to="/app/create"
            className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-lg bg-gradient-primary px-5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 sm:self-auto"
          >
            Crear Agente IA <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const initial = (agent.agentName || "A").trim().charAt(0).toUpperCase();
  const details: Array<{ label: string; value?: string }> = [
    { label: "Nombre", value: agent.agentName },
    { label: "Negocio", value: agent.businessName },
    { label: "Objetivo", value: agent.mainGoal },
    { label: "Tono", value: agent.tone },
  ];

  return (
    <div className="surface-card relative overflow-hidden p-5 sm:p-6 animate-fade-up">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-xl font-bold text-primary-foreground shadow-glow">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Estado del Agente IA
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold">
                  Agente configurado
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Listo
                </span>
              </div>
            </div>
          </div>
          <Link
            to="/app/create"
            className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-accent sm:self-auto"
          >
            Editar Agente IA
          </Link>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {details.map((d) => (
            <div
              key={d.label}
              className="rounded-lg border border-border bg-card/50 p-3"
            >
              <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {d.label}
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-foreground">
                {d.value?.trim() || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function NextActionCard({
  title,
  to,
  allDone,
}: {
  title: string;
  to: string;
  allDone: boolean;
}) {
  return (
    <div className="surface-card relative flex flex-col overflow-hidden p-5 sm:p-6 animate-fade-up">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
      <div className="relative flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Próxima acción recomendada
        </p>
      </div>
      <p className="relative mt-3 font-display text-lg font-semibold leading-snug">
        {allDone ? "Todo listo para probar" : title}
      </p>
      <p className="relative mt-1 text-xs text-muted-foreground">
        {allDone
          ? "Repasá la conversación en el simulador antes de conectar canales."
          : "Hacé este paso ahora para avanzar con la puesta en marcha."}
      </p>
      <Link
        to={to}
        className="relative mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
      >
        {allDone ? (
          <>
            <MessageSquare className="h-4 w-4" /> Abrir Simulador
          </>
        ) : (
          <>
            Empezar <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Link>
    </div>
  );
}

function SimpleCard({
  icon: Icon,
  title,
  status,
  ok,
  desc,
  cta,
  to,
}: {
  icon: any;
  title: string;
  status: string;
  ok: boolean;
  desc: string;
  cta: string;
  to: string;
}) {
  return (
    <div className="surface-card flex h-full flex-col p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <span
        className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          ok
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            ok ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        {status}
      </span>
      <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
      <Link
        to={to}
        className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-primary hover:underline"
      >
        {cta} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
