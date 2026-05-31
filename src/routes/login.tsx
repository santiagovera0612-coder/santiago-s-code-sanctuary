import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase, supabaseConfigError } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }).max(72),
});

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Clerivo" },
      {
        name: "description",
        content: "Accedé a tu cuenta de Clerivo y gestioná tus agentes de IA.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/app/dashboard",
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (supabaseConfigError) {
      toast.error(supabaseConfigError);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : error.message,
      );
      return;
    }
    toast.success("¡Bienvenido de vuelta!");
    navigate({ to: search.redirect });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">clerivo</span>
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Bienvenido de vuelta
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresá a tu cuenta para gestionar tus agentes y conversaciones.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <Field
                id="email"
                label="Email"
                icon={<Mail className="h-4 w-4" />}
                type="email"
                placeholder="vos@ejemplo.com"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />

              <div>
                <Field
                  id="password"
                  label="Contraseña"
                  icon={<Lock className="h-4 w-4" />}
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="text-muted-foreground transition hover:text-foreground"
                      aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="h-12 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
              >
                {loading ? (
                  "Ingresando…"
                ) : (
                  <>
                    Iniciar sesión <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿No tenés cuenta?{" "}
              <Link to="/register" className="font-medium text-foreground hover:underline">
                Creá una gratis
              </Link>
            </p>
          </motion.div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Clerivo · Hecho con cariño
        </p>
      </div>

      {/* Visual side */}
      <SidePanel />
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
  trailing,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="group relative flex items-center">
        <span className="pointer-events-none absolute left-3 z-10 text-muted-foreground transition group-focus-within:text-primary">
          {icon}
        </span>
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 rounded-xl bg-background pl-10 pr-10 text-sm"
        />
        {trailing && <span className="absolute right-3 z-10">{trailing}</span>}
      </div>
    </div>
  );
}

function SidePanel() {
  const benefits = [
    {
      icon: <Sparkles className="h-4 w-4" />,
      t: "Creación guiada",
      d: "Configurá tu agente respondiendo unas preguntas.",
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      t: "Reglas claras",
      d: "Definí qué responde y qué no debe inventar tu agente.",
    },
    {
      icon: <Zap className="h-4 w-4" />,
      t: "Simulador de respuestas",
      d: "Probá cómo respondería antes de conectarlo.",
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      t: "Canales preparados",
      d: "WhatsApp e Instagram, próximamente.",
    },
  ];
  return (
    <div className="relative hidden overflow-hidden bg-gradient-mesh lg:block">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
      <div className="relative flex h-full flex-col justify-between p-12">
        <div className="flex justify-end">
          <div className="rounded-full border border-border/60 bg-surface-elevated/80 px-3 py-1.5 text-xs backdrop-blur">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />
            Plataforma para diseñar tu Agente IA
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              Diseñá tu
              <br /> Agente IA.
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Configurá reglas, cargá productos y probá respuestas antes de conectar tus canales.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {benefits.map((b) => (
              <div
                key={b.t}
                className="rounded-xl border border-border/60 bg-surface-elevated/70 p-4 backdrop-blur"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                  {b.icon}
                </div>
                <p className="font-display text-sm font-semibold">{b.t}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{b.d}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Una primera versión simple y clara para pymes.
        </p>
      </div>
    </div>
  );
}
