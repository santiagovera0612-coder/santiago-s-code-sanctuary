import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Instagram,
  Loader2,
  MessageCircle,
  Plug,
  Send,
} from "lucide-react";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/integrations")({
  head: () => ({ meta: [{ title: "Integraciones — Clerivo AI" }] }),
  component: Integrations,
});

type WhatsAppAccount = {
  id: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  status: "pending" | "verified" | "active" | "suspended" | "error";
  lastError?: string;
  verifiedAt?: string;
  activatedAt?: string;
  createdAt: string;
};

type WhatsAppAccountResponse = {
  account: WhatsAppAccount | null;
  verifyTokenConfigured?: boolean;
  webhookPath?: string;
};

const statusMeta: Record<
  WhatsAppAccount["status"],
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  active: {
    label: "Activo",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  verified: {
    label: "Verificado",
    cls: "bg-primary/15 text-primary",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pendiente",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: AlertCircle,
  },
  suspended: {
    label: "Suspendido",
    cls: "bg-muted text-muted-foreground",
    icon: AlertCircle,
  },
  error: {
    label: "Error",
    cls: "bg-destructive/15 text-destructive",
    icon: AlertCircle,
  },
};

type MetaGraphError = {
  message?: string;
  code?: number | string;
  type?: string;
};

function parseMetaGraphError(detail?: string): MetaGraphError | null {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as MetaGraphError) : null;
  } catch {
    return null;
  }
}

function integrationApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const meta = parseMetaGraphError(error.detail);
    if (String(meta?.code) === "190") {
      return `${fallback}: el token de Meta expiro o ya no es valido. Genera uno nuevo y guardalo.`;
    }
    if (String(meta?.code) === "131030") {
      return `${fallback}: el numero no esta autorizado para este token de prueba. Agregalo en Meta, genera un token nuevo y guardalo aca.`;
    }
    if (String(meta?.code) === "131047") {
      return `${fallback}: pasaron mas de 24 horas desde el ultimo mensaje del cliente. Para reabrir la conversacion necesitas una plantilla.`;
    }
    const detail = meta?.message || error.detail || error.code;
    return detail ? `${fallback}: ${detail}` : fallback;
  }
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}

function Integrations() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="animate-fade-up">
        <p className="text-sm text-muted-foreground">
          Conectá los canales por donde te hablan tus clientes
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Integraciones</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          WhatsApp ya puede conectarse con un token manual. Instagram queda preparado para una etapa
          posterior.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <WhatsAppCard />
        <InstagramCard />
      </div>
    </div>
  );
}

function WhatsAppCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [account, setAccount] = useState<WhatsAppAccount | null>(null);
  const [verifyTokenConfigured, setVerifyTokenConfigured] = useState(false);
  const [webhookPath, setWebhookPath] = useState("/api/webhooks/whatsapp");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testText, setTestText] = useState("");

  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return webhookPath;
    return `${window.location.origin}${webhookPath}`;
  }, [webhookPath]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet<WhatsAppAccountResponse>("whatsapp/account");
      setAccount(data.account);
      setVerifyTokenConfigured(!!data.verifyTokenConfigured);
      setWebhookPath(data.webhookPath ?? "/api/webhooks/whatsapp");
      setPhoneNumberId(data.account?.phoneNumberId ?? "");
      setDisplayPhoneNumber(data.account?.displayPhoneNumber ?? "");
    } catch {
      toast.error("No pudimos cargar la integración de WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!phoneNumberId.trim()) {
      toast.error("Ingresá el Phone Number ID.");
      return;
    }
    if (!account && !accessToken.trim()) {
      toast.error("Pegá el access token de WhatsApp.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiPut<{ account: WhatsAppAccount }>("whatsapp/account", {
        phoneNumberId,
        displayPhoneNumber,
        ...(accessToken.trim() ? { accessToken } : {}),
      });
      setAccount(data.account);
      setAccessToken("");
      toast.success("WhatsApp guardado. Configurá el webhook en Meta.");
    } catch {
      toast.error("No pudimos guardar WhatsApp.");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim() || !testText.trim()) {
      toast.error("Completá número y mensaje de prueba.");
      return;
    }
    setTesting(true);
    try {
      await apiPost("whatsapp/test", { to: testTo, text: testText });
      toast.success("Mensaje de prueba enviado.");
      setTestText("");
    } catch (error) {
      toast.error(integrationApiErrorMessage(error, "No pudimos enviar el mensaje de prueba"));
    } finally {
      setTesting(false);
    }
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook copiado.");
    } catch {
      toast.error("No pudimos copiar el webhook.");
    }
  };

  if (loading) {
    return (
      <div className="surface-card space-y-4 p-5">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const meta = account ? statusMeta[account.status] : null;
  const StatusIcon = meta?.icon ?? AlertCircle;

  return (
    <div className="surface-card space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">WhatsApp</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Conectá WhatsApp Business Cloud API con token manual.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            meta?.cls ?? "bg-muted text-muted-foreground"
          }`}
        >
          <StatusIcon className="h-3 w-3" />
          {meta?.label ?? "No conectado"}
        </span>
      </div>

      {!verifyTokenConfigured && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Falta configurar WHATSAPP_VERIFY_TOKEN en el backend.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone Number ID" htmlFor="wa-phone-id">
          <Input
            id="wa-phone-id"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="Ej: 123456789012345"
            className="h-10 rounded-lg"
          />
        </Field>
        <Field label="Número visible" htmlFor="wa-display">
          <Input
            id="wa-display"
            value={displayPhoneNumber}
            onChange={(e) => setDisplayPhoneNumber(e.target.value)}
            placeholder="+54 9 11 1234-5678"
            className="h-10 rounded-lg"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label={account ? "Reemplazar access token" : "Access token"}
            htmlFor="wa-token"
            hint={
              account
                ? "Dejalo vacío si no querés reemplazar el token guardado."
                : "Se guarda cifrado con AES-GCM en Supabase."
            }
          >
            <Input
              id="wa-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Pegá el token de Meta"
              className="h-10 rounded-lg"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold text-foreground">Webhook URL</p>
        <div className="mt-2 flex gap-2">
          <Input value={webhookUrl} readOnly className="h-10 rounded-lg text-xs" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copyWebhook}
            className="h-10 w-10 rounded-lg"
            aria-label="Copiar webhook"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          En Meta usá el verify token configurado como WHATSAPP_VERIFY_TOKEN.
        </p>
      </div>

      {account?.lastError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {account.lastError}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="h-10 rounded-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          Guardar WhatsApp
        </Button>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="font-display text-sm font-semibold">Mensaje de prueba</h3>
        <div className="mt-3 grid gap-3">
          <Field label="Enviar a" htmlFor="wa-test-to">
            <Input
              id="wa-test-to"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="5491112345678"
              className="h-10 rounded-lg"
            />
          </Field>
          <Field label="Mensaje" htmlFor="wa-test-text">
            <Textarea
              id="wa-test-text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Escribí un mensaje corto para probar el envío."
              rows={3}
              className="rounded-lg"
            />
          </Field>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={sendTest}
              disabled={!account || testing}
              className="h-10 rounded-lg"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar prueba
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstagramCard() {
  return (
    <div className="surface-card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500">
          <Instagram className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          Disponible próximamente
        </span>
      </div>
      <div>
        <h3 className="font-display text-base font-semibold">Instagram</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Los mensajes directos de Instagram se conectarán más adelante.
        </p>
      </div>
      <button
        onClick={() =>
          toast("Disponible próximamente", {
            description: "Te vamos a avisar cuando Instagram esté listo.",
          })
        }
        className="mt-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-muted"
      >
        <Plug className="h-3.5 w-3.5" />
        Avisarme cuando esté
      </button>
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
  children: ReactNode;
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
