import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Bot,
  Package,
  MessageSquare,
  Plug,
  Check,
  Shield,
} from "lucide-react";
import { getStoredAgent, getStoredProducts, type StoredAgent, type StoredProduct } from "@/lib/clerivo-agent";
import { ClerivoBubble } from "@/components/clerivo-bubble";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Clerivo AI" }] }),
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

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="text-sm text-muted-foreground">Hola de nuevo 👋</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-normal">
            Tu panel de Clerivo
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {agent
              ? `Acá vas a ver cómo está configurado tu Agente IA y los próximos pasos.`
              : `Vista previa del panel. Configurá tu Agente IA para empezar.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              agent
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border bg-surface text-muted-foreground"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${agent ? "bg-emerald-500" : "bg-amber-500"}`} />
            {agent ? "Agente configurado" : "Agente sin configurar"}
          </span>
          <Link
            to={agent ? "/app/simulator" : "/app/create"}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
          >
            {agent ? "Probar agente" : "Crear Agente IA"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {!agent ? (
        <EmptyDashboard />
      ) : (
        <ConfiguredDashboard agent={agent} products={products} />
      )}
      <ClerivoBubble
        id="dashboard"
        message="Te recomiendo empezar creando tu Agente IA. Después vas a poder cargar productos y probar respuestas."
        ctaLabel="Crear Agente IA"
        ctaTo="/app/create"
      />
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="surface-card relative overflow-hidden p-6 sm:p-10 animate-fade-up">
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          <Bot className="h-6 w-6" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
          Centro de puesta en marcha
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
          Empezá configurando tu Agente IA
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          CLERIVO te va a guiar paso a paso para crear un asistente adaptado a tu negocio.
        </p>
        <Link
          to="/app/create"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-primary px-6 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
        >
          Crear mi Agente IA <ArrowRight className="h-4 w-4" />
        </Link>

        <ol className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
          <RoadmapStep n={1} icon={Bot} title="Creá tu Agente IA" desc="Definí perfil, tono y reglas." active />
          <RoadmapStep n={2} icon={Package} title="Cargá tus productos" desc="Para que pueda recomendar y vender." />
          <RoadmapStep n={3} icon={MessageSquare} title="Probalo en el Simulador" desc="Verificá cómo responde antes de salir al aire." />
          <RoadmapStep n={4} icon={Plug} title="Preparar Integraciones" desc="WhatsApp e Instagram próximamente." />
        </ol>
      </div>
    </div>
  );
}

function RoadmapStep({
  n,
  icon: Icon,
  title,
  desc,
  active,
}: {
  n: number;
  icon: any;
  title: string;
  desc: string;
  active?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        active ? "border-primary/40 bg-primary/5" : "border-border bg-card/50"
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
          active
            ? "bg-gradient-primary text-primary-foreground shadow-glow"
            : "bg-accent text-muted-foreground"
        }`}
      >
        {n}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}

function ConfiguredDashboard({
  agent,
  products,
}: {
  agent: StoredAgent;
  products: StoredProduct[];
}) {
  const activeProducts = products.filter((p) => p.active);
  const hasRules =
    (agent.allowedTopics?.length ?? 0) > 0 ||
    (agent.forbiddenClaims?.length ?? 0) > 0 ||
    (agent.escalationRules?.length ?? 0) > 0;

  const nextStep = !activeProducts.length
    ? { title: "Cargá productos al catálogo", to: "/app/create", cta: "Ir al Catálogo" }
    : !hasRules
    ? { title: "Ajustá las reglas de respuesta", to: "/app/create", cta: "Ir a Reglas" }
    : { title: "Probá tu agente en el Simulador", to: "/app/simulator", cta: "Abrir Simulador" };

  return (
    <>
      {/* Resumen del agente */}
      <div className="surface-card relative overflow-hidden p-5 sm:p-6 animate-fade-up">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-xl font-bold text-primary-foreground shadow-glow">
            {(agent.agentName || "A").trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Agente IA</p>
            <h2 className="font-display text-xl font-semibold">
              {agent.agentName || "Tu agente"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {agent.agentName || "Tu agente"} está configurada para responder consultas de{" "}
              <span className="font-medium text-foreground">
                {agent.businessName || "tu negocio"}
              </span>
              .
            </p>
          </div>
          <Link
            to="/app/create"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-accent"
          >
            Editar agente
          </Link>
        </div>
      </div>

      {/* Estado actual */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
        <StatusTile
          icon={Package}
          title="Catálogo"
          status={
            activeProducts.length
              ? `${activeProducts.length} producto${activeProducts.length === 1 ? "" : "s"} cargado${activeProducts.length === 1 ? "" : "s"}.`
              : "Sin productos cargados todavía."
          }
          ok={activeProducts.length > 0}
          to="/app/create"
          cta={activeProducts.length ? "Ver catálogo" : "Cargar productos"}
        />
        <StatusTile
          icon={Shield}
          title="Reglas"
          status={hasRules ? "Reglas principales configuradas." : "Reglas pendientes de configurar."}
          ok={hasRules}
          to="/app/create"
          cta={hasRules ? "Revisar reglas" : "Configurar reglas"}
        />
        <StatusTile
          icon={Plug}
          title="Canales"
          status="Pendientes de conexión."
          ok={false}
          to="/app/integrations"
          cta="Ver Integraciones"
        />
      </div>

      {/* Próximo paso */}
      <div className="surface-card relative overflow-hidden p-5 sm:p-6 animate-fade-up">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Próximo paso recomendado
            </p>
            <p className="mt-0.5 font-display text-base font-semibold">{nextStep.title}</p>
          </div>
          <Link
            to={nextStep.to}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            {nextStep.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </>
  );
}

function StatusTile({
  icon: Icon,
  title,
  status,
  ok,
  cta,
  to,
}: {
  icon: any;
  title: string;
  status: string;
  ok: boolean;
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
        {ok && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Listo
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{status}</p>
      <Link
        to={to}
        className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-primary hover:underline"
      >
        {cta} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
