import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowRight,
  Bot,
  ShoppingBag,
  ShieldCheck,
  MessageSquare,
  Plug,
  Flame,
  Clock,
  Target,
  Inbox,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getStoredAgent,
  getStoredProducts,
  type StoredAgent,
  type StoredProduct,
} from "@/lib/clerivo-agent";
import { getActivityFeed, formatRelative, type ActivityItem } from "@/lib/clerivo-activity";
import {
  fetchChatConversations,
  type ChatChannel,
  type ChatConversation,
  type LeadStatus,
} from "@/lib/clerivo-chats";
import { ClerivoBubble } from "@/components/clerivo-bubble";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Clerivo AI" }] }),
  component: Dashboard,
});

type DashboardData = {
  agent: StoredAgent | null;
  products: StoredProduct[];
  activity: ActivityItem[];
  conversations: ChatConversation[];
};

type Recommendation = {
  key: string;
  /** Heading shown in the side card. */
  title: string;
  /** One-paragraph hint shown below the divider. */
  desc: string;
  /** Bottom CTA label. */
  ctaLabel: string;
  to: string;
};

/** Computes the *real* next action based on the user's onboarding state.
 *  This is what powers the "Próxima acción recomendada" side card AND
 *  the Clerivo bubble — we never suggest "Ver chats" if there are no
 *  real chats to look at. */
function getRecommendation(agent: StoredAgent | null): Recommendation {
  const hasAgent = !!agent;
  const hasRules =
    !!agent &&
    ((agent.allowedTopics?.length ?? 0) > 0 ||
      (agent.forbiddenClaims?.length ?? 0) > 0 ||
      (agent.escalationRules?.length ?? 0) > 0);

  if (!hasAgent) {
    return {
      key: "create-agent",
      title: "Creá tu Agente IA",
      desc: "Definí el asistente principal de tu negocio para que CLERIVO pueda responder con tu tono y objetivos.",
      ctaLabel: "Ir a Agente IA",
      to: "/app/create",
    };
  }
  if (!hasRules) {
    return {
      key: "rules",
      title: "Definí las reglas del agente",
      desc: "Indicá qué temas puede tratar, qué afirmaciones evitar y cuándo escalar a una persona.",
      ctaLabel: "Definir reglas",
      to: "/app/create",
    };
  }
  // Agent + rules are in place: send the user to the simulator to
  // validate behaviour before connecting any channel.
  return {
    key: "simulator",
    title: "Probá el simulador",
    desc: "Verificá cómo responde tu agente antes de conectar canales. Hablale como si fueras un cliente.",
    ctaLabel: "Abrir Simulador",
    to: "/app/simulator",
  };
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const [agent, products, activity, conversations] = await Promise.all([
          getStoredAgent(),
          getStoredProducts(),
          getActivityFeed(),
          fetchChatConversations(),
        ]);
        if (alive) setData({ agent, products, activity, conversations });
      } catch {
        toast.error("No pudimos cargar el dashboard.");
        if (alive) setData({ agent: null, products: [], activity: [], conversations: [] });
      }
    };
    void refresh();
    window.addEventListener("clerivo:activity", refresh as EventListener);
    return () => {
      alive = false;
      window.removeEventListener("clerivo:activity", refresh as EventListener);
    };
  }, []);

  if (!data) return <DashboardSkeleton />;

  const { agent, products, activity, conversations } = data;
  const hasAgent = !!agent;
  const rec = getRecommendation(agent);

  return (
    <div
      className="mx-auto w-full max-w-[1200px] space-y-6 p-4 sm:space-y-7 sm:p-6 lg:p-8"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {hasAgent ? (
        <StateB
          agent={agent!}
          products={products}
          activity={activity}
          conversations={conversations}
          recommendation={rec}
        />
      ) : (
        <StateA recommendation={rec} />
      )}

      <ClerivoBubble
        id={`dashboard-v3-${rec.key}`}
        message={rec.desc}
        ctaLabel={rec.ctaLabel}
        ctaTo={rec.to}
      />
    </div>
  );
}

/* ============================================================
   STATE A — onboarding (no agent yet)
   Matches reference images 1 (desktop) and 3 (mobile)
   ============================================================ */

