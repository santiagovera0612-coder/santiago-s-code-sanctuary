import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Mail, Lock, Sparkles, Check } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }).max(255),
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }).max(72),
});

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Crear cuenta — Clerivo" },
      { name: "description", content: "Creá tu cuenta gratis y lanzá tu agente de IA en 5 minutos." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app/dashboard" });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = scorePassword(password);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${window.location.origin}/app/dashboard` },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("already")
          ? "Ya existe una cuenta con ese email"
          : error.message,
      );
      return;
    }
    toast.success("¡Cuenta creada! Bienvenido a Clerivo 🚀");
    navigate({ to: "/app/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <SidePanel />

      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex justify-end">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">clerivo</span>
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Empezá gratis · Sin tarjeta
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Creá tu cuenta
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Lanzá tu agente de IA y empezá a vender 24/7.
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
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShow(s => !s)}
                      className="text-muted-foreground transition hover:text-foreground"
                      aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                {password && <StrengthBar score={strength} />}
              </div>

              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="h-12 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
              >
                {loading ? "Creando cuenta…" : (<>Crear cuenta gratis <ArrowRight className="ml-2 h-4 w-4" /></>)}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                Al continuar aceptás los Términos y la Política de Privacidad.
              </p>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{" "}
              <Link to="/login" className="font-medium text-foreground hover:underline">
                Iniciá sesión
              </Link>
            </p>
          </motion.div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Clerivo
        </p>
      </div>
    </div>
  );
}

function Field({
  id, label, icon, type, placeholder, value, onChange, autoComplete, trailing,
}: {
  id: string; label: string; icon: React.ReactNode; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; autoComplete?: string; trailing?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="group relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-muted-foreground transition group-focus-within:text-primary">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        {trailing && <span className="absolute right-3">{trailing}</span>}
      </div>
    </div>
  );
}

function scorePassword(pwd: string): number {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.min(s, 4);
}

function StrengthBar({ score }: { score: number }) {
  const labels = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Excelente"];
  const colors = ["bg-destructive", "bg-destructive", "bg-warning", "bg-primary", "bg-success"];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition ${i < score ? colors[score] : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{labels[score]}</p>
    </div>
  );
}

function SidePanel() {
  const perks = [
    "Tu agente listo en 5 minutos",
    "Conectá WhatsApp, Instagram y tu web",
    "Métricas en tiempo real",
    "Sin tarjeta de crédito",
  ];
  return (
    <div className="relative hidden overflow-hidden bg-gradient-mesh lg:block">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-transparent" />
      <div className="relative flex h-full flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">clerivo</span>
        </Link>

        <div className="space-y-8">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              Empezá a vender<br /> mientras tomás un café.
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Creá tu agente de IA, conectalo a tus canales y dejá que trabaje por vos.
            </p>
          </div>

          <ul className="space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface-elevated/70 p-5 backdrop-blur">
          <div className="flex items-center gap-2 text-warning">
            {[0, 1, 2, 3, 4].map(i => (
              <span key={i} className="text-base">★</span>
            ))}
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            "En la primera semana respondió 1.200 mensajes y cerramos 23 ventas que se nos hubieran escapado."
          </p>
          <p className="mt-3 text-xs text-muted-foreground">— Andrés, Pizzería Roma</p>
        </div>
      </div>
    </div>
  );
}
