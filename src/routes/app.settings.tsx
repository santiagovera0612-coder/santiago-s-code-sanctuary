import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  User,
  ChevronRight,
  ArrowLeft,
  Check,
  Loader2,
  LogOut,
  CreditCard,
  Upload,
  Link as LinkIcon,
  FileText,
  StickyNote,
  Trash2,
  ImageIcon,
  Plus,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getStoredAgent,
  saveStoredAgent,
  uploadBusinessContextFile,
  uploadBusinessLogo,
  type ContextItem,
  type StoredAgent,
} from "@/lib/clerivo-agent";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Configuración — Clerivo" }] }),
  component: SettingsPage,
});

type SectionId = "business" | "account";
type UserMetadata = {
  full_name?: string;
  name?: string;
};

// Settings is intentionally focused on the three areas a business owner
// touches most often. Agent setup lives in the dedicated "Agente IA"
// page; integrations live in the dedicated "Integraciones" page; rules
// are part of the Agente IA configuration.
const SECTIONS: {
  id: SectionId;
  title: string;
  desc: string;
  icon: typeof Building2;
  accent: string;
}[] = [
  {
    id: "business",
    title: "Tu negocio",
    desc: "Logo, enlaces y contexto adicional para tu agente.",
    icon: Building2,
    accent: "from-violet-500/15 to-indigo-500/15 text-violet-500",
  },
  {
    id: "account",
    title: "Cuenta",
    desc: "Datos de acceso y sesión.",
    icon: User,
    accent: "from-rose-500/15 to-pink-500/15 text-rose-500",
  },
];

function SettingsPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<SectionId | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? "");
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (active) {
    const meta = SECTIONS.find((s) => s.id === active)!;
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <button
          onClick={() => setActive(null)}
          className="mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Configuración
        </button>

        <div className="mb-6 animate-fade-up">
          <div
            className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent}`}
          >
            <meta.icon className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta.desc}</p>
        </div>

        <div className="animate-fade-up">
          {active === "business" && <BusinessForm />}
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
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent}`}
            >
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
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Próximamente
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Plan y consumo. Disponible más adelante.
            </p>
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

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ---------- Sections ---------- */

const INDUSTRIES = [
  { value: "ecommerce", label: "E-commerce" },
  { value: "muebles", label: "Muebles y decoración" },
  { value: "inmobiliaria", label: "Inmobiliaria" },
  { value: "estetica", label: "Estética / belleza" },
  { value: "restaurante", label: "Restaurante" },
  { value: "salud", label: "Salud" },
  { value: "servicios", label: "Servicios profesionales" },
  { value: "ropa", label: "Tienda de ropa" },
  { value: "comida", label: "Comida" },
  { value: "tecnologia", label: "Tecnología" },
  { value: "otro", label: "Otro" },
];

const COUNTRIES = [
  { value: "ar", label: "Argentina" },
  { value: "mx", label: "México" },
  { value: "es", label: "España" },
  { value: "cl", label: "Chile" },
  { value: "co", label: "Colombia" },
  { value: "uy", label: "Uruguay" },
  { value: "pe", label: "Perú" },
  { value: "ot", label: "Otro" },
];