function StateA({ recommendation }: { recommendation: Recommendation }) {
  // Step icons mirror the sidebar (app.tsx) so a user immediately
  // recognises where each step will take them:
  //   Agente IA   → Bot
  //   Simulador   → MessageSquare
  //   Integraciones → Plug
  // "Definir reglas" doesn't have a direct sidebar entry (it lives inside
  // the Agente IA wizard), so it uses the semantic Shield icon.
  const steps = [
    {
      n: 1,
      icon: Bot,
      title: "Crear Agente IA",
      desc: "Definí el asistente principal de tu negocio.",
      to: "/app/create",
    },
    {
      n: 2,
      icon: ShieldCheck,
      title: "Definir reglas",
      desc: "Indicá cómo debe responder la IA.",
      to: "/app/create",
    },
    {
      n: 3,
      icon: MessageSquare,
      title: "Probar Simulador",
      desc: "Verificá respuestas antes de publicar.",
      to: "/app/simulator",
    },
    {
      n: 4,
      icon: Plug,
      title: "Preparar Integraciones",
      desc: "Conectá tus canales en los próximos pasos.",
      to: "/app/integrations",
    },
  ];

  return (
    <>
      {/* Page header */}
      <div className="animate-fade-up">
        <h1
          className="text-3xl font-extrabold tracking-tight text-foreground sm:text-[34px]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Dashboard
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-[15px]">
          Empezá a preparar tu negocio en CLERIVO paso a paso.
        </p>
      </div>

      {/* Welcome card */}
      <div className="cv-card animate-fade-up p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-color-primary-light)] sm:h-24 sm:w-24 dark:bg-[color:color-mix(in_oklab,var(--primary)_18%,transparent)]"
            aria-hidden
          >
            <Sparkles
              className="h-9 w-9 text-[var(--cv-color-primary)] sm:h-10 sm:w-10 dark:text-[color:var(--primary-glow)]"
              strokeWidth={2.2}
            />
          </div>
          <div className="flex-1">
            <h2
              className="text-2xl font-extrabold tracking-tight text-foreground sm:text-[28px]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Bienvenido a CLERIVO
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Configurá tu agente, cargá tus productos y prepará tus canales desde una experiencia
              simple y guiada.
            </p>
            <Link to="/app/create" className="cv-btn-primary mt-5 inline-flex w-full sm:w-auto">
              <Sparkles className="h-4 w-4" />
              Crear Agente IA
            </Link>
          </div>
        </div>
      </div>

      {/* Checklist + Next action */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Primeros pasos */}
        <div className="cv-card animate-fade-up p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3
              className="text-base font-bold text-foreground sm:text-lg"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Primeros pasos
            </h3>
            <span className="text-xs font-medium text-muted-foreground">
              0 de 5 pasos completados
            </span>
          </div>
          <div className="cv-divider mt-4" />
          <ul className="mt-1 divide-y divide-border">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.n}>
                  <Link
                    to={s.to}
                    className="group flex items-center gap-4 py-3.5 transition hover:bg-[var(--cv-color-primary-light)]/40 sm:gap-5 dark:hover:bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)]"
                  >
                    <span className="cv-step-number">{s.n}</span>
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cv-color-primary-light)] text-[var(--cv-color-primary)] dark:bg-[color:color-mix(in_oklab,var(--primary)_18%,transparent)] dark:text-[color:var(--primary-glow)]"
                      aria-hidden
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-bold text-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground sm:text-[13px]">
                        {s.desc}
                      </p>
                    </div>
                    <span className="cv-badge cv-badge-pending shrink-0">Pendiente</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Próxima acción */}
        <NextActionCard
          icon={Target}
          title="Próxima acción recomendada"
          desc={recommendation.desc}
          ctaLabel={recommendation.ctaLabel}
          to={recommendation.to}
        />
      </div>
    </>
  );
}

/* ============================================================
   STATE B — operating (agent configured)
   Matches reference images 2 (desktop) and 4 (mobile)
   ============================================================ */

