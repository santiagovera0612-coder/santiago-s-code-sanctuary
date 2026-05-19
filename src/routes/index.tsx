import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  MessageSquare,
  Zap,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Clock,
  Users,
  Check,
  ChevronRight,
  Store,
  UtensilsCrossed,
  Building2,
  Stethoscope,
  Scissors,
  Briefcase,
  Instagram,
  MessageCircle,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clerivo — Creá y probá tu Agente IA para tu negocio" },
      {
        name: "description",
        content:
          "Diseñá tu Agente IA, definí sus reglas, cargá tu catálogo y probalo en el Simulador. Prepará WhatsApp e Instagram para cuando estén disponibles.",
      },
      { property: "og:title", content: "Clerivo — Creá y probá tu Agente IA" },
      {
        property: "og:description",
        content: "Diseñá tu agente, definí reglas, cargá tu catálogo y probalo en el Simulador.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <LogosStrip />
      <Benefits />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">clerivo</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#beneficios" className="hover:text-foreground">
            Beneficios
          </a>
          <a href="#como-funciona" className="hover:text-foreground">
            Cómo funciona
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            Iniciar sesión
          </Link>
          <Button
            asChild
            size="sm"
            className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
          >
            <Link to="/register">
              Crear agente <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden product-shell">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-primary opacity-70" />
      <div className="mx-auto grid min-h-[calc(100svh-7rem)] max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Badge
            variant="secondary"
            className="mb-5 gap-1.5 rounded-full border border-border bg-surface-elevated/90 py-1.5 shadow-sm backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Plataforma para diseñar tu Agente IA
          </Badge>
          <h1 className="max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-normal md:text-6xl lg:text-7xl">
            Clerivo: creá tu Agente IA en minutos
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Configurá cómo debe responder, cargá tus productos y probalo en el Simulador.
            Prepará tus canales de WhatsApp e Instagram cuando estén disponibles.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            >
              <Link to="/register">
                Crear primer agente <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6">
              <Link to="/app/simulator">Probar en el Simulador</Link>
            </Button>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm">
            <ProofMetric value="Creá" label="tu Agente IA" />
            <ProofMetric value="Probá" label="en el Simulador" />
            <ProofMetric value="Prepará" label="tus canales" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <HeroMockup />
        </motion.div>
      </div>
    </section>
  );
}

function ProofMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface-card px-3 py-2.5">
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="surface-card overflow-hidden p-2 shadow-elegant">
        <div className="rounded-lg bg-background p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Clara · Agente IA</p>
                <p className="text-xs text-muted-foreground">Vista previa</p>
              </div>
            </div>
            <Badge className="bg-accent text-accent-foreground">Ejemplo visual</Badge>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <Bubble side="user">Hola, ¿tienen la Lámpara Nórdica?</Bubble>
            <Bubble side="bot">
              ¡Hola! Sí, la <b>Lámpara Nórdica</b> está en catálogo. ¿Querés que te pase los colores
              disponibles y el precio?
            </Bubble>
            <Bubble side="user">Dale, contame</Bubble>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
              </div>
              Clara está escribiendo…
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
        className="absolute -left-8 top-12 hidden surface-card p-3 lg:block"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/15">
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tu Agente IA</p>
            <p className="text-sm font-semibold">Configurable</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
        className="absolute -right-6 bottom-12 hidden surface-card p-3 lg:block"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Canales</p>
            <p className="text-sm font-semibold">Próximamente</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Bubble({ side, children }: { side: "user" | "bot"; children: React.ReactNode }) {
  const isUser = side === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-muted text-foreground"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function LogosStrip() {
  return null;
}