const CURRENCIES = [
  { value: "ARS", label: "ARS — Peso argentino" },
  { value: "USD", label: "USD — Dólar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "CLP", label: "CLP — Peso chileno" },
  { value: "COP", label: "COP — Peso colombiano" },
];

function BusinessForm() {
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await getStoredAgent();
        if (alive) setAgent(loaded);
      } catch {
        toast.error("No pudimos cargar los datos del negocio.");
        if (alive) setAgent(null);
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // If there's no agent yet, gently nudge to create one first.
  if (hydrated && !agent) {
    return (
      <Card>
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-5">
          <div className="icon-tile">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-semibold">Todavía no creaste tu Agente IA.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Empezá creando tu agente. Te vamos a pedir el nombre del negocio durante la
              configuración. Después podés volver acá para sumar logo, enlaces y contexto.
            </p>
          </div>
          <Button asChild size="sm" className="rounded-lg">
            <Link to="/app/create">
              Crear Agente IA <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (!agent) return null;

  return <BusinessFormInner initial={agent} />;
}

function BusinessFormInner({ initial }: { initial: StoredAgent }) {
  const [draft, setDraft] = useState<StoredAgent>(initial);
  const [saved, setSaved] = useState<StoredAgent>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const update = <K extends keyof StoredAgent>(k: K, v: StoredAgent[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await saveStoredAgent(draft);
      setDraft(next);
      setSaved(next);
      toast.success("Datos del negocio guardados");
    } catch {
      toast.error("No pudimos guardar los datos del negocio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ----- A · Identidad ----- */}
      <SectionCard
        title="Identidad del negocio"
        description="Lo más importante: cómo se llama tu negocio y cómo te ve la gente."
      >
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <LogoUpload
            value={draft.logo}
            onChange={(logo, logoStoragePath) => setDraft((d) => ({ ...d, logo, logoStoragePath }))}
          />
          <div className="grid gap-4">
            <Field label="Nombre del negocio" htmlFor="biz-name">
              <Input
                id="biz-name"
                value={draft.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder="Mi empresa"
                className="h-10 rounded-lg"
              />
            </Field>
            <Field label="Rubro" htmlFor="biz-industry">
              <Select
                value={draft.businessType || ""}
                onValueChange={(v) => update("businessType", v)}
              >
                <SelectTrigger id="biz-industry" className="h-10 rounded-lg">
                  <SelectValue placeholder="Elegí un rubro" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i.value} value={i.label}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <Field
          label="Descripción del negocio"
          htmlFor="biz-desc"
          hint="Tu agente la usa como contexto base."
        >
          <Textarea
            id="biz-desc"
            value={draft.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            placeholder="¿A qué se dedica tu negocio? ¿Qué te diferencia?"
            rows={3}
            className="rounded-lg"
          />
        </Field>
      </SectionCard>

      {/* ----- B · Canales y enlaces ----- */}
      <SectionCard
        title="Canales y enlaces"
        description="Tus puntos de contacto. El agente va a usar esta información cuando un cliente la pida."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Página web" htmlFor="biz-web">
            <Input
              id="biz-web"
              type="url"
              inputMode="url"
              value={draft.websiteUrl ?? ""}
              onChange={(e) => update("websiteUrl", e.target.value)}
              placeholder="https://tunegocio.com"
              className="h-10 rounded-lg"
            />
          </Field>
          <Field label="Instagram" htmlFor="biz-ig">
            <Input
              id="biz-ig"
              value={draft.instagramUrl ?? ""}
              onChange={(e) => update("instagramUrl", e.target.value)}
              placeholder="@tu_negocio o instagram.com/…"
              className="h-10 rounded-lg"
            />
          </Field>
          <Field label="WhatsApp" htmlFor="biz-wa" hint="Opcional.">
            <Input
              id="biz-wa"
              type="tel"
              inputMode="tel"
              value={draft.whatsappNumber ?? ""}
              onChange={(e) => update("whatsappNumber", e.target.value)}
              placeholder="+54 9 11 1234-5678"
              className="h-10 rounded-lg"
            />
          </Field>
          <Field label="Horario de atención" htmlFor="biz-hours">
            <Input
              id="biz-hours"
              value={draft.hours ?? ""}
              onChange={(e) => update("hours", e.target.value)}
              placeholder="Lun a Sáb · 9:00 a 19:00"
              className="h-10 rounded-lg"
            />
          </Field>
          <Field label="País" htmlFor="biz-country">
            <Select value={draft.country || ""} onValueChange={(v) => update("country", v)}>
              <SelectTrigger id="biz-country" className="h-10 rounded-lg">
                <SelectValue placeholder="País" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Moneda" htmlFor="biz-currency">
            <Select value={draft.currency || ""} onValueChange={(v) => update("currency", v)}>
              <SelectTrigger id="biz-currency" className="h-10 rounded-lg">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      {/* ----- C · Contexto adicional ----- */}
      <SectionCard
        title="Contexto adicional para tu agente"
        description="Sumá enlaces, PDFs o notas para que CLERIVO entienda mejor cómo responder."
      >
        <ContextItemsEditor
          items={draft.contextItems ?? []}
          onChange={(items) => update("contextItems", items)}
        />
      </SectionCard>

      {/* ----- Save bar ----- */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/70">
          {dirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
          <Button onClick={handleSave} disabled={!dirty || saving} className="h-9 rounded-lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Container card for a logical group of fields inside the business form. */
function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/30 px-5 py-4 sm:px-6">
        <p className="font-display text-base font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {description}
        </p>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
    </div>
  );
}

/** Square logo uploader. Accepts PNG/JPEG and stores the file in Supabase Storage. */
function LogoUpload({
  value,
  onChange,
}: {
  value?: string;
  onChange: (logo: string | undefined, logoStoragePath?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast.error("Subí un archivo PNG o JPG.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("El archivo es muy grande. Máximo 4 MB.");
      return;
    }
    setLoading(true);
    try {
      const uploaded = await uploadBusinessLogo(file);
      onChange(uploaded.logo, uploaded.logoStoragePath);
    } catch {
      toast.error("No pudimos subir el logo. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Subir logo"
        className={`group relative flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-accent/40"
        }`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : value ? (
          <>
            <img src={value} alt="Logo" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/60 text-xs font-medium text-background opacity-0 transition group-hover:opacity-100">
              <Upload className="mr-1 h-3.5 w-3.5" /> Cambiar
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
            <span className="text-[11px] leading-tight">Subí tu logo</span>
            <span className="text-[10px] leading-tight">PNG · JPG</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = ""; // allow re-selecting same file
          }}
        />
      </div>
      {value && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => onChange(undefined, undefined)}
          className="h-auto p-0 text-[11px] text-muted-foreground hover:text-destructive"
        >
          Quitar logo
        </Button>
      )}
    </div>
  );
}

/** List + add buttons for context items (links / PDFs stored in Supabase / notes). */
function ContextItemsEditor({
  items,
  onChange,
}: {
  items: ContextItem[];
  onChange: (items: ContextItem[]) => void;
}) {
  const [adding, setAdding] = useState<"link" | "note" | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [noteText, setNoteText] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);

  const add = (item: Omit<ContextItem, "id" | "addedAt">) => {
    const newItem: ContextItem = {
      ...item,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    onChange([...items, newItem]);
  };

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  const submitLink = () => {
    const value = linkValue.trim();
    if (!value) return;
    add({
      type: "link",
      label: linkLabel.trim() || prettyHost(value) || "Enlace",
      value,
    });
    setLinkLabel("");
    setLinkValue("");
    setAdding(null);
  };

  const submitNote = () => {
    const value = noteText.trim();
    if (!value) return;
    add({
      type: "note",
      label: value.slice(0, 40),
      value,
    });
    setNoteText("");
    setAdding(null);
  };

  const handlePdf = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Subí un archivo PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El PDF es muy grande (máximo 10 MB).");
      return;
    }
    setPdfUploading(true);
    try {
      const uploaded = await uploadBusinessContextFile(file);
      add({
        type: "pdf",
        label: file.name,
        value: file.name,
        size: file.size,
        storagePath: uploaded.storagePath,
      });
      toast.success(`${file.name} agregado al contexto`);
    } catch {
      toast.error("No pudimos subir el PDF. Probá de nuevo.");
    } finally {
      setPdfUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Items list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <div className="icon-tile">
            <FileText className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">Todavía no agregaste contexto</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Sumá enlaces, PDFs o notas para que CLERIVO entienda mejor a tu negocio.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:border-primary/30"
            >
              <div className="icon-tile-sm">
                {item.type === "link" ? (
                  <LinkIcon className="h-4 w-4" />
                ) : item.type === "pdf" ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <StickyNote className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.type === "pdf"
                    ? `PDF · ${formatBytes(item.size ?? 0)}`
                    : item.type === "link"
                      ? item.value
                      : "Nota"}
                </p>
              </div>
              {item.type === "link" && (
                <a
                  href={item.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition hover:text-primary"
                  aria-label="Abrir enlace"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Eliminar"
                className="text-muted-foreground transition hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Inline forms for add link / note */}
      {adding === "link" && (
        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
          <Field label="Título (opcional)">
            <Input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Ej: Política de envíos"
              className="h-10 rounded-lg"
            />
          </Field>
          <Field label="URL">
            <Input
              type="url"
              inputMode="url"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="https://…"
              className="h-10 rounded-lg"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdding(null);
                setLinkLabel("");
                setLinkValue("");
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={submitLink} disabled={!linkValue.trim()}>
              Agregar enlace
            </Button>
          </div>
        </div>
      )}

      {adding === "note" && (
        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
          <Field label="Nota" hint="Texto libre que tu agente puede usar como contexto.">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ej: Los envíos al interior tardan entre 3 y 5 días hábiles."
              rows={4}
              className="rounded-lg"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdding(null);
                setNoteText("");
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={submitNote} disabled={!noteText.trim()}>
              Agregar nota
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {adding === null && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding("link")}
            className="rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" /> <LinkIcon className="h-3.5 w-3.5" /> Agregar enlace
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pdfInput.current?.click()}
            disabled={pdfUploading}
            className="rounded-lg"
          >
            {pdfUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <FileText className="h-3.5 w-3.5" /> Subir PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding("note")}
            className="rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" /> <StickyNote className="h-3.5 w-3.5" /> Agregar nota
          </Button>
          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePdf(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

function prettyHost(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// AgentForm, ChannelsForm and RulesForm were removed from Settings:
// the agent configuration now lives entirely in /app/create, the
// integrations in /app/integrations and the rules inside the agent
// editor. The three sections still appear in the main sidebar so
// nothing is lost — only the duplicated entry points inside Settings.

function AccountForm({ email }: { email: string }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const meta = (user?.user_metadata ?? {}) as UserMetadata;
      setName(meta.full_name ?? meta.name ?? "");
    })();
  }, []);

  const saveName = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) toast.error(error.message);
    else toast.success("Nombre actualizado ✓");
  };

  const changePassword = async () => {
    if (pw.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setChanging(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Contraseña actualizada ✓");
      setPw("");
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="space-y-4">
      <Card
        footer={
          <Button onClick={saveName} size="sm" className="rounded-lg">
            <Check className="h-3.5 w-3.5" /> Guardar
          </Button>
        }
      >
        <Field label="Nombre del usuario">
          <Input
            className="h-10 rounded-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
          />
        </Field>
        <Field label="Email" hint="El email asociado a tu cuenta.">
          <Input
            className="h-10 rounded-lg"
            value={!email || /demo|clerivo\.app$/i.test(email) ? "Usuario" : email}
            disabled
          />
        </Field>
      </Card>

      <Card
        footer={
          <Button
            onClick={changePassword}
            disabled={changing || !pw}
            size="sm"
            className="rounded-lg"
          >
            {changing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Cambiar contraseña
          </Button>
        }
      >
        <Field label="Nueva contraseña" hint="Mínimo 6 caracteres.">
          <Input
            className="h-10 rounded-lg"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
      </Card>

      <Button
        onClick={logout}
        variant="outline"
        className="w-full justify-center rounded-2xl border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