function StateB({
  agent,
  products,
  activity,
  conversations,
  recommendation,
}: {
  agent: StoredAgent;
  products: StoredProduct[];
  activity: ActivityItem[];
  conversations: ChatConversation[];
  recommendation: Recommendation;
}) {
  const totalConversations = conversations.length;
  const hotClients = conversations.filter(
    (conversation) => conversation.lead === "caliente",
  ).length;
  const followUps = conversations.filter(
    (conversation) => conversation.lead === "seguimiento",
  ).length;
  const weeklySeries = buildConversationSeries(conversations);
  const channelSeries = buildChannelSeries(conversations);
  const opportunities = buildOpportunities(conversations);

  // Show a short preview of the activity feed (3 entries) here; the bell
  // dropdown shows the full 5.
  const recent = activity.slice(0, 4);

  return (
    <>
      {/* Page header */}
      <div className="animate-fade-up">
        <h1
          className="text-3xl font-extrabold tracking-tight text-foreground sm:text-[34px]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Resumen del negocio
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-[15px]">
          Revisá el estado de tus conversaciones, clientes y actividad reciente en CLERIVO.
        </p>
      </div>

      {/* KPI cards — 4 cards distributed 2×2 on mobile and 4-in-a-row on lg */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Inbox}
          tone="primary"
          label="Conversaciones"
          value={totalConversations}
          sub="Chats registrados"
        />
        <KpiCard
          icon={Flame}
          tone="green"
          label="Clientes calientes"
          value={hotClients}
          sub="Mayor intención de compra"
        />
        <KpiCard
          icon={Clock}
          tone="orange"
          label="Seguimientos"
          value={followUps}
          sub="Pendientes"
        />
        <AgentKpiCard agent={agent} />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_320px]">
        <ConversationsChart data={weeklySeries} />
        <ChannelsChart data={channelSeries} />
        <NextActionCard
          icon={Target}
          title="Próxima acción recomendada"
          desc={recommendation.desc}
          ctaLabel={recommendation.ctaLabel}
          to={recommendation.to}
          variant="ghost-list"
        />
      </div>

      {/* Activity + Opportunities */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <RecentActivityCard items={recent} />
        <OpportunitiesCard conversations={opportunities} />
      </div>
    </>
  );
}

/* ============================================================
   Pieces
   ============================================================ */

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: typeof MessageSquare;
  tone: "primary" | "green" | "orange" | "red" | "blue";
  label: string;
  value: number | string;
  sub: string;
}) {
  const toneClass =
    tone === "primary"
      ? "cv-tile"
      : tone === "green"
        ? "cv-tile cv-tile-green"
        : tone === "orange"
          ? "cv-tile cv-tile-orange"
          : tone === "red"
            ? "cv-tile cv-tile-red"
            : "cv-tile cv-tile-blue";

  return (
    <div className="cv-card cv-card-hover animate-fade-up p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <span className={toneClass} aria-hidden>
          <Icon className="h-[20px] w-[20px]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-muted-foreground">{label}</p>
          <p
            className="mt-1.5 leading-none text-[30px] font-extrabold tracking-tight text-foreground sm:text-[32px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {value}
          </p>
          <p className="mt-2 text-[11.5px] leading-tight text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function AgentKpiCard({ agent }: { agent: StoredAgent }) {
  const name = agent.agentName?.trim() || "Asistente IA";
  const role = agent.businessType?.trim() || "Asistente principal";
  return (
    <div className="cv-card cv-card-hover animate-fade-up p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <span className="cv-tile cv-tile-green" aria-hidden>
          <Bot className="h-[20px] w-[20px]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-muted-foreground">Agente IA</p>
          <p
            className="mt-1.5 inline-flex items-center gap-2 leading-none text-[26px] font-extrabold tracking-tight text-[var(--cv-color-accent-green)] sm:text-[28px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span aria-hidden className="cv-pulse-dot" />
            Activo
          </p>
          <p className="mt-2 truncate text-[11.5px] leading-tight text-muted-foreground">
            {name} · {role}
          </p>
        </div>
      </div>
    </div>
  );
}

type ConversationChartPoint = {
  day: string;
  value: number;
};

type ChannelChartPoint = {
  key: ChatChannel;
  name: string;
  value: number;
  percent: number;
  color: string;
};

const CHANNEL_META: Record<ChatChannel, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "var(--cv-color-primary)" },
  instagram: { label: "Instagram", color: "var(--cv-color-accent-blue)" },
};