function Benefits() {
  const items = [
    {
      icon: Bot,
      title: "Creá tu Agente IA",
      text: "Definí su nombre, tono y objetivo en pocos minutos.",
    },
    {
      icon: ShieldCheck,
      title: "Reglas claras",
      text: "Definí qué puede responder y qué no debe inventar.",
    },
    {
      icon: Users,
      title: "Cargá tu catálogo",
      text: "Sumá tus productos para que la IA los conozca.",
    },
    {
      icon: MessageSquare,
      title: "Probá en el Simulador",
      text: "Mirá cómo respondería tu agente ante un cliente.",
    },
    {
      icon: Globe,
      title: "Prepará tus canales",
      text: "WhatsApp e Instagram, disponibles próximamente.",
    },
    {
      icon: Clock,
      title: "Setup rápido",
      text: "Sin código y sin manuales. Una experiencia guiada y simple.",
    },
  ];
  return (
    <section id="beneficios" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          tag="Qué podés hacer hoy"
          title="Diseñá tu Agente IA paso a paso"
          subtitle="Una experiencia simple para preparar tu agente antes de conectar canales reales."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group surface-card p-6 transition hover:border-primary/30 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary transition group-hover:bg-gradient-primary group-hover:text-primary-foreground">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-display text-lg font-semibold">{b.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{b.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Configurá tu negocio",
      text: "Cargá los datos básicos y el contexto que necesita el agente.",
    },
    {
      n: "02",
      title: "Diseñá tu Agente IA",
      text: "Elegí su nombre, tono, objetivo y reglas de respuesta.",
    },
    {
      n: "03",
      title: "Cargá tu catálogo",
      text: "Sumá productos para que la IA pueda responder con tu información.",
    },
    {
      n: "04",
      title: "Probá en el Simulador",
      text: "Conversá con tu agente como si fueras un cliente y ajustá lo que haga falta.",
    },
  ];
  return (
    <section id="como-funciona" className="border-y border-border bg-surface/50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          tag="Cómo funciona"
          title="Tu agente listo en 4 pasos simples"
          subtitle="Sin código y sin equipo técnico."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="relative surface-card p-6"
            >
              <span className="font-display text-3xl font-bold text-gradient">{s.n}</span>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    { icon: Store, label: "Tiendas online" },
    { icon: UtensilsCrossed, label: "Restaurantes" },
    { icon: Building2, label: "Inmobiliarias" },
    { icon: Stethoscope, label: "Clínicas" },
    { icon: Scissors, label: "Estéticas" },
    { icon: Briefcase, label: "Profesionales" },
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          tag="Casos de uso"
          title="Hecho para negocios reales"
          subtitle="Desde un pequeño emprendimiento hasta una pyme con miles de clientes."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-display font-semibold">{c.label}</p>
                <p className="text-xs text-muted-foreground">Configurable según tu negocio</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="planes" className="border-y border-border bg-surface/50 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeader
          tag="Planes"
          title="Planes y pagos"
          subtitle="La gestión de planes y pagos estará disponible próximamente."
        />
        <div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Por ahora podés crear tu Agente IA, cargar productos y probarlo en el Simulador sin
            costo. Cuando habilitemos pagos te vamos a avisar.
          </p>
          <Button
            asChild
            className="mt-6 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Link to="/register">Crear mi agente</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "¿Necesito saber programar?",
      a: "No. Clerivo está diseñado para dueños de negocios sin experiencia técnica.",
    },
    {
      q: "¿En qué canales funciona?",
      a: "Vamos a habilitar WhatsApp e Instagram. Por ahora podés diseñar y probar tu agente.",
    },
    {
      q: "¿Cómo se entrena el agente?",
      a: "Cargás tu catálogo, definís reglas y tono de respuesta. El agente usa esa información como contexto.",
    },
    {
      q: "¿Puedo revisar las respuestas antes de enviarlas?",
      a: "Sí. Te recomendamos el modo \"Responder con aprobación\" para mantener el control.",
    },
    {
      q: "¿Cuánto cuesta?",
      a: "La gestión de planes y pagos estará disponible próximamente. Mientras tanto, podés usar Clerivo sin costo.",
    },
    { q: "¿Mis datos están seguros?", a: "Sí. Tu información se guarda asociada a tu cuenta y solo vos podés acceder." },
  ];
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeader
          tag="FAQ"
          title="Preguntas frecuentes"
          subtitle="Las dudas más comunes antes de empezar."
        />
        <div className="mt-12 space-y-3">
          {items.map((i) => (
            <details
              key={i.q}
              className="group rounded-xl border border-border bg-card p-5 transition hover:border-primary/30"
            >
              <summary className="flex cursor-pointer items-center justify-between font-display font-semibold">
                {i.q}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{i.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="px-6 py-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center shadow-elegant md:p-16">
        <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
        <div className="relative">
          <Sparkles className="mx-auto mb-4 h-8 w-8 text-primary-foreground" />
          <h2 className="font-display text-4xl font-bold leading-tight text-primary-foreground md:text-5xl">
            Creá tu Agente IA en minutos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Diseñá su perfil, cargá tus productos y probalo en el Simulador. Cuando estén
            disponibles los canales, vas a poder conectarlos.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 bg-background px-6 text-foreground hover:bg-background/90"
          >
            <Link to="/register">
              Crear mi agente <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ tag, title, subtitle }: { tag: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Badge variant="secondary" className="mb-4 rounded-full bg-accent text-accent-foreground">
        {tag}
      </Badge>
      <h2 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Footer() {
  const channels = [
    { icon: MessageCircle, name: "WhatsApp" },
    { icon: Instagram, name: "Instagram" },
  ];
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold">clerivo</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Agentes de IA para preparar, probar y mejorar la atención de tu negocio.
            </p>
          </div>
          {[
            { title: "Producto", items: ["Agente IA", "Simulador", "Integraciones"] },
            { title: "Recursos", items: ["Centro de ayuda", "Novedades"] },
            { title: "Empresa", items: ["Sobre nosotros", "Contacto", "Términos", "Privacidad"] },
          ].map((c) => (
            <div key={c.title}>
              <h4 className="mb-3 text-sm font-semibold">{c.title}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {c.items.map((i) => (
                  <li key={i}>
                    <a href="#" className="hover:text-foreground">
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© 2026 Clerivo. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <span>Canales próximamente:</span>
            {channels.map((c) => (
              <span key={c.name} className="flex items-center gap-1.5">
                <c.icon className="h-3.5 w-3.5" /> {c.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
