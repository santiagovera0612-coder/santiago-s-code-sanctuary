import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2, Bot, MessageSquare, Shield, User,
  ChevronRight, ArrowLeft, Check, Loader2, LogOut, Instagram, Plug, CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Configuración — Clerivo" }] }),
  component: SettingsPage,
});

type SectionId = "business" | "agent" | "channels" | "rules" | "account";

const SECTIONS: {
  id: SectionId;
  title: string;
  desc: string;
  icon: any;
  accent: string;
}[] = [
  { id: "business", title: "Tu negocio", desc: "Datos básicos de tu empresa.", icon: Building2, accent: "from-violet-500/15 to-indigo-500/15 text-violet-500" },
  { id: "agent", title: "Agente IA", desc: "Configurá cómo responde tu asistente.", icon: Bot, accent: "from-indigo-500/15 to-blue-500/15 text-indigo-500" },
  { id: "channels", title: "Integraciones", desc: "Gestioná WhatsApp, Instagram y otros canales.", icon: Plug, accent: "from-emerald-500/15 to-teal-500/15 text-emerald-500" },
  { id: "rules", title: "Reglas de respuesta", desc: "Definí qué puede hacer y qué no puede inventar la IA.", icon: Shield, accent: "from-amber-500/15 to-orange-500/15 text-amber-500" },
  { id: "account", title: "Cuenta", desc: "Datos de acceso y sesión.", icon: User, accent: "from-rose-500/15 to-pink-500/15 text-rose-500" },
];

const DEFAULTS = {
  business: { name: "", industry: "servicios", country: "ar", currency: "ars", hours: "", description: "" },
  agent: { name: "Sofía", goal: "responder", tone: "cercano", mode: "sugerir" },
  channels: { whatsapp_enabled: false, instagram_enabled: false },
  rules: { can_do: "", cannot_invent: "", handoff_when: "", must_ask: "" },
};

type Settings = typeof DEFAULTS;

function SettingsPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<SectionId | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setUserEmail(user.email ?? "");
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setSettings({
          business: { ...DEFAULTS.business, ...((data as any).business ?? {}) },
          agent: { ...DEFAULTS.agent, ...((data as any).agent ?? {}) },
          channels: { ...DEFAULTS.channels, ...((data as any).channels ?? {}) },
          rules: { ...DEFAULTS.rules, ...((data as any).rules ?? {}) },
        });
      }
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof Settings>(key: K, partial: Partial<Settings[K]>) =>
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], ...partial } }));

  const save = async <K extends keyof Settings>(key: K) => {
    if (!userId) { toast.error("Debes iniciar sesión"); return; }
    const payload: any = { user_id: userId, [key]: settings[key] };
    const { error } = await supabase.from("user_settings").upsert(payload, { onConflict: "user_id" });
    if (error) toast.error("No se pudo guardar: " + error.message);
    else toast.success("Cambios guardados ✓");
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (active) {
    const meta = SECTIONS.find(s => s.id === active)!;
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <button
          onClick={() => setActive(null)}
          className="mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Configuración
        </button>

        <div className="mb-6 animate-fade-up">
          <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent}`}>
            <meta.icon className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta.desc}</p>
        </div>

        <div className="animate-fade-up">
          {active === "business" && <BusinessForm v={settings.business} on={(p: any) => update("business", p)} onSave={() => save("business")} />}
          {active === "agent" && <AgentForm v={settings.agent} on={(p: any) => update("agent", p)} onSave={() => save("agent")} />}
          {active === "channels" && <ChannelsForm v={settings.channels} on={(p: any) => update("channels", p)} onSave={() => save("channels")} />}
          {active === "rules" && <RulesForm v={settings.rules} on={(p: any) => update("rules", p)} onSave={() => save("rules")} />}
          {active === "account" && <AccountForm email={userEmail} />}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elegí qué querés ajustar de tu espacio.
        </p>
      </div>

      <div className="grid gap-3 animate-fade-up">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold">{s.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
        <button
          onClick={() => navigate({ to: "/app/billing" })}
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/15 to-blue-500/15 text-sky-500">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display text-base font-semibold">Facturación</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Próximamente</span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">Plan y consumo. Disponible más adelante.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Reusable ---------- */

function Card({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="space-y-5 px-6 py-6">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: any) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 ${props.className ?? ""}`}
    />
  );
}

function TArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[90px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 ${props.className ?? ""}`}
    />
  );
}

function TSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 ${props.className ?? ""}`}
    >{children}</select>
  );
}

