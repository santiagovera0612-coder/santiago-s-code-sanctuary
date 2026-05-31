import { createFileRoute } from "@tanstack/react-router";
import { Clock, CreditCard, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/app/billing")({
  head: () => ({ meta: [{ title: "Facturación — Clerivo AI" }] }),
  component: Billing,
});

function Billing() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="animate-fade-up">
        <p className="text-sm text-muted-foreground">Plan y consumo</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Facturación</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          La gestión de planes y pagos todavía no está activa. Estará disponible próximamente.
        </p>
      </div>

      <div className="surface-card relative overflow-hidden p-6 animate-fade-up">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-primary" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Clock className="h-3 w-3" /> Disponible próximamente
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold">Planes y pagos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vas a poder elegir tu plan, ver tu consumo y administrar pagos desde acá.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            disabled
            className="inline-flex min-h-10 cursor-not-allowed items-center gap-1.5 rounded-lg bg-muted px-4 text-sm font-semibold text-muted-foreground opacity-70"
          >
            <Clock className="h-3.5 w-3.5" /> Disponible próximamente
          </button>
          <span className="text-xs text-muted-foreground">
            Te vamos a avisar cuando esté listo.
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Info
          icon={Sparkles}
          title="Sin cobros activos"
          desc="Por ahora podés usar Clerivo sin tarjeta ni suscripción."
        />
        <Info
          icon={CreditCard}
          title="Pagos y facturas"
          desc="La emisión de facturas y los medios de pago se van a habilitar más adelante."
        />
      </div>
    </div>
  );
}

function Info({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="surface-card p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
