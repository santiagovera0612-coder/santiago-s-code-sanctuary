import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageCircle, Instagram, Plug } from "lucide-react";

export const Route = createFileRoute("/app/integrations")({
  head: () => ({ meta: [{ title: "Integraciones — Clerivo AI" }] }),
  component: Integrations,
});

type Status = "off" | "soon" | "ready";

type Item = {
  id: string;
  name: string;
  desc: string;
  icon: any;
  color: string;
  status: Status;
};

const items: Item[] = [
  {
    id: "wa",
    name: "WhatsApp",
    desc: "Vas a poder conectar WhatsApp Business para que tu agente responda los mensajes.",
    icon: MessageCircle,
    color: "text-emerald-500 bg-emerald-500/10",
    status: "soon",
  },
  {
    id: "ig",
    name: "Instagram",
    desc: "Vas a poder responder los mensajes directos de Instagram desde un solo lugar.",
    icon: Instagram,
    color: "text-pink-500 bg-pink-500/10",
    status: "soon",
  },
];

const statusMeta: Record<Status, { label: string; cls: string }> = {
  ready: { label: "Preparado para conectar", cls: "bg-primary/15 text-primary" },
  soon: { label: "Disponible próximamente", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  off: { label: "No conectado", cls: "bg-muted text-muted-foreground" },
};

function Integrations() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="animate-fade-up">
        <p className="text-sm text-muted-foreground">Conectá los canales por donde te hablan tus clientes</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Integraciones</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Todavía no hay canales conectados. Vas a poder conectarlos a medida que estén disponibles.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 stagger-children">
        {items.map((i) => {
          const meta = statusMeta[i.status];
          return (
            <div
              key={i.id}
              className="surface-card group relative flex flex-col gap-4 p-5 hover-lift"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${i.color}`}>
                  <i.icon className="h-5 w-5" />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                  {meta.label}
                </span>
              </div>
              <div>
                <h3 className="font-display text-base font-semibold">{i.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{i.desc}</p>
              </div>
              <button
                onClick={() => {
                  toast("Disponible próximamente", { description: `Te vamos a avisar cuando ${i.name} esté listo para conectar.` });
                }}
                className="mt-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                <Plug className="h-3.5 w-3.5" />
                Avisarme cuando esté
              </button>
            </div>
          );
        })}
      </div>

      <div className="surface-card p-5 text-center text-sm text-muted-foreground animate-fade-up">
        ¿Necesitás otro canal? Decinos cuál te interesa desde Configuración → Canales.
      </div>
    </div>
  );
}