function SaveButton({ onSave }: { onSave: () => Promise<void> | void }) {
  const [saving, setSaving] = useState(false);
  return (
    <button
      onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}
      disabled={saving}
      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-50"
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      {saving ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

/* ---------- Forms ---------- */

function BusinessForm({ v, on, onSave }: any) {
  return (
    <Card footer={<SaveButton onSave={onSave} />}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre del negocio"><TInput value={v.name} onChange={e => on({ name: e.target.value })} placeholder="Mi empresa" /></Field>
        <Field label="Rubro">
          <TSelect value={v.industry} onChange={e => on({ industry: e.target.value })}>
            <option value="ecommerce">E-commerce</option>
            <option value="muebles">Muebles y decoración</option>
            <option value="inmobiliaria">Inmobiliaria</option>
            <option value="estetica">Estética / belleza</option>
            <option value="restaurante">Restaurante</option>
            <option value="salud">Salud</option>
            <option value="servicios">Servicios profesionales</option>
          </TSelect>
        </Field>
        <Field label="País">
          <TSelect value={v.country} onChange={e => on({ country: e.target.value })}>
            <option value="ar">Argentina</option>
            <option value="mx">México</option>
            <option value="es">España</option>
            <option value="cl">Chile</option>
            <option value="co">Colombia</option>
          </TSelect>
        </Field>
        <Field label="Moneda">
          <TSelect value={v.currency} onChange={e => on({ currency: e.target.value })}>
            <option value="ars">ARS — Peso argentino</option>
            <option value="usd">USD — Dólar</option>
            <option value="eur">EUR — Euro</option>
            <option value="mxn">MXN — Peso mexicano</option>
            <option value="clp">CLP — Peso chileno</option>
          </TSelect>
        </Field>
        <Field label="Horario de atención">
          <TInput value={v.hours} onChange={e => on({ hours: e.target.value })} placeholder="Lun a Sáb · 9:00 a 19:00 hs" />
        </Field>
      </div>
      <Field label="Descripción corta del negocio" hint="El agente la usará como contexto base.">
        <TArea value={v.description} onChange={e => on({ description: e.target.value })} placeholder="¿A qué se dedica tu negocio?" />
      </Field>
    </Card>
  );
}

function AgentForm(_: any) {
  return (
    <Card>
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-base font-semibold">La configuración principal del agente se gestiona desde Agente IA.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Editá su perfil, tono, objetivo y modo de trabajo desde ahí para mantener todo en un solo lugar.
          </p>
        </div>
        <a href="/app/create" className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow">
          Ir a Agente IA <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}

function ChannelsForm({ v, on, onSave }: any) {
  const channels = [
    { key: "whatsapp_enabled" as const, name: "WhatsApp", desc: "Respondé mensajes de tus clientes desde WhatsApp Business.", icon: MessageSquare, color: "text-emerald-500 bg-emerald-500/10" },
    { key: "instagram_enabled" as const, name: "Instagram", desc: "Conectá los mensajes directos de Instagram.", icon: Instagram, color: "text-pink-500 bg-pink-500/10" },
  ];
  return (
    <Card footer={<SaveButton onSave={onSave} />}>
      <div className="grid gap-3">
        {channels.map(c => (
            <div key={c.key} className="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Próximamente
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
              </div>
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground opacity-70"
              >
                <Plug className="h-3.5 w-3.5" /> Disponible próximamente
              </button>
            </div>
          ))}
      </div>
    </Card>
  );
}

function RulesForm(_: any) {
  return (
    <Card>
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-base font-semibold">Las reglas de respuesta se editan desde Agente IA &gt; Reglas de respuesta.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Definí qué puede responder, qué no debe inventar y cuándo derivar a una persona.
          </p>
        </div>
        <a href="/app/create" className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow">
          Editar reglas del agente <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}

function AccountForm({ email }: { email: string }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = (user?.user_metadata ?? {}) as any;
      setName(meta.full_name ?? meta.name ?? "");
    })();
  }, []);

  const saveName = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) toast.error(error.message);
    else toast.success("Nombre actualizado ✓");
  };

  const changePassword = async () => {
    if (pw.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setChanging(false);
    if (error) toast.error(error.message);
    else { toast.success("Contraseña actualizada ✓"); setPw(""); }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="space-y-4">
      <Card footer={<button onClick={saveName} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"><Check className="h-3.5 w-3.5" /> Guardar</button>}>
        <Field label="Nombre del usuario">
          <TInput value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
        </Field>
        <Field label="Email" hint="El email asociado a tu cuenta.">
          <TInput
            value={!email || /demo|clerivo\.app$/i.test(email) ? "Usuario" : email}
            disabled
          />
        </Field>
      </Card>

      <Card footer={
        <button
          onClick={changePassword}
          disabled={changing || !pw}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-50"
        >
          {changing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Cambiar contraseña
        </button>
      }>
        <Field label="Nueva contraseña" hint="Mínimo 6 caracteres.">
          <TInput type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
        </Field>
      </Card>

      <button
        onClick={logout}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </div>
  );
}