const LEAD_LABELS: Record<LeadStatus, string> = {
  nuevo: "Nuevo",
  interesado: "Interesado",
  caliente: "Caliente",
  seguimiento: "Seguimiento",
  cliente: "Cliente",
  perdido: "Perdido",
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function conversationDate(conversation: ChatConversation): Date | null {
  const raw = conversation.lastMessageAt ?? conversation.createdAt;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildConversationSeries(conversations: ChatConversation[]): ConversationChartPoint[] {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: dateKey(date),
      day: date.toLocaleDateString("es", { weekday: "short" }).replace(/\.$/, ""),
      value: 0,
    };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));

  for (const conversation of conversations) {
    const date = conversationDate(conversation);
    if (!date) continue;
    const bucket = byDay.get(dateKey(date));
    if (bucket) bucket.value += 1;
  }

  return days.map(({ day, value }) => ({ day, value }));
}

function buildChannelSeries(conversations: ChatConversation[]): ChannelChartPoint[] {
  const counts = conversations.reduce(
    (acc, conversation) => {
      acc[conversation.channel] += 1;
      return acc;
    },
    { whatsapp: 0, instagram: 0 } satisfies Record<ChatChannel, number>,
  );
  const total = conversations.length || 1;

  return (Object.keys(counts) as ChatChannel[])
    .filter((key) => counts[key] > 0)
    .map((key) => ({
      key,
      name: CHANNEL_META[key].label,
      value: counts[key],
      percent: Math.round((counts[key] / total) * 100),
      color: CHANNEL_META[key].color,
    }));
}

function buildOpportunities(conversations: ChatConversation[]): ChatConversation[] {
  const priority: Record<LeadStatus, number> = {
    caliente: 0,
    seguimiento: 1,
    interesado: 2,
    nuevo: 3,
    cliente: 4,
    perdido: 5,
  };

  return conversations
    .filter(
      (conversation) => conversation.lead === "caliente" || conversation.lead === "seguimiento",
    )
    .sort((a, b) => {
      const byLead = priority[a.lead] - priority[b.lead];
      if (byLead !== 0) return byLead;
      const aDate = conversationDate(a)?.getTime() ?? 0;
      const bDate = conversationDate(b)?.getTime() ?? 0;
      return bDate - aDate;
    })
    .slice(0, 4);
}

function ConversationsChart({ data }: { data: ConversationChartPoint[] }) {
  const hasData = data.some((point) => point.value > 0);

  return (
    <div className="cv-card animate-fade-up p-5 sm:p-6">
      <div>
        <h3
          className="text-base font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Conversaciones
        </h3>
        <p className="text-xs text-muted-foreground">Últimos 7 días</p>
      </div>

      {hasData ? (
        <div className="mt-5 h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 6, right: 4, left: -16, bottom: 0 }}
              barCategoryGap="22%"
            >
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                stroke="var(--cv-color-text-muted)"
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="var(--cv-color-text-muted)"
                fontSize={11}
                width={32}
              />
              <ReTooltip cursor={{ fill: "var(--cv-color-primary-light)" }} />
              <Bar dataKey="value" fill="var(--cv-color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChartState
          icon={TrendingUp}
          title="Sin conversaciones aún"
          desc="Cuando conectes tus canales, vas a ver el detalle acá."
        />
      )}
    </div>
  );
}

function ChannelsChart({ data }: { data: ChannelChartPoint[] }) {
  const hasData = data.length > 0;

  return (
    <div className="cv-card animate-fade-up p-5 sm:p-6">
      <div>
        <h3
          className="text-base font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Canales con más mensajes
        </h3>
        <p className="text-xs text-muted-foreground">Últimos 7 días</p>
      </div>

      {hasData ? (
        <div className="mt-2 flex items-center gap-4">
          <div className="relative h-[150px] w-[150px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={42}
                  outerRadius={64}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-2.5">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-sm font-medium text-foreground">{d.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {d.value} · {d.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyChartState
          icon={Inbox}
          title="Sin canales conectados aún"
          desc="WhatsApp e Instagram, próximamente."
        />
      )}
    </div>
  );
}

function EmptyChartState({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Inbox;
  title: string;
  desc: string;
}) {
  return (
    <div className="mt-5 flex h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[var(--cv-color-bg)]/50 text-center px-4 dark:bg-[color:color-mix(in_oklab,var(--primary)_4%,transparent)]">
      <div className="cv-tile mb-2.5">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function NextActionCard({
  icon: Icon,
  title,
  desc,
  ctaLabel,
  to,
  variant = "default",
}: {
  icon: typeof Target;
  title: string;
  desc: string;
  ctaLabel: string;
  to: string;
  variant?: "default" | "ghost-list";
}) {
  return (
    <div
      className="animate-fade-up rounded-[16px] border border-[var(--cv-color-border)] p-5 sm:p-6 dark:border-[color:var(--border)]"
      style={{
        background: "var(--cv-color-primary-light)",
        boxShadow: "var(--cv-shadow-card)",
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--cv-color-primary)] shadow-sm dark:bg-[color:color-mix(in_oklab,var(--primary)_22%,transparent)] dark:text-[color:var(--primary-glow)]"
            aria-hidden
          >
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>
          {variant === "ghost-list" && (
            <p
              className="text-base font-bold text-[var(--cv-color-primary-hover)] dark:text-[color:var(--primary-glow)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {title}
            </p>
          )}
        </div>
        {variant !== "ghost-list" && (
          <h3
            className="text-lg font-extrabold leading-tight text-[var(--cv-color-primary-hover)] dark:text-[color:var(--primary-glow)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {title}
          </h3>
        )}
        <div className="cv-divider opacity-50" />
        <p className="text-sm leading-relaxed text-foreground/80">{desc}</p>
        <Link to={to} className="cv-btn-primary mt-1 w-full justify-between">
          <span>{ctaLabel}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <div className="cv-card animate-fade-up p-5 sm:p-6">
      <h3
        className="text-base font-bold text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Actividad reciente
      </h3>
      {items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[var(--cv-color-bg)]/50 px-4 py-8 text-center dark:bg-[color:color-mix(in_oklab,var(--primary)_4%,transparent)]">
          <div className="cv-tile mb-3">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sin actividad reciente</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Cuando configures el agente o sumes productos, los movimientos van a aparecer acá.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 sm:gap-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    item.icon === "agent"
                      ? "cv-tile"
                      : item.icon === "product"
                        ? "cv-tile cv-tile-orange"
                        : item.icon === "rule"
                          ? "cv-tile cv-tile-green"
                          : "cv-tile cv-tile-blue"
                  }`}
                  aria-hidden
                >
                  {item.icon === "agent" ? (
                    <Bot className="h-4 w-4" />
                  ) : item.icon === "product" ? (
                    <ShoppingBag className="h-4 w-4" />
                  ) : item.icon === "rule" ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <Plug className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  {item.subtitle && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelative(item.ts)}
                </span>
              </li>
            ))}
          </ul>
          <div className="cv-divider mt-2" />
          <div className="mt-2 text-center">
            <Link
              to="/app/dashboard"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cv-color-primary)] transition hover:text-[var(--cv-color-primary-hover)] dark:text-[color:var(--primary-glow)]"
            >
              Ver toda la actividad <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function OpportunitiesCard({ conversations }: { conversations: ChatConversation[] }) {
  const hasData = conversations.length > 0;

  return (
    <div className="cv-card animate-fade-up p-5 sm:p-6">
      <h3
        className="text-base font-bold text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Oportunidades importantes
      </h3>
      {hasData ? (
        <ul className="mt-3 divide-y divide-border">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#F97316]">
                <Flame className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {conversation.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-[var(--cv-color-primary-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--cv-color-primary)]">
                    {LEAD_LABELS[conversation.lead]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {conversation.lastMessage || "Sin último mensaje"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{conversation.time}</span>
            </li>
          ))}
          <li className="pt-3 text-center">
            <Link
              to="/app/chats"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cv-color-primary)] transition hover:text-[var(--cv-color-primary-hover)]"
            >
              Ver conversaciones <ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[var(--cv-color-bg)]/50 px-4 py-10 text-center dark:bg-[color:color-mix(in_oklab,var(--primary)_4%,transparent)]">
          <div className="cv-tile cv-tile-orange mb-3">
            <Flame className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sin oportunidades aún</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Cuando empiecen a llegar chats, los clientes con mayor intención van a destacarse acá.
          </p>
          <Link to="/app/integrations" className="cv-btn-ghost mt-4 inline-flex">
            Conectar canales <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Skeleton
   ============================================================ */

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="cv-card p-6 sm:p-8">
        <div className="flex gap-6">
          <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-10 w-44 rounded-[10px]" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="cv-card space-y-3 p-5 sm:p-6">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
        <div className="cv-card space-y-3 p-5 sm:p-6">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}
